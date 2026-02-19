import { describe, it, expect } from 'vitest';
import { McpHost } from '../mcp.js';

describe('McpHost', () => {
  it('initializes with empty tool list', () => {
    const host = new McpHost();
    expect(host.listAllTools()).toEqual([]);
  });

  it('tracks server connections', async () => {
    const host = new McpHost();
    // Just test the interface exists
    expect(typeof host.connect).toBe('function');
    expect(typeof host.callTool).toBe('function');
    expect(typeof host.disconnectAll).toBe('function');
    await host.disconnectAll();
  });
});
