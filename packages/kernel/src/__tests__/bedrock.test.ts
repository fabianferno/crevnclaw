import { describe, it, expect, vi } from 'vitest';
import { BedrockProvider } from '../providers/bedrock.js';
import { createProvider } from '../providers/index.js';

// Mock the AWS SDK client
function createMockClient(responseBody: Record<string, unknown>) {
  return {
    send: vi.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(responseBody)),
    }),
  } as any;
}

describe('BedrockProvider', () => {
  it('sends chat request and parses text response', async () => {
    const mockResponse = {
      content: [{ type: 'text', text: 'Hello, world!' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    const mockClient = createMockClient(mockResponse);

    const provider = new BedrockProvider(
      { model: 'anthropic.claude-3-5-sonnet-20241022-v2:0', region: 'us-east-1' },
      mockClient,
    );

    const response = await provider.chat([
      { role: 'user', content: 'Hi there' },
    ]);

    expect(response.content).toBe('Hello, world!');
    expect(response.usage.input_tokens).toBe(10);
    expect(response.usage.output_tokens).toBe(5);
    expect(response.model).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
    expect(response.provider).toBe('bedrock');
    expect(mockClient.send).toHaveBeenCalledOnce();
  });

  it('parses tool use response', async () => {
    const mockResponse = {
      content: [
        { type: 'text', text: 'I will call the tool.' },
        {
          type: 'tool_use',
          id: 'tool-123',
          name: 'search',
          input: { query: 'test query' },
        },
      ],
      usage: { input_tokens: 20, output_tokens: 15 },
    };
    const mockClient = createMockClient(mockResponse);

    const provider = new BedrockProvider(
      { model: 'anthropic.claude-3-5-sonnet-20241022-v2:0', region: 'us-east-1' },
      mockClient,
    );

    const response = await provider.chat(
      [{ role: 'user', content: 'Search for something' }],
      [{ name: 'search', description: 'Search tool', input_schema: { type: 'object' } }],
    );

    expect(response.tool_calls).toHaveLength(1);
    expect(response.tool_calls![0].id).toBe('tool-123');
    expect(response.tool_calls![0].name).toBe('search');
    expect(JSON.parse(response.tool_calls![0].arguments)).toEqual({ query: 'test query' });
  });

  it('includes system messages in request', async () => {
    const mockResponse = {
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    };
    const mockClient = createMockClient(mockResponse);

    const provider = new BedrockProvider(
      { model: 'anthropic.claude-3-5-sonnet-20241022-v2:0', region: 'us-east-1' },
      mockClient,
    );

    await provider.chat([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
    ]);

    const sentCommand = mockClient.send.mock.calls[0][0];
    const rawBody = sentCommand.input.body;
    const body = JSON.parse(typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody));
    expect(body.system).toBe('You are a helpful assistant.');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('sends embed request', async () => {
    const mockResponse = {
      embedding: [0.1, 0.2, 0.3],
      inputTextTokenCount: 5,
    };
    const mockClient = createMockClient(mockResponse);

    const provider = new BedrockProvider(
      { model: 'anthropic.claude-3-5-sonnet-20241022-v2:0', region: 'us-east-1' },
      mockClient,
    );

    const response = await provider.embed('test text');

    expect(response.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(response.usage.tokens).toBe(5);
  });

  it('has name property set to bedrock', () => {
    const provider = new BedrockProvider(
      { model: 'test-model', region: 'us-east-1' },
      createMockClient({}),
    );
    expect(provider.name).toBe('bedrock');
  });
});

describe('createProvider', () => {
  it('creates a BedrockProvider for bedrock type', () => {
    const provider = createProvider({
      type: 'bedrock',
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      region: 'us-east-1',
    });
    expect(provider.name).toBe('bedrock');
  });

  it('throws if bedrock config missing region', () => {
    expect(() =>
      createProvider({ type: 'bedrock', model: 'test-model' })
    ).toThrow('Bedrock provider requires a region');
  });

  it('throws for unimplemented provider types', () => {
    expect(() =>
      createProvider({ type: 'anthropic', model: 'claude-3' })
    ).toThrow('not yet implemented');

    expect(() =>
      createProvider({ type: 'openai', model: 'gpt-4' })
    ).toThrow('not yet implemented');
  });
});
