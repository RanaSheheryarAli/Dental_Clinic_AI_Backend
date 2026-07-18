import { MESSAGE_HISTORY_LIMIT } from '../../config/constants.js';
import { llmClient } from '../../shared/llm/llm.client.js';
import type { ChatMessageInput } from '../../shared/llm/llm.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';
import { buildSystemPrompt } from './conversation.prompt.js';
import { conversationTools } from './conversation.tools.js';
import type { ConversationInput, ConversationOutput, ToolExecutionResult } from './conversation.types.js';
import { clinicService } from '../clinic/clinic.service.js';
import {
  addDaysToIsoDate,
  formatSlotDateAndTime,
  getClinicTimeZone,
  getIsoDateInTimeZone,
  getWeekdayName
} from '../../shared/utils/date-time.js';
import type { BookingResult } from '../booking/booking.types.js';

const MAX_TOOL_ITERATIONS = 5;
const SESSION_TTL_MS = 1000 * 60 * 60; // evict idle sessions after 1 hour
const MAX_SESSIONS = 1000; // backstop so the in-memory store cannot grow unbounded
const DATE_REFERENCE_DAYS = 7;

/** A stored turn. Tool round-trips are persisted too, so context survives across turns. */
type StoredMessage = ChatMessageInput & { role: 'user' | 'assistant' | 'tool' };

interface ConversationSession {
  id: string;
  channel: string;
  externalKey?: string;
  createdAt: number;
  lastActiveAt: number;
  messages: StoredMessage[];
}

/**
 * In-memory conversation store. Web sessions are keyed by the conversationId returned to the client;
 * WhatsApp/voice sessions are keyed by `${channel}:${externalId}` so repeated messages from the same
 * phone number / call resume the same conversation. Sessions expire after SESSION_TTL_MS of inactivity.
 *
 * Note: this is process-local and resets on restart — fine for a single-instance demo, but a horizontally
 * scaled deployment should back this with Redis or a database.
 */
class SessionStore {
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly externalIndex = new Map<string, string>();

  private now() {
    return Date.now();
  }

  private evict(session: ConversationSession) {
    this.sessions.delete(session.id);
    if (session.externalKey) {
      this.externalIndex.delete(session.externalKey);
    }
  }

  private evictExpired() {
    const cutoff = this.now() - SESSION_TTL_MS;
    for (const session of this.sessions.values()) {
      if (session.lastActiveAt < cutoff) {
        this.evict(session);
      }
    }
  }

  private enforceLimit() {
    if (this.sessions.size <= MAX_SESSIONS) {
      return;
    }
    const oldest = [...this.sessions.values()].sort((left, right) => left.lastActiveAt - right.lastActiveAt)[0];
    if (oldest) {
      this.evict(oldest);
    }
  }

  private create(channel: string, externalKey?: string): ConversationSession {
    const session: ConversationSession = {
      id: crypto.randomUUID(),
      channel,
      externalKey,
      createdAt: this.now(),
      lastActiveAt: this.now(),
      messages: []
    };
    this.sessions.set(session.id, session);
    if (externalKey) {
      this.externalIndex.set(externalKey, session.id);
    }
    this.enforceLimit();
    return session;
  }

  getOrCreate(input: ConversationInput): ConversationSession {
    this.evictExpired();

    if (input.externalId) {
      const externalKey = `${input.channel}:${input.externalId}`;
      const existingId = this.externalIndex.get(externalKey);
      const existing = existingId ? this.sessions.get(existingId) : undefined;
      if (existing) {
        existing.lastActiveAt = this.now();
        return existing;
      }
      return this.create(input.channel, externalKey);
    }

    if (input.conversationId) {
      const existing = this.sessions.get(input.conversationId);
      if (existing) {
        existing.lastActiveAt = this.now();
        return existing;
      }
    }

    // No usable conversationId (new chat, or an expired one): start fresh and return the new id.
    return this.create(input.channel);
  }

  delete(conversationId?: string) {
    if (!conversationId) {
      return;
    }
    const session = this.sessions.get(conversationId);
    if (session) {
      this.evict(session);
    }
  }
}

const sessionStore = new SessionStore();

function summarizeHours(hours: unknown): string | undefined {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) {
    return undefined;
  }
  const entries = Object.entries(hours as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([day, value]) => `${day} ${String(value)}`);
  return entries.length > 0 ? entries.join(', ') : undefined;
}

/** A lookup table the model uses to resolve relative dates instead of computing weekdays itself. */
function buildDateReference(todayIsoDate: string): string {
  const lines: string[] = [];
  for (let offset = 0; offset <= DATE_REFERENCE_DAYS; offset += 1) {
    const isoDate = addDaysToIsoDate(todayIsoDate, offset);
    const weekday = getWeekdayName(isoDate);
    const label = offset === 0 ? ' (today)' : offset === 1 ? ' (tomorrow)' : '';
    lines.push(`- ${isoDate} = ${weekday}${label}`);
  }
  return lines.join('\n');
}

