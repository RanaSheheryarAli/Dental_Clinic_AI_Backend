import axios from 'axios';
import { env } from '../../config/env.js';
import type { LlmChatParams, LlmChatResult, LlmProvider, LlmToolCall } from './llm.types.js';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Groq provider — OpenAI-compatible chat-completions API with function calling.
 * Used as the free fallback when no Anthropic key is configured.
 */
export class GroqProvider implements LlmProvider {
  async chat(params: LlmChatParams): Promise<LlmChatResult> {
    const response = await axios.post(
      GROQ_CHAT_URL,
      {
        model: env.GROQ_MODEL,
        temperature: 0.2,
        tool_choice: 'auto',
        messages: [
          { role: 'system', content: params.system },
          ...params.messages.map((message) => {
            if (message.role === 'tool') {
              return {
                role: 'tool',
                tool_call_id: message.toolCallId,
                name: message.name,
                content: message.content
              };
            }

            if (message.role === 'assistant' && message.toolCalls) {
              return {
                role: 'assistant',
                content: message.content,
                tool_calls: message.toolCalls.map((toolCall) => ({
                  id: toolCall.id,
                  type: 'function',
                  function: {
                    name: toolCall.name,
                    arguments: JSON.stringify(toolCall.input)
                  }
                }))
              };
            }

            return {
              role: message.role,
              content: message.content
            };
          })
        ],
        tools: params.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        }))
      },
      {
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const message = response.data?.choices?.[0]?.message;
    const toolCalls: LlmToolCall[] = Array.isArray(message?.tool_calls)
      ? message.tool_calls.map((toolCall: { id: string; function: { name: string; arguments: string } }) => ({
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>
        }))
      : [];

    return {
      text: typeof message?.content === 'string' ? message.content.trim() : '',
      toolCalls
    };
  }
}
