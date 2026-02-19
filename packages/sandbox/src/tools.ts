import type { ToolRegistryEntry, ToolDefinition } from '@crevnclaw/types';

export class ToolRegistry {
  private tools = new Map<string, ToolRegistryEntry>();

  register(tool: ToolRegistryEntry): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolRegistryEntry | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolDefinition[] {
    return [...this.tools.values()].map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
