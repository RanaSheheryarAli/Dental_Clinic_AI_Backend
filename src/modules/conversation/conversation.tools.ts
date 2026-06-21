import { z } from 'zod';
import { bookingService } from '../booking/booking.service.js';
import { ragService } from '../rag/rag.service.js';
import type { BookingResult } from '../booking/booking.types.js';
import type { LlmToolDefinition } from '../../shared/llm/llm.types.js';
import type { ToolExecutionResult } from './conversation.types.js';
import { formatSlotDate, formatSlotTime, getClinicTimeZone } from '../../shared/utils/date-time.js';

const ragSearchSchema = z.object({
  query: z.string().min(1).describe('The clinic question to look up in the knowledge base.')
});

const getSlotsSchema = z.object({
  serviceName: z.string().min(1).describe('Name of the service, e.g. "Root Canal Therapy".'),
  dentistName: z.string().optional().describe('Optional dentist name, e.g. "Dr. Sheheryar Ali".'),
  date: z.string().min(1).describe('Exact calendar date in YYYY-MM-DD format.')
});

const createBookingSchema = z.object({
  serviceName: z.string().min(1).describe('Name of the service to book.'),
  dentistName: z.string().optional().describe('Optional preferred dentist name.'),
  slot: z
    .string()
    .min(1)
    .describe('The exact slot value (ISO timestamp) returned by get_available_slots for the chosen time.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'slot must be a valid date-time'),
  patientName: z.string().min(2).describe("Patient's full name."),
  patientPhone: z.string().min(5).describe("Patient's phone number."),
  patientEmail: z.string().email().describe("Patient's email address."),
  notes: z.string().optional()
});

type ToolHandler = (input: Record<string, unknown>) => Promise<ToolExecutionResult>;

export interface ConversationTool {
  definition: LlmToolDefinition;
  handle: ToolHandler;
}

/**
 * Recursively strip JSON-Schema keywords that some providers' validators reject.
 * Notably zod's `.email()` emits a `pattern` whose lookahead/possessive syntax is
 * not valid RE2 (Groq compiles tool schemas with RE2 and 400s on it). Runtime
 * validation still happens via the Zod schema's `.parse()`, so dropping these
 * keywords from the LLM-facing schema is safe.
 */
function stripUnsupportedKeywords(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripUnsupportedKeywords);
  }
  if (node && typeof node === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'pattern' || key === '$schema' || key === 'format') {
        continue;
      }
      result[key] = stripUnsupportedKeywords(value);
    }
    return result;
  }
  return node;
}

function toToolSchema(schema: z.ZodType): Record<string, unknown> {
  return stripUnsupportedKeywords(z.toJSONSchema(schema)) as Record<string, unknown>;
}

function bookingToOutput(booking: BookingResult): ToolExecutionResult {
  return {
    output: JSON.stringify(booking),
    booking
  };
}

export const conversationTools: Record<string, ConversationTool> = {
  rag_search: {
    definition: {
      name: 'rag_search',
      description:
        'Search the clinic knowledge base for answers about services, treatments, policies, pricing, and other clinic information. Use this for any factual clinic question that is not already in the system prompt.',
      inputSchema: toToolSchema(ragSearchSchema)
    },
    async handle(input) {
      const parsed = ragSearchSchema.parse(input);
      const result = await ragService.search({ query: parsed.query, topK: 4 });

      return {
        output: JSON.stringify({
          query: parsed.query,
          groundedAnswer:
            result.chunks.length > 0
              ? result.chunks
                  .slice(0, 3)
                  .map((chunk) => chunk.content)
                  .join('\n\n')
              : null,
          citations: result.chunks.map((chunk) => ({ title: chunk.title, source: chunk.source, score: chunk.score }))
        })
      };
    }
  },
  get_available_slots: {
    definition: {
      name: 'get_available_slots',
      description:
        'Fetch available appointment slots for a service, an optional dentist, and an exact date. Convert relative dates (today, tomorrow, Monday) to YYYY-MM-DD before calling.',
      inputSchema: toToolSchema(getSlotsSchema)
    },
    async handle(input) {
      const parsed = getSlotsSchema.parse(input);
      const { service, dentist } = await bookingService.resolveEntities({
        serviceName: parsed.serviceName,
        dentistName: parsed.dentistName
      });
      const result = await bookingService.getSlots({
        serviceId: service.id,
        dentistId: dentist?.id,
        date: parsed.date
      });
      const timeZone = getClinicTimeZone();

      return {
        output: JSON.stringify({
          serviceName: service.name,
          dentistName: dentist?.name,
          date: parsed.date,
          displayDate: formatSlotDate(`${parsed.date}T12:00:00.000Z`, timeZone),
          // Each slot carries the human-readable time (show this) and the exact ISO value
          // (pass this back verbatim as `slot` when calling create_booking).
          slots: result.slots.map((slot) => ({
            slot,
            time: formatSlotTime(slot, timeZone)
          }))
        })
      };
    }
  },
  create_booking: {
    definition: {
      name: 'create_booking',
      description:
        'Create the appointment. Only call this after the patient has chosen a specific available slot and provided their full name, phone number, and email address, and you have confirmed the details.',
      inputSchema: toToolSchema(createBookingSchema)
    },
    async handle(input) {
      const parsed = createBookingSchema.parse(input);
      const { service, dentist } = await bookingService.resolveEntities({
        serviceName: parsed.serviceName,
        dentistName: parsed.dentistName
      });
      const booking = await bookingService.createBooking({
        serviceId: service.id,
        dentistId: dentist?.id,
        slot: new Date(parsed.slot).toISOString(),
        patientName: parsed.patientName,
        patientPhone: parsed.patientPhone,
        patientEmail: parsed.patientEmail,
        notes: parsed.notes
      });

      return bookingToOutput(booking);
    }
  }
};
