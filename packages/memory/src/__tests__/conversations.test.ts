import { describe, it, expect, afterEach } from 'vitest';
import { MemoryStore } from '../store.js';
import { ConversationStore } from '../conversations.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('ConversationStore', () => {
  const testDir = path.join(os.tmpdir(), 'crevnclaw-conv-' + Date.now());
  let memStore: MemoryStore;
  let convStore: ConversationStore;

  afterEach(() => {
    memStore?.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('stores and retrieves conversation turns', () => {
    memStore = new MemoryStore(testDir);
    convStore = new ConversationStore(memStore.getDb());
    convStore.addTurn('session-1', 'user', 'Hello', {});
    convStore.addTurn('session-1', 'assistant', 'Hi there!', {});
    const turns = convStore.getSession('session-1');
    expect(turns).toHaveLength(2);
    expect(turns[0].role).toBe('user');
    expect(turns[1].content).toBe('Hi there!');
  });
});
