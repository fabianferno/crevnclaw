import { GatewayConfigSchema, type GatewayConfig } from '@crevnclaw/types';
import fs from 'node:fs';
import path from 'node:path';

export function loadConfig(baseDir: string): GatewayConfig {
  const configPath = path.join(baseDir, 'config.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return GatewayConfigSchema.parse(raw);
}
