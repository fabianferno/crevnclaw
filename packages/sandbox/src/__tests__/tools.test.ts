import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../tools.js';

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'shell',
      description: 'Run a shell command',
      input_schema: { type: 'object', properties: { command: { type: 'string' } } },
      image: 'alpine:latest',
      command: ['sh', '-c'],
      env: 'docker',
    });
    const tool = registry.get('shell');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('shell');
  });

  it('lists all tools as MCP-compatible definitions', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'python',
      description: 'Run Python code',
      input_schema: { type: 'object', properties: { code: { type: 'string' } } },
      image: 'python:3.12-slim',
      command: ['python', '-c'],
      env: 'docker',
    });
    const tools = registry.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toHaveProperty('name');
    expect(tools[0]).toHaveProperty('description');
    expect(tools[0]).toHaveProperty('input_schema');
  });
});
