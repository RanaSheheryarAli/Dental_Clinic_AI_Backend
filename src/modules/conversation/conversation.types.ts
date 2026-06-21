import type { BookingResult } from '../booking/booking.types.js';

export type ConversationChannel = 'web' | 'whatsapp' | 'voice';
export type ConversationLanguage = 'en' | 'ur';

export interface ConversationInput {
  channel: ConversationChannel;
  conversationId?: string;
  externalId?: string;
  message: string;
  lang?: ConversationLanguage;
}

export interface ConversationOutput {
  conversationId: string;
  reply: string;
  booking?: BookingResult;
}

export interface ToolExecutionResult {
  output: string;
  booking?: BookingResult;
}
