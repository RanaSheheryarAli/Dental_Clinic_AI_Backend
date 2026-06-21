import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { whatsappController } from './whatsapp.controller.js';
import { whatsappVerifyQuerySchema } from './whatsapp.schema.js';

const whatsappRouter = Router();

whatsappRouter.get('/webhook', validate({ query: whatsappVerifyQuerySchema }), asyncHandler((req, res) => whatsappController.verify(req, res)));
whatsappRouter.post('/webhook', asyncHandler((req, res) => whatsappController.handleWebhook(req, res)));

export { whatsappRouter };
