import { describe, it, expect, afterEach } from 'vitest';
import { MemoryStore } from '../store.js';
import { VectorStore } from '../embeddings.js';
import { Retriever } from '../retrieval.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('RAG Retrieval', () => {
  const testDir = path.join(os.tmpdir(), 'crevnclaw-rag-' + Date.now());
  let memStore: MemoryStore;

  afterEach(() => {
    memStore?.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('stores facts and retrieves by similarity', () => {
    memStore = new MemoryStore(testDir);
    const vectorStore = new VectorStore(memStore.getDb());
    const retriever = new Retriever(memStore.getDb());
    vectorStore.addFact('The sky is blue', new Float32Array([1, 0, 0]), { source: 'test', timestamp: new Date().toISOString(), confidence: 1.0 });
    vectorStore.addFact('Water is wet', new Float32Array([0, 1, 0]), { source: 'test', timestamp: new Date().toISOString(), confidence: 1.0 });
    const results = retriever.search(new Float32Array([0.9, 0.1, 0]), 1);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('The sky is blue');
  });
});
