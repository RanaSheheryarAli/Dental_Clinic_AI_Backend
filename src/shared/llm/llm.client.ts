import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';
import { AnthropicProvider } from './llm.anthropic.js';
import { GroqProvider } from './llm.groq.js';
import type { ChatMessageInput, LlmChatParams, LlmChatResult, LlmProvider } from './llm.types.js';

/**
 * Deterministic reply used when no LLM provider is configured, or when a provider call fails.
 * Keeps the assistant responsive instead of returning an error to the channel.
 */
function buildFallbackResponse(messages: ChatMessageInput[]): LlmChatResult {
  const latestUserMessage =
    [...messages].reverse().find((message) => message.role === 'user')?.content.toLowerCase() ?? '';

  if (
    latestUserMessage.includes('book') ||
    latestUserMessage.includes('appointment') ||
    latestUserMessage.includes('slot')
  ) {
    return {
      text: 'I can help with booking. Please tell me the service you want, your preferred date, and optionally the dentist.',
      toolCalls: []
    };
  }

  return {
    text: 'I can help with clinic information, available appointment times, and booking support.',
    toolCalls: []
  };
}

type ProviderName = 'anthropic' | 'groq';

function resolveProvider(): { name: ProviderName; provider: LlmProvider } | null {
  if (env.ANTHROPIC_API_KEY) {
    return { name: 'anthropic', provider: new AnthropicProvider() };
  }
  if (env.GROQ_API_KEY) {
    return { name: 'groq', provider: new GroqProvider() };
  }
  return null;
}

export class LlmClient {
  private readonly resolved = resolveProvider();

  hasProvider() {
    return this.resolved !== null;
  }

  providerName(): ProviderName | 'none' {
    return this.resolved?.name ?? 'none';
  }

  async chat(params: LlmChatParams): Promise<LlmChatResult> {
    if (!this.resolved) {
      return buildFallbackResponse(params.messages);
    }

    // One retry with a short backoff absorbs transient provider errors (e.g. free-tier
    // rate limits / 5xx) so a single hiccup mid-conversation does not drop to the fallback.
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.resolved.provider.chat(params);
      } catch (error) {
        if (attempt < maxAttempts) {
          logger.warn({ err: error, provider: this.resolved.name, attempt }, 'LLM request failed; retrying');
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        logger.error({ err: error, provider: this.resolved.name }, 'LLM request failed; using fallback response');
        return buildFallbackResponse(params.messages);
      }
    }

    return buildFallbackResponse(params.messages);
  }
}

export const llmClient = new LlmClient();
