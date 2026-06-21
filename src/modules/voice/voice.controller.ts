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
}

export const voiceController = new VoiceController();
