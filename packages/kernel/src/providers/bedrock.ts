import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  LLMProvider,
  ChatMessage,
  ChatResponse,
  EmbeddingResponse,
  ToolDefinition,
} from '@crevnclaw/types';

export interface BedrockProviderConfig {
  model: string;
  region: string;
}

export class BedrockProvider implements LLMProvider {
  readonly name = 'bedrock';
  private client: BedrockRuntimeClient;
  private model: string;

  constructor(config: BedrockProviderConfig, client?: BedrockRuntimeClient) {
    this.model = config.model;
    this.client = client ?? new BedrockRuntimeClient({ region: config.region });
  }

  async chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<ChatResponse> {
    const body = this.buildRequestBody(messages, tools);

    const command = new InvokeModelCommand({
      modelId: this.model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return this.parseResponse(responseBody);
  }

  async *streamChat(messages: ChatMessage[], tools?: ToolDefinition[]): AsyncIterable<string> {
    const body = this.buildRequestBody(messages, tools);

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    });

    const response = await this.client.send(command);

    if (response.body) {
      for await (const event of response.body) {
        if (event.chunk?.bytes) {
          const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            yield chunk.delta.text;
          }
        }
      }
    }
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v2:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text,
      }),
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      embedding: responseBody.embedding,
      usage: { tokens: responseBody.inputTextTokenCount ?? 0 },
    };
  }

  private buildRequestBody(messages: ChatMessage[], tools?: ToolDefinition[]): Record<string, unknown> {
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: nonSystemMessages.map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.tool_call_id
          ? [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }]
          : m.content,
      })),
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map(m => m.content).join('\n');
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
    }

    return body;
  }

  private parseResponse(responseBody: Record<string, unknown>): ChatResponse {
    const content = responseBody.content as Array<Record<string, unknown>>;
    let textContent = '';
    const toolCalls: { id: string; name: string; arguments: string }[] = [];

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text') {
          textContent += block.text as string;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id as string,
            name: block.name as string,
            arguments: JSON.stringify(block.input),
          });
        }
      }
    }

    const usage = responseBody.usage as { input_tokens: number; output_tokens: number } | undefined;

    return {
      content: textContent,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        input_tokens: usage?.input_tokens ?? 0,
        output_tokens: usage?.output_tokens ?? 0,
      },
      model: this.model,
      provider: this.name,
    };
  }
}
