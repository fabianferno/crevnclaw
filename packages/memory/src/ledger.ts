import type Database from 'better-sqlite3';
import type { LedgerEntry } from '@crevnclaw/types';

export class Ledger {
  private db: Database.Database;
  private insertStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = db.prepare(
      'INSERT INTO ledger (cost_usd, tokens_in, tokens_out, provider, model) VALUES (?, ?, ?, ?, ?)'
    );
  }

  record(entry: Omit<LedgerEntry, 'id' | 'created_at'>): void {
    this.insertStmt.run(entry.cost_usd, entry.tokens_in, entry.tokens_out, entry.provider, entry.model);
  }

  getDailySpend(): number {
    const row = this.db.prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) as total FROM ledger WHERE date(created_at) = date('now')"
    ).get() as { total: number };
    return row.total;
  }

  getHourlyLoopCount(): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as count FROM ledger WHERE created_at >= datetime('now', '-1 hour')"
    ).get() as { count: number };
    return row.count;
  }
}
