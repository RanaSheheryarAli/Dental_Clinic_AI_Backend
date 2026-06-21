import type { BookingResult } from '../booking/booking.types.js';

export interface ChatMessageRequestDto {
  conversationId?: string;
  message: string;
  lang?: 'en' | 'ur';
}

export interface ChatResetRequestDto {
  conversationId?: string;
}

export interface ChatMessageResponseDto {
  conversationId: string;
  reply: string;
  booking?: BookingResult;
}
