import { z } from 'zod';

export const chatMessageBodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, 'message is required'),
  lang: z.enum(['en', 'ur']).optional()
});

export const chatResetBodySchema = z.object({
  conversationId: z.string().optional()
});
