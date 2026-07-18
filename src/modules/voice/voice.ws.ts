import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { logger } from '../../shared/utils/logger.js';
import { handleTwilioStream } from './voice.stream.js';

const VOICE_WS_PATH = '/api/voice/ws';

/**
 * Attaches the Twilio Media Streams WebSocket to the existing HTTP server.
 * Twilio connects here (from the <Stream url="wss://.../api/voice/ws"> in our TwiML)
 * and streams the live call audio.
 */
export function attachVoiceWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== VOICE_WS_PATH) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleTwilioStream(ws);
    });
  });

  logger.info({ path: VOICE_WS_PATH }, 'Voice WebSocket attached');
}
