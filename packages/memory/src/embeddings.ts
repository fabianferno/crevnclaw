import type Database from 'better-sqlite3';

export class VectorStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  addFact(content: string, embedding: Float32Array, metadata: Record<string, unknown>): void {
    this.db.prepare(
      'INSERT INTO vectors (content, embedding, metadata) VALUES (?, ?, ?)'
    ).run(content, Buffer.from(embedding.buffer), JSON.stringify(metadata));
  }
}
