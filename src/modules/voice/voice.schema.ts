import { z } from 'zod';

// Retell's voice agent passes service/dentist by NAME (it never knows internal ids),
// so these schemas accept names (or ids) and the service layer resolves them.
const entitySelectors = {
  serviceName: z.string().optional(),
  serviceId: z.string().optional(),
  dentistName: z.string().optional(),
  dentistId: z.string().optional()
};

const requireService = (data: { serviceName?: string; serviceId?: string }) =>
  Boolean(data.serviceName || data.serviceId);

export const voiceGetSlotsBodySchema = z
  .object({
    ...entitySelectors,
    date: z.string().min(1, 'date is required')
  })
  .refine(requireService, { message: 'serviceName or serviceId is required' });

export const voiceCreateBookingBodySchema = z
  .object({
    ...entitySelectors,
    slot: z
      .string()
      .min(1, 'slot is required')
      .refine((value) => !Number.isNaN(Date.parse(value)), 'slot must be a valid date-time'),
    patientName: z.string().min(2, 'patientName is required'),
    patientPhone: z.string().min(5, 'patientPhone is required'),
    patientEmail: z.string().email('patientEmail must be a valid email address'),
    notes: z.string().optional()
  })
  .refine(requireService, { message: 'serviceName or serviceId is required' });

export const voiceWebhookBodySchema = z.object({
  callId: z.string().optional(),
  transcript: z.string().optional()
});
