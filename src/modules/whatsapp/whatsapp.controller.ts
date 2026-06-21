import type { Request, Response } from 'express';
import { createSuccessResponse } from '../../shared/types/api-response.js';
import { logger } from '../../shared/utils/logger.js';
import { whatsappService } from './whatsapp.service.js';
import type { WhatsAppWebhookPayload } from './whatsapp.types.js';

export class WhatsAppController {
  async verify(req: Request, res: Response) {
    logger.info({ query: req.query }, 'WhatsApp webhook GET (verify) received');
    const challenge = await whatsappService.verify(
      String(req.query['hub.mode']),
      String(req.query['hub.verify_token']),
      String(req.query['hub.challenge'])
    );

    res.status(200).send(challenge);
  }

  async handleWebhook(req: Request, res: Response) {
    logger.info({ body: req.body }, 'WhatsApp webhook POST received');
    await whatsappService.handleWebhook(req.body as WhatsAppWebhookPayload);
    res.json(createSuccessResponse({ received: true }));
  }
}

export const whatsappController = new WhatsAppController();
