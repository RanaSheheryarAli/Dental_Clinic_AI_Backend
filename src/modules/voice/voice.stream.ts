import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { WebSocket } from 'ws';
import { env } from '../../config/env.js';
import { logger } from '../../shared/utils/logger.js';
import { conversationService } from '../conversation/conversation.service.js';

/**
 * Self-hosted voice pipeline for ONE Twilio phone call — the replacement for Retell/Vapi.
 *
 *   Twilio audio (μ-law 8kHz)  ->  Deepgram STT  ->  conversationService (Groq + RAG + booking)
 *                                                        |
 *   Twilio audio  <-  Deepgram Aura TTS  <-  reply text  +
 *
 * The "brain" is the existing conversation module, called in-process (no HTTP). Passing the
 * Twilio callSid as externalId keys the session by `voice:<callSid>`, so context and booking
 * state persist across turns within the same call.
 */

const deepgram = createClient(env.DEEPGRAM_API_KEY);

const GREETING = 'Thank you for calling the dental clinic. How can I help you today?';
const MULAW_FRAME_BYTES = 160; // 20ms of μ-law audio at 8kHz

// Deepgram's live socket typings accept ArrayBuffer, not Node's Buffer — hand it the
// exact underlying bytes (no copy) so the audio is sent as-is.
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// Safety net: the brain is told to speak plainly on voice, but strip any stray markdown
// so the TTS never reads out symbols like "asterisk" or "pipe".
function toSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/^\s*[-:| ]+\s*$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

export function handleTwilioStream(ws: WebSocket): void {
  let streamSid = '';
  let callSid = '';
  let dgReady = false;
  let botSpeaking = false;
  let processing = false;
  let closed = false;
  let transcriptBuffer = '';
  const pendingAudio: Buffer[] = [];

  // --- Deepgram live speech-to-text ---
  const dg = deepgram.listen.live({
    model: env.DEEPGRAM_STT_MODEL,
    language: env.VOICE_LANG,
    encoding: 'mulaw',
    sample_rate: 8000,
    channels: 1,
    interim_results: true,
    smart_format: true,
    vad_events: true,
    endpointing: 300,
    utterance_end_ms: 1000
  });

  dg.on(LiveTranscriptionEvents.Open, () => {
    dgReady = true;
    for (const chunk of pendingAudio) {
      dg.send(toArrayBuffer(chunk));
    }
    pendingAudio.length = 0;
  });

  dg.on(LiveTranscriptionEvents.Transcript, (data: any) => {
    const text: string = (data?.channel?.alternatives?.[0]?.transcript ?? '').trim();
    if (!text) {
      return;
    }
    if (data.is_final) {
      transcriptBuffer = `${transcriptBuffer} ${text}`.trim();
      if (data.speech_final) {
        void flushUtterance();
      }
    }
  });

  dg.on(LiveTranscriptionEvents.UtteranceEnd, () => {
    void flushUtterance();
  });

  dg.on(LiveTranscriptionEvents.SpeechStarted, () => {
    // Barge-in: caller began speaking while the bot was talking → cut the bot off immediately.
    if (botSpeaking) {
      botSpeaking = false;
      sendClear();
    }
  });

  dg.on(LiveTranscriptionEvents.Error, (err: unknown) => {
    logger.error({ err }, 'voice: deepgram stt error');
  });

  // --- Turn handling: one finished utterance -> brain -> spoken reply ---
  async function flushUtterance(): Promise<void> {
    const utterance = transcriptBuffer.trim();
    if (!utterance || processing) {
      return;
    }
    transcriptBuffer = '';
    processing = true;
    try {
      logger.info({ callSid, utterance }, 'voice: caller said');
      const result = await conversationService.handleMessage({
        channel: 'voice',
        externalId: callSid,
        message: utterance,
        lang: env.VOICE_LANG
      });
      await speak(result.reply);
    } catch (err) {
      logger.error({ err }, 'voice: brain call failed');
      await speak('Sorry, I ran into a problem. Could you say that again?');
    } finally {
      processing = false;
    }
  }

  // --- Text-to-speech via Deepgram Aura, streamed back to Twilio as μ-law frames ---
  async function synthesize(text: string): Promise<Buffer> {
    const response = await deepgram.speak.request(
      { text },
      { model: env.DEEPGRAM_TTS_MODEL, encoding: 'mulaw', sample_rate: 8000, container: 'none' }
    );
    const stream = await response.getStream();
    if (!stream) {
      return Buffer.alloc(0);
    }
    const reader = stream.getReader();
    const chunks: Buffer[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(Buffer.from(value));
      }
    }
    return Buffer.concat(chunks);
  }

  async function speak(text: string): Promise<void> {
    if (!text || !streamSid || closed) {
      return;
    }
    const spoken = toSpeech(text);
    if (!spoken) {
      return;
    }
    logger.info({ callSid, text: spoken }, 'voice: bot says');
    let audio: Buffer;
    try {
      audio = await synthesize(spoken);
    } catch (err) {
      logger.error({ err }, 'voice: deepgram tts error');
      return;
    }
    if (!audio.length || closed) {
      return;
    }
    botSpeaking = true;
    for (let offset = 0; offset < audio.length; offset += MULAW_FRAME_BYTES) {
      if (!botSpeaking || closed) {
        return; // barge-in aborted, or call ended
      }
      const frame = audio.subarray(offset, offset + MULAW_FRAME_BYTES);
      ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: frame.toString('base64') } }));
    }
    // Twilio echoes this mark back once the queued audio has finished playing.
    ws.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: 'end-of-response' } }));
  }

  function sendClear(): void {
    if (streamSid && !closed) {
      ws.send(JSON.stringify({ event: 'clear', streamSid }));
    }
  }

  // --- Twilio Media Streams protocol ---
  ws.on('message', (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.event) {
      case 'connected':
        break;
      case 'start':
        streamSid = msg.start?.streamSid ?? '';
        callSid = msg.start?.callSid ?? '';
        logger.info({ streamSid, callSid }, 'voice: call started');
        void speak(GREETING);
        break;
      case 'media': {
        const payload: string | undefined = msg.media?.payload;
        if (!payload) {
          break;
        }
        const audio = Buffer.from(payload, 'base64');
        if (dgReady) {
          dg.send(toArrayBuffer(audio));
        } else {
          pendingAudio.push(audio);
        }
        break;
      }
      case 'mark':
        if (msg.mark?.name === 'end-of-response') {
          botSpeaking = false;
        }
        break;
      case 'stop':
        logger.info({ callSid }, 'voice: call stopped');
        cleanup();
        break;
      default:
        break;
    }
  });

  ws.on('close', cleanup);
  ws.on('error', (err) => {
    logger.error({ err }, 'voice: twilio ws error');
    cleanup();
  });

  function cleanup(): void {
    if (closed) {
      return;
    }
    closed = true;
    botSpeaking = false;
    try {
      dg.requestClose();
    } catch {
      /* ignore */
    }
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }
}
