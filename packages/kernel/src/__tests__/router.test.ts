import { describe, it, expect, vi } from 'vitest';
import { MessageRouter } from '../router.js';

function makeMessage(type: string, payload: Record<string, unknown> = {}) {
  return {
    type,
    id: 'msg-1',
    timestamp: new Date().toISOString(),
    payload,
  };
}

describe('MessageRouter', () => {
  it('routes valid messages to type-specific handlers', () => {
    const router = new MessageRouter();
    const chatHandler = vi.fn();
    router.onType('chat', chatHandler);

    const msg = makeMessage('chat', { text: 'hello' });
    router.route(msg);

    expect(chatHandler).toHaveBeenCalledOnce();
    expect(chatHandler).toHaveBeenCalledWith(expect.objectContaining({ type: 'chat' }));
  });

  it('routes messages to wildcard handler', () => {
    const router = new MessageRouter();
    const wildcardHandler = vi.fn();
    router.on('*', wildcardHandler);

    router.route(makeMessage('chat'));
    router.route(makeMessage('thought'));

    expect(wildcardHandler).toHaveBeenCalledTimes(2);
  });

  it('emits error for invalid messages', () => {
    const router = new MessageRouter();
    const errorHandler = vi.fn();
    router.on('error', errorHandler);

    router.route({ invalid: 'message' });

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('does not emit for unregistered message types', () => {
    const router = new MessageRouter();
    const chatHandler = vi.fn();
    router.onType('chat', chatHandler);

    router.route(makeMessage('thought'));

    expect(chatHandler).not.toHaveBeenCalled();
  });

  it('supports removing handlers with offType', () => {
    const router = new MessageRouter();
    const handler = vi.fn();
    router.onType('chat', handler);

    router.route(makeMessage('chat'));
    expect(handler).toHaveBeenCalledOnce();

    router.offType('chat', handler);
    router.route(makeMessage('chat'));
    expect(handler).toHaveBeenCalledOnce(); // still 1, not 2
  });

  it('routes all standard message types', () => {
    const router = new MessageRouter();
    const handlers: Record<string, ReturnType<typeof vi.fn>> = {};

    const types = [
      'thought', 'tool_call', 'tool_result', 'approval_request',
      'approval_response', 'bankrupt', 'panic', 'chat', 'status',
    ];

    for (const type of types) {
      handlers[type] = vi.fn();
      router.onType(type as any, handlers[type]);
    }

    for (const type of types) {
      router.route(makeMessage(type));
    }

    for (const type of types) {
      expect(handlers[type]).toHaveBeenCalledOnce();
    }
  });
});
