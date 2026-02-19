import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import type { McpServerConfig, ToolDefinition } from '@crevnclaw/types';

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

export class McpHost extends EventEmitter {
  private servers: Map<string, ChildProcess> = new Map();
  private tools: Map<string, { server: string; definition: ToolDefinition }> = new Map();
  private nextId = 1;

  async connect(config: McpServerConfig): Promise<ToolDefinition[]> {
    const proc = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.servers.set(config.name, proc);

    // Initialize MCP connection
    const initResponse = await this.sendRequest(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'crevnclaw', version: '0.1.0' },
    });

    // Send initialized notification
    this.sendNotification(proc, 'notifications/initialized', {});

    // List tools
    const toolsResponse = await this.sendRequest(proc, 'tools/list', {});
    const tools = (toolsResponse as any)?.tools || [];

    for (const tool of tools) {
      const def: ToolDefinition = {
        name: tool.name,
        description: tool.description || '',
        input_schema: tool.inputSchema || {},
      };
      this.tools.set(`${config.name}:${tool.name}`, { server: config.name, definition: def });
    }

    return tools.map((t: any) => ({
      name: t.name,
      description: t.description || '',
      input_schema: t.inputSchema || {},
    }));
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const proc = this.servers.get(serverName);
    if (!proc) throw new Error(`MCP server not connected: ${serverName}`);

    const result = await this.sendRequest(proc, 'tools/call', {
      name: toolName,
      arguments: args,
    });

    return result;
  }

  listAllTools(): ToolDefinition[] {
    return [...this.tools.values()].map(t => t.definition);
  }

  async disconnectAll(): Promise<void> {
    for (const [name, proc] of this.servers) {
      proc.kill();
      this.servers.delete(name);
    }
    this.tools.clear();
  }

  private sendRequest(proc: ChildProcess, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const msg: JsonRpcMessage = { jsonrpc: '2.0', id, method, params };

      const handler = (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const response: JsonRpcMessage = JSON.parse(line);
            if (response.id === id) {
              proc.stdout?.off('data', handler);
              if (response.error) {
                reject(new Error(response.error.message));
              } else {
                resolve(response.result);
              }
              return;
            }
          } catch {}
        }
      };

      proc.stdout?.on('data', handler);
      proc.stdin?.write(JSON.stringify(msg) + '\n');

      setTimeout(() => {
        proc.stdout?.off('data', handler);
        reject(new Error(`MCP request timeout: ${method}`));
      }, 10000);
    });
  }

  private sendNotification(proc: ChildProcess, method: string, params: unknown): void {
    const msg: JsonRpcMessage = { jsonrpc: '2.0', method, params };
    proc.stdin?.write(JSON.stringify(msg) + '\n');
  }
}
