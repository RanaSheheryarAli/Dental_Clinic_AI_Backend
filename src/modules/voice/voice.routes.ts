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

// Twilio "A call comes in" webhook — returns TwiML that streams call audio to our WebSocket.
// Twilio may use GET or POST depending on the number's config, so we accept both.
voiceRouter.post('/twiml', asyncHandler((req, res) => voiceController.twiml(req, res)));
voiceRouter.get('/twiml', asyncHandler((req, res) => voiceController.twiml(req, res)));

export { voiceRouter };
