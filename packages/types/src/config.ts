import { z } from 'zod';

export const CircuitBreakerConfigSchema = z.object({
  max_daily_spend: z.number().positive(),
  max_loops_per_hour: z.number().int().positive(),
});

export const ProviderConfigSchema = z.object({
  type: z.enum(['bedrock', 'anthropic', 'openai']),
  model: z.string(),
  region: z.string().optional(),
  apiKey: z.string().optional(),
});

export const McpServerConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
});

export const GatewayConfigSchema = z.object({
  port: z.number().int().default(3100),
  origin_allowlist: z.array(z.string()).default(['http://localhost:3000']),
  providers: z.array(ProviderConfigSchema).min(1),
  active_provider: z.string(),
  circuit_breaker: CircuitBreakerConfigSchema,
  mcp_servers: z.array(McpServerConfigSchema).default([]),
  sandbox: z.object({
    cpu_limit: z.number().default(1),
    memory_limit: z.string().default('512m'),
    timeout_ms: z.number().int().default(30000),
    host_network: z.boolean().default(false),
  }).default({}),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
