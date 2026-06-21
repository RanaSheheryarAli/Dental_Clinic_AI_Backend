import { z } from 'zod';

const slotSchema = z
  .string()
  .min(1, 'slot is required')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'slot must be a valid date-time')
  .transform((value) => new Date(value).toISOString());

export const getSlotsQuerySchema = z.object({
  serviceId: z.string().min(1, 'serviceId is required'),
  dentistId: z.string().optional(),
  date: z.string().min(1, 'date is required')
});

export const createBookingBodySchema = z.object({
  serviceId: z.string().min(1, 'serviceId is required'),
  dentistId: z.string().optional(),
  slot: slotSchema,
  patientName: z.string().min(2, 'patientName is required'),
  patientPhone: z.string().min(5, 'patientPhone is required'),
  patientEmail: z.string().email('patientEmail must be a valid email address'),
  notes: z.string().optional()
});
