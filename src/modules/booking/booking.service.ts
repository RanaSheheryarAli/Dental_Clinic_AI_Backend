import axios from 'axios';
import { prisma } from '../../config/db.js';
import type { Dentist, Service } from '../../generated/prisma/client.js';
import { dentistCalConfigs, env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { getClinicTimeZone } from '../../shared/utils/date-time.js';
import { logger } from '../../shared/utils/logger.js';
import type { BookingRequestDto, BookingResult, GetSlotsInput, SlotsResponseDto } from './booking.types.js';

const CAL_SLOTS_API_VERSION = '2024-09-04';
const CAL_BOOKINGS_API_VERSION = '2026-02-25';

function buildMockSlots(date: string): string[] {
  const hours = [9, 10, 11, 13, 14, 15, 16];
  return hours.map((hour) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000+05:00`).toISOString());
}

function buildSlotWindow(date: string) {
  return {
    start: new Date(`${date}T00:00:00.000Z`).toISOString(),
    end: new Date(`${date}T23:59:59.999Z`).toISOString()
  };
}

interface CalEventTypeUser {
  id: number;
  name: string;
  username?: string;
}

interface CalEventTypeResponse {
  data?: {
    id: number;
    slug?: string;
    title?: string;
    users?: CalEventTypeUser[];
  };
}

interface ResolvedCalContext {
  apiKey: string;
  eventTypeId: number;
  username?: string;
  timeZone: string;
}

function normalizePersonName(value: string) {
  return value
    .toLowerCase()
    .replace(/dr\.?\s+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchServiceByName<T extends { name: string }>(services: T[], query: string): T | undefined {
  const normalizedQuery = query.toLowerCase().trim();
  return services.find((service) => {
    const name = service.name.toLowerCase();
    return normalizedQuery.includes(name) || name.includes(normalizedQuery);
  });
}

function matchDentistByName<T extends { name: string }>(dentists: T[], query: string): T | undefined {
  const normalizedQuery = query.toLowerCase().trim();
  return dentists.find((dentist) => {
    const fullName = dentist.name.toLowerCase();
    const strippedName = fullName.replace('dr. ', '').replace('dr ', '');
    const firstName = strippedName.split(/\s+/)[0];
    return (
      normalizedQuery.includes(fullName) ||
      normalizedQuery.includes(strippedName) ||
      (firstName.length > 2 && normalizedQuery.includes(firstName))
    );
  });
}

export class BookingService {
  /**
   * Resolve a service (required) and optional dentist from either internal ids or free-text names.
   * Shared by the conversation tools and the Retell voice functions so name→id matching lives in one place.
   */
  async resolveEntities(input: { serviceId?: string; serviceName?: string; dentistId?: string; dentistName?: string }) {
    const [services, dentists]: [Service[], Dentist[]] = await Promise.all([prisma.service.findMany(), prisma.dentist.findMany()]);

    const service =
      (input.serviceId ? services.find((item) => item.id === input.serviceId) : undefined) ??
      (input.serviceName ? matchServiceByName(services, input.serviceName) : undefined);

    const dentist =
      (input.dentistId ? dentists.find((item) => item.id === input.dentistId) : undefined) ??
      (input.dentistName ? matchDentistByName(dentists, input.dentistName) : undefined);

    if (!service) {
      throw new AppError('SERVICE_NOT_RESOLVED', 'I could not match that service to a clinic service.', 400);
    }

    return { service, dentist: dentist ?? null };
  }

  private async getCalEventType(apiKey: string, eventTypeId: number) {
    const response = await axios.get<CalEventTypeResponse>(`${env.CALCOM_BASE_URL}/event-types/${eventTypeId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': '2024-06-14'
      }
    });

    return response.data?.data;
  }

  private resolveCalContext(service: { name: string; calEventTypeId: number | null }, dentist?: { name: string } | null): ResolvedCalContext {
    if (dentist) {
      const normalizedDentistName = normalizePersonName(dentist.name);
      const dentistConfig = dentistCalConfigs.find(
        (config) => normalizePersonName(config.dentistName) === normalizedDentistName
      );

      if (!dentistConfig) {
        throw new AppError(
          'DENTIST_CALCOM_NOT_CONFIGURED',
          `${dentist.name} does not have a Cal.com configuration yet. Add their API key and service event type IDs in DENTIST_CALCOM_CONFIGS.`,
          400
        );
      }

      const eventTypeId = dentistConfig.serviceEventTypeIds[service.name];

      if (!eventTypeId) {
        throw new AppError(
          'SERVICE_EVENT_TYPE_NOT_CONFIGURED',
          `${service.name} is not mapped for ${dentist.name} in DENTIST_CALCOM_CONFIGS.`,
          400
        );
      }

      return {
        apiKey: dentistConfig.apiKey,
        eventTypeId,
        username: dentistConfig.username,
        timeZone: dentistConfig.timeZone
      };
    }

    if (!env.CALCOM_API_KEY || !service.calEventTypeId) {
      throw new AppError('CALCOM_NOT_CONFIGURED', 'Cal.com is not configured for this booking flow.', 400);
    }

    return {
      apiKey: env.CALCOM_API_KEY,
      eventTypeId: service.calEventTypeId,
      timeZone: getClinicTimeZone()
    };
  }

  async getSlots(input: GetSlotsInput): Promise<SlotsResponseDto> {
    const [service, dentist] = await Promise.all([
      prisma.service.findUnique({ where: { id: input.serviceId } }),
      input.dentistId ? prisma.dentist.findUnique({ where: { id: input.dentistId } }) : Promise.resolve(null)
    ]);

    if (!service) {
      throw new AppError('SERVICE_NOT_FOUND', 'Service was not found.', 404);
    }

    if (input.dentistId && !dentist) {
      throw new AppError('DENTIST_NOT_FOUND', 'Dentist was not found.', 404);
    }

    if (!dentist && (!env.CALCOM_API_KEY || !service.calEventTypeId)) {
      return {
        slots: buildMockSlots(input.date)
      };
    }

    try {
      const slotWindow = buildSlotWindow(input.date);
      const calContext = this.resolveCalContext(service, dentist);

      const response = await axios.get(`${env.CALCOM_BASE_URL}/slots`, {
        headers: {
          Authorization: `Bearer ${calContext.apiKey}`,
          'cal-api-version': CAL_SLOTS_API_VERSION
        },
        params: {
          eventTypeId: calContext.eventTypeId,
          start: slotWindow.start,
          end: slotWindow.end,
          timeZone: calContext.timeZone
        }
      });

      const rawData = response.data?.data;
      const slots = rawData && typeof rawData === 'object'
        ? Object.values(rawData as Record<string, Array<{ start: string }>>).flat().map((slot) => slot.start)
        : [];
      return { slots };
    } catch (error) {
      logger.error({ err: error, input }, 'Failed to fetch Cal.com slots');
      throw new AppError('CALCOM_SLOTS_FAILED', 'Unable to fetch live availability from Cal.com.', 502);
    }
  }

  async createBooking(input: BookingRequestDto): Promise<BookingResult> {
    const [service, dentist] = await Promise.all([
      prisma.service.findUnique({ where: { id: input.serviceId } }),
      input.dentistId ? prisma.dentist.findUnique({ where: { id: input.dentistId } }) : Promise.resolve(null)
    ]);

    if (!service) {
      throw new AppError('SERVICE_NOT_FOUND', 'Service was not found.', 404);
    }

    if (input.dentistId && !dentist) {
      throw new AppError('DENTIST_NOT_FOUND', 'Dentist was not found.', 404);
    }

    if (!dentist && (!env.CALCOM_API_KEY || !service.calEventTypeId)) {
      return {
        bookingId: `mock-${crypto.randomUUID()}`,
        status: 'confirmed',
        slot: input.slot,
        serviceName: service.name,
        dentistName: undefined
      };
    }

    try {
      const calContext = this.resolveCalContext(service, dentist);
      const eventType = await this.getCalEventType(calContext.apiKey, calContext.eventTypeId);

      const response = await axios.post(
        `${env.CALCOM_BASE_URL}/bookings`,
        {
          start: input.slot,
          eventTypeId: calContext.eventTypeId,
          ...(eventType?.slug && calContext.username
            ? { eventTypeSlug: eventType.slug, username: calContext.username }
            : {}),
          attendee: {
            name: input.patientName,
            email: input.patientEmail,
            timeZone: calContext.timeZone,
            language: 'en',
            phoneNumber: input.patientPhone
          },
          bookingFieldsResponses: {
            notes: input.notes ?? ''
          },
          metadata: {
            patientPhone: input.patientPhone,
            patientEmail: input.patientEmail,
            dentistId: dentist?.calUserId ? String(dentist.calUserId) : undefined
          }
        },
        {
          headers: {
            Authorization: `Bearer ${calContext.apiKey}`,
            'cal-api-version': CAL_BOOKINGS_API_VERSION,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        bookingId: String(response.data?.data?.id ?? crypto.randomUUID()),
        status: String(response.data?.data?.status ?? 'confirmed'),
        slot: input.slot,
        serviceName: service.name,
        dentistName: dentist?.name ?? undefined
      };
    } catch (error) {
      logger.error({ err: error, input }, 'Failed to create Cal.com booking');
      throw new AppError('BOOKING_FAILED', 'Unable to create the booking with Cal.com.', 502);
    }
  }
}

export const bookingService = new BookingService();