/**
 * Build the message window passed to the LLM from stored history.
 * Drops leading orphan `tool` messages whose originating assistant turn fell outside the window,
 * which would otherwise be rejected by the provider (a tool result with no preceding tool call).
 */
/** Deterministic confirmation built from the booking result — always includes the reference. */
function buildBookingConfirmation(booking: BookingResult): string {
  const when = formatSlotDateAndTime(booking.slot, getClinicTimeZone());
  const detail = [
    `for ${when}`,
    booking.dentistName ? `with ${booking.dentistName}` : '',
    booking.serviceName ? `(${booking.serviceName})` : ''
  ]
    .filter(Boolean)
    .join(' ');
  return `Your appointment is ${booking.status} ${detail}. Booking reference: ${booking.bookingId}. Is there anything else I can help you with?`;
}

function buildLlmWindow(messages: StoredMessage[]): ChatMessageInput[] {
  const window = messages.slice(-MESSAGE_HISTORY_LIMIT);
  let start = 0;
  while (start < window.length && window[start].role === 'tool') {
    start += 1;
  }
  return window.slice(start).map((message) => ({ ...message }));
}

export class ConversationService {
  private async executeTool(name: string, input: Record<string, unknown>): Promise<ToolExecutionResult> {
    const tool = conversationTools[name];
    if (!tool) {
      throw new AppError('TOOL_NOT_FOUND', `Tool ${name} is not registered.`, 400);
    }
    return tool.handle(input);
  }

  async resetConversation(conversationId?: string) {
    sessionStore.delete(conversationId);
  }

  async handleMessage(input: ConversationInput): Promise<ConversationOutput> {
    const session = sessionStore.getOrCreate(input);
    session.messages.push({ role: 'user', content: input.message });

    const [clinicInfo, services, dentists] = await Promise.all([
      clinicService.getClinicInfo(),
      clinicService.getServices(),
      clinicService.getDentists()
    ]);

    const todayIsoDate = getIsoDateInTimeZone(getClinicTimeZone());
    const system = buildSystemPrompt(input.lang ?? 'en', {
      clinicName: clinicInfo.name,
      address: clinicInfo.address,
      phone: clinicInfo.phone,
      whatsapp: clinicInfo.whatsapp,
      email: clinicInfo.email,
      hoursSummary: summarizeHours(clinicInfo.hours),
      services: services.map((service) => `${service.name} (${service.durationMin} min, price ${service.price})`),
      dentists: dentists.map((dentist) => (dentist.specialty ? `${dentist.name} — ${dentist.specialty}` : dentist.name)),
      todayIsoDate,
      dateReference: buildDateReference(todayIsoDate),
      channel: input.channel
    });

    // Working transcript for this turn (sanitized history). New tool round-trips are appended here
    // for the LLM and collected in `persisted` so they also survive into the next turn.
    const messages = buildLlmWindow(session.messages);
    const tools = Object.values(conversationTools).map((tool) => tool.definition);
    const persisted: StoredMessage[] = [];

    let booking: BookingResult | undefined;
    let finalReply = '';

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const result = await llmClient.chat({ system, messages, tools });

      if (result.toolCalls.length === 0) {
        finalReply = result.text || 'How can I help you further?';
        break;
      }

      const assistantMessage: StoredMessage = {
        role: 'assistant',
        content: result.text || '',
        toolCalls: result.toolCalls
      };
      messages.push(assistantMessage);
      persisted.push(assistantMessage);

      for (const toolCall of result.toolCalls) {
        let toolMessage: StoredMessage;
        try {
          const toolResult = await this.executeTool(toolCall.name, toolCall.input);
          if (toolResult.booking) {
            booking = toolResult.booking;
          }
          toolMessage = { role: 'tool', content: toolResult.output, toolCallId: toolCall.id, name: toolCall.name };
        } catch (error) {
          logger.warn({ err: error, toolCall }, 'Conversation tool execution failed');
          const message = error instanceof AppError ? error.message : 'A tool failed unexpectedly.';
          toolMessage = {
            role: 'tool',
            content: JSON.stringify({ error: true, message }),
            toolCallId: toolCall.id,
            name: toolCall.name
          };
        }
        messages.push(toolMessage);
        persisted.push(toolMessage);
      }

      // Once the booking is created, confirm it deterministically instead of making another
      // LLM round-trip (which could be rate-limited and would only restate the result).
      if (booking) {
        finalReply = buildBookingConfirmation(booking);
        break;
      }
    }

    if (!finalReply) {
      finalReply = 'I can help with clinic information and booking appointments. What would you like to do?';
    }

    session.messages.push(...persisted, { role: 'assistant', content: finalReply });

    return {
      conversationId: session.id,
      reply: finalReply,
      booking
    };
  }
}

export const conversationService = new ConversationService();
