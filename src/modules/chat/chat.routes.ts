import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { chatController } from './chat.controller.js';
import { chatMessageBodySchema, chatResetBodySchema } from './chat.schema.js';

const chatRouter = Router();

chatRouter.post('/message', validate({ body: chatMessageBodySchema }), asyncHandler((req, res) => chatController.sendMessage(req, res)));
chatRouter.post('/reset', validate({ body: chatResetBodySchema }), asyncHandler((req, res) => chatController.resetConversation(req, res)));

export { chatRouter };
