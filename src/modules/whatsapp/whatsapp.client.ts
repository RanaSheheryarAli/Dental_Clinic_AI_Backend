import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../../shared/utils/logger.js';
import type { WhatsAppReplyInput } from './whatsapp.types.js';

export class WhatsAppClient {
  async sendMessage(input: WhatsAppReplyInput): Promise<void> {
    if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      logger.info({ input }, 'WhatsApp credentials missing; skipping outbound send');
      return;
    }

    await axios.post(
      `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: input.to,
        text: {
          body: input.message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`
        }
      }
    );
  }
}

export const whatsAppClient = new WhatsAppClient();
