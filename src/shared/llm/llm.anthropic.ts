import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import type { ChatMessageInput, LlmChatParams, LlmChatResult, LlmProvider, LlmToolCall } from './llm.types.js';

const MAX_OUTPUT_TOKENS = 1024;

/**
 * Anthropic (Claude) provider. Used as the primary engine whenever ANTHROPIC_API_KEY is set.
 *
 * The unified message format is OpenAI-shaped (assistant `tool_calls` + `tool` role messages),
 * so we translate it into Anthropic's block format: tool calls become `tool_use` blocks on the
 * assistant turn, and consecutive tool results are coalesced into a single following user turn
 * (Anthropic requires every tool_result for an assistant turn to arrive together in one user message).
 */
export class AnthropicProvider implements LlmProvider {
  private readonly client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  private toAnthropicMessages(messages: ChatMessageInput[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];
    let pendingToolResults: Anthropic.ToolResultBlockParam[] = [];

    const flushToolResults = () => {
      if (pendingToolResults.length > 0) {
        result.push({ role: 'user', content: pendingToolResults });
        pendingToolResults = [];
      }
    };

    for (const message of messages) {
      if (message.role === 'tool') {
        pendingToolResults.push({
          type: 'tool_result',
          tool_use_id: message.toolCallId ?? '',
          content: message.content
        });
        continue;
      }

      flushToolResults();

      if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
        const blocks: Anthropic.ContentBlockParam[] = [];
        if (message.content) {
          blocks.push({ type: 'text', text: message.content });
        }
        for (const toolCall of message.toolCalls) {
          blocks.push({ type: 'tool_use', id: toolCall.id, name: toolCall.name, input: toolCall.input });
        }
        result.push({ role: 'assistant', content: blocks });
        continue;
      }

      result.push({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      });
    }

    flushToolResults();

    return result;
  }

  async chat(params: LlmChatParams): Promise<LlmChatResult> {
    const response = await this.client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: params.system,
      messages: this.toAnthropicMessages(params.messages),
      tools: params.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Anthropic.Tool.InputSchema
      }))
    });

    let text = '';
    const toolCalls: LlmToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>
        });
      }
    }

    return {
      text: text.trim(),
      toolCalls
    };
  }
}
