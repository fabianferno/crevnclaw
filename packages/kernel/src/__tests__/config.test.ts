import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Config Loader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads a valid config file', () => {
    const config = {
      port: 3100,
      origin_allowlist: ['http://localhost:3000'],
      providers: [{ type: 'bedrock', model: 'anthropic.claude-3-5-sonnet-20241022-v2:0', region: 'us-east-1' }],
      active_provider: 'bedrock',
      circuit_breaker: { max_daily_spend: 10, max_loops_per_hour: 100 },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(config));

    const result = loadConfig(tmpDir);

    expect(result.port).toBe(3100);
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].type).toBe('bedrock');
    expect(result.active_provider).toBe('bedrock');
    expect(result.circuit_breaker.max_daily_spend).toBe(10);
  });

  it('applies default values for optional fields', () => {
    const config = {
      providers: [{ type: 'anthropic', model: 'claude-3-5-sonnet' }],
      active_provider: 'anthropic',
      circuit_breaker: { max_daily_spend: 5, max_loops_per_hour: 50 },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(config));

    const result = loadConfig(tmpDir);

    expect(result.port).toBe(3100);
    expect(result.origin_allowlist).toEqual(['http://localhost:3000']);
    expect(result.mcp_servers).toEqual([]);
    expect(result.sandbox.cpu_limit).toBe(1);
    expect(result.sandbox.memory_limit).toBe('512m');
    expect(result.sandbox.timeout_ms).toBe(30000);
  });

  it('throws on invalid config (missing required fields)', () => {
    const config = { port: 3100 };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(config));

    expect(() => loadConfig(tmpDir)).toThrow();
  });

  it('throws on missing config file', () => {
    expect(() => loadConfig(tmpDir)).toThrow();
  });

  it('throws on malformed JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), 'not json at all {{{');
    expect(() => loadConfig(tmpDir)).toThrow();
  });

  it('rejects invalid provider type', () => {
    const config = {
      providers: [{ type: 'invalid-provider', model: 'some-model' }],
      active_provider: 'invalid',
      circuit_breaker: { max_daily_spend: 5, max_loops_per_hour: 50 },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(config));

    expect(() => loadConfig(tmpDir)).toThrow();
  });
});
