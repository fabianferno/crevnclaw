import { describe, it, expect, afterEach } from 'vitest';
import { MemoryStore } from '../store.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('MemoryStore', () => {
  const testDir = path.join(os.tmpdir(), 'crevnclaw-test-' + Date.now());
  let store: MemoryStore;

  afterEach(() => {
    store?.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates database with all tables', () => {
    store = new MemoryStore(testDir);
    const tables = store.listTables();
    expect(tables).toContain('vectors');
    expect(tables).toContain('conversations');
    expect(tables).toContain('ledger');
  });
});
