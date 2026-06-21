export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatMessageInput {
  role: ChatRole;
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: ChatToolCall[];
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type LlmToolCall = ChatToolCall;

export interface LlmChatParams {
  system: string;
  messages: ChatMessageInput[];
  tools: LlmToolDefinition[];
}

export interface LlmChatResult {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  chat(params: LlmChatParams): Promise<LlmChatResult>;
}
