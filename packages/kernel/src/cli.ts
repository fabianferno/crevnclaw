#!/usr/bin/env node

import { loadConfig } from './config.js';
import { GatewayServer } from './server.js';
import { Scheduler, Lane } from './scheduler.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { MessageRouter } from './router.js';
import { createProvider } from './providers/index.js';
import { generate as generatePairingToken } from './pairing.js';
import crypto from 'node:crypto';
import path from 'node:path';

async function main() {
  const baseDir = process.env.CREVNCLAW_HOME ?? process.cwd();

  // Load config
  console.log(`Loading config from ${baseDir}/config.json`);
  const config = loadConfig(baseDir);

  // Generate JWT secret
  const jwtSecret = process.env.JWT_SECRET ?? crypto.randomBytes(32).toString('hex');

  // Create pairing token
  const pairingToken = generatePairingToken({
    jwtSecret,
    baseDir,
    expiresIn: '24h',
  });
  console.log(`Pairing token written to ${path.join(baseDir, '.pairing-token')}`);

  // Create provider
  const providerConfig = config.providers.find(p => p.type === config.active_provider);
  if (!providerConfig) {
    console.error(`Active provider '${config.active_provider}' not found in providers list`);
    process.exit(1);
  }
  const provider = createProvider(providerConfig);
  console.log(`LLM provider: ${provider.name}`);

  // Create scheduler
  const scheduler = new Scheduler();
  scheduler.on('error', (err) => {
    console.error('Scheduler error:', err);
  });

  // Create router
  const router = new MessageRouter();
  router.on('error', (err) => {
    console.error('Router error:', err);
  });

  // Create server
  const server = new GatewayServer({
    port: config.port,
    jwtSecret,
    originAllowlist: config.origin_allowlist,
  });

  server.on('connection', (_ws, _req) => {
    console.log(`Client connected (total: ${server.getClientCount()})`);
  });

  server.on('disconnect', () => {
    console.log(`Client disconnected (total: ${server.getClientCount()})`);
  });

  server.on('message', (message, _ws) => {
    scheduler.enqueue(Lane.Interactive, async () => {
      router.route(message);
    });
    scheduler.flush().catch(err => console.error('Flush error:', err));
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await server.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  server.start();
  console.log(`CrevnClaw Gateway listening on ws://localhost:${config.port}`);
  console.log(`Connect with token: ${pairingToken.slice(0, 20)}...`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
