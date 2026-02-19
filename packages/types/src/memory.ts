export interface Fact {
  id: number;
  content: string;
  embedding?: Float32Array;
  metadata: {
    source: string;
    timestamp: string;
    confidence: number;
  };
}

export interface ConversationTurn {
  id: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  provider: string;
  model: string;
  created_at: string;
}
