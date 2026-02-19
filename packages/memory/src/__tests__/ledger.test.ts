import { describe, it, expect, afterEach } from 'vitest';
import { MemoryStore } from '../store.js';
import { Ledger } from '../ledger.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('Ledger', () => {
  const testDir = path.join(os.tmpdir(), 'crevnclaw-ledger-' + Date.now());
  let memStore: MemoryStore;
  let ledger: Ledger;

  afterEach(() => {
    memStore?.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('tracks spend and computes daily total', () => {
    memStore = new MemoryStore(testDir);
    ledger = new Ledger(memStore.getDb());
    ledger.record({ cost_usd: 0.01, tokens_in: 100, tokens_out: 50, provider: 'bedrock', model: 'claude-v3' });
    ledger.record({ cost_usd: 0.02, tokens_in: 200, tokens_out: 100, provider: 'bedrock', model: 'claude-v3' });
    const daily = ledger.getDailySpend();
    expect(daily).toBeCloseTo(0.03);
  });
});
