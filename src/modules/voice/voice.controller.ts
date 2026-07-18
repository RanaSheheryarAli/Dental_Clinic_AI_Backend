import type { Request, Response } from 'express';
import { createSuccessResponse } from '../../shared/types/api-response.js';
import { voiceService } from './voice.service.js';
import type { VoiceCreateBookingRequest, VoiceGetSlotsRequest, VoiceWebhookPayload } from './voice.types.js';

export class VoiceController {
  async getSlots(req: Request, res: Response) {
    const result = await voiceService.getSlots(req.body as VoiceGetSlotsRequest);
    res.json(createSuccessResponse(result));
  }

  async createBooking(req: Request, res: Response) {
    const result = await voiceService.createBooking(req.body as VoiceCreateBookingRequest);
    res.json(createSuccessResponse(result));
  }

  async handleWebhook(req: Request, res: Response) {
    const result = await voiceService.handleWebhook(req.body as VoiceWebhookPayload);
    res.json(createSuccessResponse(result));
  }

  // Twilio hits this when a call comes in. We reply with TwiML that tells Twilio
  // to open a media stream to our WebSocket. The wss host is derived from the
  // incoming request, so it works behind any ngrok/public domain automatically.
  async twiml(req: Request, res: Response) {
    const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? '';
    const wsUrl = `wss://${host}/api/voice/ws`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;
    res.type('text/xml').send(xml);
  }
}

export const voiceController = new VoiceController();
