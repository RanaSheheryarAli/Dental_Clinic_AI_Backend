import { bookingService } from '../booking/booking.service.js';
import type { VoiceCreateBookingRequest, VoiceGetSlotsRequest, VoiceWebhookPayload } from './voice.types.js';

export class VoiceService {
  async getSlots(input: VoiceGetSlotsRequest) {
    const { service, dentist } = await bookingService.resolveEntities({
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      dentistId: input.dentistId,
      dentistName: input.dentistName
    });

    return bookingService.getSlots({
      serviceId: service.id,
      dentistId: dentist?.id,
      date: input.date
    });
  }

  async createBooking(input: VoiceCreateBookingRequest) {
    const { service, dentist } = await bookingService.resolveEntities({
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      dentistId: input.dentistId,
      dentistName: input.dentistName
    });

    return bookingService.createBooking({
      serviceId: service.id,
      dentistId: dentist?.id,
      slot: new Date(input.slot).toISOString(),
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      patientEmail: input.patientEmail,
      notes: input.notes
    });
  }

  async handleWebhook(input: VoiceWebhookPayload) {
    if (!input.callId || !input.transcript) {
      return { logged: false };
    }

    return { logged: true };
  }
}

export const voiceService = new VoiceService();
