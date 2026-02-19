import type Database from 'better-sqlite3';
import type { ConversationTurn } from '@crevnclaw/types';

export class ConversationStore {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private getSessionStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = db.prepare(
      'INSERT INTO conversations (session_id, role, content, metadata) VALUES (?, ?, ?, ?)'
    );
    this.getSessionStmt = db.prepare(
      'SELECT * FROM conversations WHERE session_id = ? ORDER BY id ASC'
    );
  }

  addTurn(sessionId: string, role: string, content: string, metadata: Record<string, unknown>): void {
    this.insertStmt.run(sessionId, role, content, JSON.stringify(metadata));
  }

  getSession(sessionId: string): ConversationTurn[] {
    const rows = this.getSessionStmt.all(sessionId) as any[];
    return rows.map(r => ({
      ...r,
      metadata: JSON.parse(r.metadata),
    }));
  }
}
