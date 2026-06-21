import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { voiceController } from './voice.controller.js';
import { voiceCreateBookingBodySchema, voiceGetSlotsBodySchema, voiceWebhookBodySchema } from './voice.schema.js';

const voiceRouter = Router();

voiceRouter.post('/functions/get-slots', validate({ body: voiceGetSlotsBodySchema }), asyncHandler((req, res) => voiceController.getSlots(req, res)));
voiceRouter.post(
  '/functions/create-booking',
  validate({ body: voiceCreateBookingBodySchema }),
  asyncHandler((req, res) => voiceController.createBooking(req, res))
);
voiceRouter.post('/webhook', validate({ body: voiceWebhookBodySchema }), asyncHandler((req, res) => voiceController.handleWebhook(req, res)));

export { voiceRouter };
