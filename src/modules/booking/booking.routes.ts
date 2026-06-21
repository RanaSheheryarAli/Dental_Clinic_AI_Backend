import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { bookingController } from './booking.controller.js';
import { createBookingBodySchema, getSlotsQuerySchema } from './booking.schema.js';

const bookingRouter = Router();

bookingRouter.get('/slots', validate({ query: getSlotsQuerySchema }), asyncHandler((req, res) => bookingController.getSlots(req, res)));
bookingRouter.post('/', validate({ body: createBookingBodySchema }), asyncHandler((req, res) => bookingController.createBooking(req, res)));

export { bookingRouter };
