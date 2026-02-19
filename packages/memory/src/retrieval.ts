import type Database from 'better-sqlite3';
import type { Fact } from '@crevnclaw/types';

export class Retriever {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  search(queryEmbedding: Float32Array, topK: number = 5): Fact[] {
    const rows = this.db.prepare('SELECT * FROM vectors').all() as any[];
    const scored = rows.map(row => {
      const stored = new Float32Array(new Uint8Array(row.embedding).buffer);
      const score = this.cosineSimilarity(queryEmbedding, stored);
      return { ...row, metadata: JSON.parse(row.metadata), score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
