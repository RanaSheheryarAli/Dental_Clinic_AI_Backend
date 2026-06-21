import type { Request, Response } from 'express';
import { createSuccessResponse } from '../../shared/types/api-response.js';
import { bookingService } from './booking.service.js';
import type { BookingRequestDto, GetSlotsInput } from './booking.types.js';

export class BookingController {
  async getSlots(req: Request, res: Response) {
    const slots = await bookingService.getSlots(req.query as unknown as GetSlotsInput);
    res.json(createSuccessResponse(slots));
  }

  async createBooking(req: Request, res: Response) {
    const booking = await bookingService.createBooking(req.body as BookingRequestDto);
    res.json(createSuccessResponse(booking));
  }
}

export const bookingController = new BookingController();
