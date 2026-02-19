export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatResponse {
  content: string;
  tool_calls?: ToolCall[];
  usage: { input_tokens: number; output_tokens: number };
  model: string;
  provider: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  usage: { tokens: number };
}

export interface LLMProvider {
  readonly name: string;
  chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<ChatResponse>;
  streamChat(messages: ChatMessage[], tools?: ToolDefinition[]): AsyncIterable<string>;
  embed(text: string): Promise<EmbeddingResponse>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
