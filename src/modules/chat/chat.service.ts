import { conversationService } from '../conversation/conversation.service.js';
import type { ChatMessageRequestDto, ChatMessageResponseDto, ChatResetRequestDto } from './chat.types.js';

export class ChatService {
  async sendMessage(input: ChatMessageRequestDto): Promise<ChatMessageResponseDto> {
    return conversationService.handleMessage({
      channel: 'web',
      conversationId: input.conversationId,
      message: input.message,
      lang: input.lang
    });
  }

  async resetConversation(input: ChatResetRequestDto): Promise<{ cleared: boolean }> {
    await conversationService.resetConversation(input.conversationId);
    return { cleared: true };
  }
}

export const chatService = new ChatService();
