import type { Request, Response } from 'express';
import { createSuccessResponse } from '../../shared/types/api-response.js';
import { chatService } from './chat.service.js';
import type { ChatMessageRequestDto, ChatResetRequestDto } from './chat.types.js';

export class ChatController {
  async sendMessage(req: Request, res: Response) {
    const result = await chatService.sendMessage(req.body as ChatMessageRequestDto);
    res.json(createSuccessResponse(result));
  }

  async resetConversation(req: Request, res: Response) {
    const result = await chatService.resetConversation(req.body as ChatResetRequestDto);
    res.json(createSuccessResponse(result));
  }
}

export const chatController = new ChatController();
