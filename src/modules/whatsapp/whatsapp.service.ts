import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';
import { conversationService } from '../conversation/conversation.service.js';
import { whatsAppClient } from './whatsapp.client.js';
import type { WhatsAppWebhookPayload } from './whatsapp.types.js';

export class WhatsAppService {
  async verify(mode: string, token: string, challenge: string): Promise<string> {
    if (mode !== 'subscribe' || !env.WHATSAPP_VERIFY_TOKEN || token !== env.WHATSAPP_VERIFY_TOKEN) {
      throw new AppError('WHATSAPP_VERIFICATION_FAILED', 'WhatsApp verification failed.', 403);
    }

    return challenge;
  }

  async handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message?.from || !message.text?.body) {
      logger.info('WhatsApp webhook: no text message in payload (status update or unsupported type) — ignoring');
      return;
    }

    logger.info({ from: message.from, text: message.text.body }, 'WhatsApp: handling incoming message');

    try {
      // externalId = sender phone number → the conversation engine resumes the same session per number.
      const result = await conversationService.handleMessage({
        channel: 'whatsapp',
        externalId: message.from,
        message: message.text.body
      });

      logger.info({ to: message.from, reply: result.reply }, 'WhatsApp: sending reply');
      await whatsAppClient.sendMessage({
        to: message.from,
        message: result.reply
      });
      logger.info({ to: message.from }, 'WhatsApp: reply sent');
    } catch (error) {
      // Never let a reply failure bubble up — Meta disables webhooks that repeatedly return 5xx.
      logger.error({ err: error, from: message.from }, 'WhatsApp: failed to process/reply to message');
    }
  }
}

export const whatsappService = new WhatsAppService();
