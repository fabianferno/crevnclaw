# CrevnClaw Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first autonomous agent OS with Gateway Kernel, Docker sandbox, vector memory, and Mission Control dashboard.

**Architecture:** Modular pnpm monorepo with 5 packages (@crevnclaw/types, kernel, sandbox, memory, dashboard). Gateway Kernel orchestrates sandbox execution and memory via typed event bus. Dashboard connects via WebSocket + tRPC.

**Tech Stack:** Node.js 22+, TypeScript (ESM), pnpm workspaces, better-sqlite3 + sqlite-vec, dockerode, ws, Next.js 15, tRPC, Zod, Vitest

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/kernel/package.json`
- Create: `packages/kernel/tsconfig.json`
- Create: `packages/sandbox/package.json`
- Create: `packages/sandbox/tsconfig.json`
- Create: `packages/memory/package.json`
- Create: `packages/memory/tsconfig.json`
- Create: `packages/dashboard/package.json`
- Create: `packages/dashboard/tsconfig.json`

**Step 1: Create root workspace files**

`package.json`:
```json
{
  "name": "crevnclaw",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev": "pnpm -r --parallel dev",
    "lint": "pnpm -r lint"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

`.npmrc`:
```
shamefully-hoist=false
strict-peer-dependencies=false
```

`.gitignore`:
```
node_modules/
dist/
.next/
*.db
*.db-journal
.env
.env.local
.lobster/frozen_states/
.sandbox/
```

**Step 2: Create each package scaffold**

Each package gets a `package.json` and `tsconfig.json`. Example for types:

`packages/types/package.json`:
```json
{
  "name": "@crevnclaw/types",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "dependencies": {
    "zod": "^3.24.0"
  }
}
```

`packages/types/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

For kernel, sandbox, memory — same pattern but add `@crevnclaw/types` as dependency:
```json
"dependencies": {
  "@crevnclaw/types": "workspace:*"
}
```

**Step 3: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, no errors

**Step 4: Create src/index.ts stubs for each package**

Each package gets `src/index.ts` with `export {}` placeholder.

**Step 5: Verify build**

Run: `pnpm build`
Expected: all packages compile, dist/ folders created

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold monorepo with pnpm workspaces"
```

---

## Task 2: Shared Types (@crevnclaw/types)

**Files:**
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/config.ts`
- Create: `packages/types/src/messages.ts`
- Create: `packages/types/src/providers.ts`
- Create: `packages/types/src/memory.ts`
- Create: `packages/types/src/sandbox.ts`
- Create: `packages/types/src/workflow.ts`

**Step 1: Define config schemas**

`packages/types/src/config.ts`:
```typescript
import { z } from 'zod';

export const CircuitBreakerConfigSchema = z.object({
  max_daily_spend: z.number().positive(),
  max_loops_per_hour: z.number().int().positive(),
});

export const ProviderConfigSchema = z.object({
  type: z.enum(['bedrock', 'anthropic', 'openai']),
  model: z.string(),
  region: z.string().optional(),
  apiKey: z.string().optional(),
});

export const McpServerConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
});

export const GatewayConfigSchema = z.object({
  port: z.number().int().default(3100),
  origin_allowlist: z.array(z.string()).default(['http://localhost:3000']),
  providers: z.array(ProviderConfigSchema).min(1),
  active_provider: z.string(),
  circuit_breaker: CircuitBreakerConfigSchema,
  mcp_servers: z.array(McpServerConfigSchema).default([]),
  sandbox: z.object({
    cpu_limit: z.number().default(1),
    memory_limit: z.string().default('512m'),
    timeout_ms: z.number().int().default(30000),
    host_network: z.boolean().default(false),
  }).default({}),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
```

**Step 2: Define message types**

`packages/types/src/messages.ts`:
```typescript
import { z } from 'zod';

export const WSMessageTypeSchema = z.enum([
  'thought', 'tool_call', 'tool_result', 'approval_request',
  'approval_response', 'bankrupt', 'panic', 'chat', 'status',
]);

export const WSMessageSchema = z.object({
  type: WSMessageTypeSchema,
  id: z.string(),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
});

export type WSMessageType = z.infer<typeof WSMessageTypeSchema>;
export type WSMessage = z.infer<typeof WSMessageSchema>;
```

**Step 3: Define provider interface**

`packages/types/src/providers.ts`:
```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatResponse {
  content: string;
  tool_calls?: ToolCall[];
  usage: { input_tokens: number; output_tokens: number };
  model: string;
  provider: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  usage: { tokens: number };
}

export interface LLMProvider {
  readonly name: string;
  chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<ChatResponse>;
  streamChat(messages: ChatMessage[], tools?: ToolDefinition[]): AsyncIterable<string>;
  embed(text: string): Promise<EmbeddingResponse>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
```

**Step 4: Define memory types**

`packages/types/src/memory.ts`:
```typescript
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
```

**Step 5: Define sandbox types**

`packages/types/src/sandbox.ts`:
```typescript
export type ExecutionEnvironment = 'docker';

export interface ToolRegistryEntry {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  image: string;
  command: string[];
  env: ExecutionEnvironment;
  timeout_ms?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}
```

**Step 6: Define workflow types**

`packages/types/src/workflow.ts`:
```typescript
export type WorkflowStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'action' | 'approval' | 'conditional';
  action?: string;
  args?: Record<string, unknown>;
  next?: string;
  on_approve?: string;
  on_reject?: string;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowState {
  workflow_name: string;
  current_step: string;
  status: WorkflowStatus;
  context: Record<string, unknown>;
  frozen_at?: string;
}
```

**Step 7: Create barrel export**

`packages/types/src/index.ts` re-exports everything.

**Step 8: Build and commit**

Run: `pnpm --filter @crevnclaw/types build`

```bash
git add -A && git commit -m "feat: add shared type definitions and Zod schemas"
```

---

## Task 3: SQLite Store & Migrations (@crevnclaw/memory)

**Files:**
- Create: `packages/memory/src/store.ts`
- Create: `packages/memory/src/index.ts`
- Test: `packages/memory/src/__tests__/store.test.ts`

**Dependencies to add:** `better-sqlite3`, `@types/better-sqlite3`

Note: `sqlite-vec` requires native binaries. Install via `sqlite-vec` npm package.

**Step 1: Write failing test for store initialization**

```typescript
// packages/memory/src/__tests__/store.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @crevnclaw/memory test`
Expected: FAIL

**Step 3: Implement MemoryStore**

```typescript
// packages/memory/src/store.ts
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export class MemoryStore {
  private db: Database.Database;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'crevnclaw.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        embedding BLOB,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_session
        ON conversations(session_id);
      CREATE TABLE IF NOT EXISTS ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cost_usd REAL NOT NULL,
        tokens_in INTEGER NOT NULL,
        tokens_out INTEGER NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  listTables(): string[] {
    const rows = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as { name: string }[];
    return rows.map(r => r.name);
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @crevnclaw/memory test`
Expected: PASS

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(memory): add SQLite store with schema migrations"
```

---

## Task 4: Conversation Store (@crevnclaw/memory)

**Files:**
- Create: `packages/memory/src/conversations.ts`
- Test: `packages/memory/src/__tests__/conversations.test.ts`

**Step 1: Write failing test**

```typescript
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
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement ConversationStore**

```typescript
// packages/memory/src/conversations.ts
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
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(memory): add conversation turn storage"
```

---

## Task 5: Ledger (@crevnclaw/memory)

**Files:**
- Create: `packages/memory/src/ledger.ts`
- Test: `packages/memory/src/__tests__/ledger.test.ts`

**Step 1: Write failing test**

```typescript
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
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement Ledger**

```typescript
// packages/memory/src/ledger.ts
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
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(memory): add cost ledger with daily spend tracking"
```

---

## Task 6: Embedding Pipeline & RAG Retrieval (@crevnclaw/memory)

**Files:**
- Create: `packages/memory/src/embeddings.ts`
- Create: `packages/memory/src/retrieval.ts`
- Test: `packages/memory/src/__tests__/retrieval.test.ts`

**Step 1: Write failing test for vector storage and retrieval**

Use mock embeddings (simple float arrays) for testing — real embeddings come from provider at runtime.

```typescript
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

    // Store facts with mock embeddings (3-dim for testing)
    vectorStore.addFact('The sky is blue', new Float32Array([1, 0, 0]), { source: 'test', timestamp: new Date().toISOString(), confidence: 1.0 });
    vectorStore.addFact('Water is wet', new Float32Array([0, 1, 0]), { source: 'test', timestamp: new Date().toISOString(), confidence: 1.0 });

    // Query with embedding close to first fact
    const results = retriever.search(new Float32Array([0.9, 0.1, 0]), 1);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('The sky is blue');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement VectorStore and Retriever**

Note: sqlite-vec may not be available in test env. Use a cosine similarity fallback in pure JS for when the extension isn't loaded.

```typescript
// packages/memory/src/embeddings.ts
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
```

```typescript
// packages/memory/src/retrieval.ts
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
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(memory): add vector storage and cosine similarity retrieval"
```

---

## Task 7: Directive Loader (@crevnclaw/memory)

**Files:**
- Create: `packages/memory/src/directives.ts`
- Test: `packages/memory/src/__tests__/directives.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { DirectiveLoader } from '../directives.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('DirectiveLoader', () => {
  const testDir = path.join(os.tmpdir(), 'crevnclaw-dir-' + Date.now(), 'identity');

  afterEach(() => {
    fs.rmSync(path.dirname(testDir), { recursive: true, force: true });
  });

  it('loads SOUL.md and AGENTS.md', () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'SOUL.md'), '# I am CrevnClaw\nHelpful assistant.');
    fs.writeFileSync(path.join(testDir, 'AGENTS.md'), '# Agents\n- web_search');

    const loader = new DirectiveLoader(testDir);
    const soul = loader.getSoul();
    const agents = loader.getAgents();

    expect(soul).toContain('I am CrevnClaw');
    expect(agents).toContain('web_search');
  });

  it('returns empty string for missing files', () => {
    fs.mkdirSync(testDir, { recursive: true });
    const loader = new DirectiveLoader(testDir);
    expect(loader.getSoul()).toBe('');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement DirectiveLoader**

```typescript
// packages/memory/src/directives.ts
import fs from 'node:fs';
import path from 'node:path';

export class DirectiveLoader {
  private identityDir: string;

  constructor(identityDir: string) {
    this.identityDir = identityDir;
  }

  getSoul(): string {
    return this.readFile('SOUL.md');
  }

  getAgents(): string {
    return this.readFile('AGENTS.md');
  }

  private readFile(filename: string): string {
    const filePath = path.join(this.identityDir, filename);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Export everything from memory index and commit**

Update `packages/memory/src/index.ts` to re-export all modules.

```bash
git add -A && git commit -m "feat(memory): add directive loader and complete memory package"
```

---

## Task 8: Docker Executor (@crevnclaw/sandbox)

**Files:**
- Create: `packages/sandbox/src/executor.ts`
- Create: `packages/sandbox/src/index.ts`
- Test: `packages/sandbox/src/__tests__/executor.test.ts`

**Dependencies:** `dockerode`, `@types/dockerode`

**Step 1: Write failing test**

Use a mock for Dockerode in tests since Docker may not be available in CI.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { DockerExecutor } from '../executor.js';

describe('DockerExecutor', () => {
  it('creates container with correct options', async () => {
    const mockContainer = {
      start: vi.fn().mockResolvedValue(undefined),
      wait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
      logs: vi.fn().mockResolvedValue(Buffer.from('hello world')),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const mockDocker = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
    };

    const executor = new DockerExecutor(mockDocker as any, {
      cpuLimit: 1,
      memoryLimit: '512m',
      timeoutMs: 30000,
    });

    const result = await executor.execute({
      image: 'alpine:latest',
      command: ['echo', 'hello world'],
    });

    expect(result.exit_code).toBe(0);
    expect(mockDocker.createContainer).toHaveBeenCalled();
    expect(mockContainer.remove).toHaveBeenCalled();
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement DockerExecutor**

```typescript
// packages/sandbox/src/executor.ts
import type { ExecutionResult } from '@crevnclaw/types';
import type Dockerode from 'dockerode';

export interface ExecutorConfig {
  cpuLimit: number;
  memoryLimit: string;
  timeoutMs: number;
  hostNetwork?: boolean;
}

export interface ExecuteOptions {
  image: string;
  command: string[];
  env?: Record<string, string>;
  workdir?: string;
}

export class DockerExecutor {
  private docker: Dockerode;
  private config: ExecutorConfig;
  private activeContainers: Set<Dockerode.Container> = new Set();

  constructor(docker: Dockerode, config: ExecutorConfig) {
    this.docker = docker;
    this.config = config;
  }

  async execute(options: ExecuteOptions): Promise<ExecutionResult> {
    const start = Date.now();
    const memBytes = this.parseMemoryLimit(this.config.memoryLimit);

    const container = await this.docker.createContainer({
      Image: options.image,
      Cmd: options.command,
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
      WorkingDir: options.workdir,
      NetworkDisabled: !this.config.hostNetwork,
      HostConfig: {
        NanoCpus: this.config.cpuLimit * 1e9,
        Memory: memBytes,
        AutoRemove: false,
      },
    });

    this.activeContainers.add(container);
    try {
      await container.start();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), this.config.timeoutMs)
      );

      const waitResult = await Promise.race([container.wait(), timeoutPromise]);
      const logs = await container.logs({ stdout: true, stderr: true });

      return {
        stdout: logs.toString('utf-8'),
        stderr: '',
        exit_code: (waitResult as any).StatusCode,
        duration_ms: Date.now() - start,
      };
    } finally {
      this.activeContainers.delete(container);
      await container.remove({ force: true }).catch(() => {});
    }
  }

  async panicKill(): Promise<void> {
    const kills = [...this.activeContainers].map(c =>
      c.remove({ force: true }).catch(() => {})
    );
    await Promise.all(kills);
    this.activeContainers.clear();
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)(m|g)$/i);
    if (!match) return 512 * 1024 * 1024;
    const val = parseInt(match[1]);
    return match[2].toLowerCase() === 'g' ? val * 1024 * 1024 * 1024 : val * 1024 * 1024;
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(sandbox): add Docker executor with resource limits and panic kill"
```

---

## Task 9: Tool Registry (@crevnclaw/sandbox)

**Files:**
- Create: `packages/sandbox/src/tools.ts`
- Test: `packages/sandbox/src/__tests__/tools.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../tools.js';

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'shell',
      description: 'Run a shell command',
      input_schema: { type: 'object', properties: { command: { type: 'string' } } },
      image: 'alpine:latest',
      command: ['sh', '-c'],
      env: 'docker',
    });

    const tool = registry.get('shell');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('shell');
  });

  it('lists all tools as MCP-compatible definitions', () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'python',
      description: 'Run Python code',
      input_schema: { type: 'object', properties: { code: { type: 'string' } } },
      image: 'python:3.12-slim',
      command: ['python', '-c'],
      env: 'docker',
    });

    const tools = registry.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toHaveProperty('name');
    expect(tools[0]).toHaveProperty('description');
    expect(tools[0]).toHaveProperty('input_schema');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement ToolRegistry**

```typescript
// packages/sandbox/src/tools.ts
import type { ToolRegistryEntry, ToolDefinition } from '@crevnclaw/types';

export class ToolRegistry {
  private tools = new Map<string, ToolRegistryEntry>();

  register(tool: ToolRegistryEntry): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolRegistryEntry | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolDefinition[] {
    return [...this.tools.values()].map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Export from index and commit**

```bash
git add -A && git commit -m "feat(sandbox): add tool registry with MCP-compatible listing"
```

---

## Task 10: Lane-Based Scheduler (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/scheduler.ts`
- Test: `packages/kernel/src/__tests__/scheduler.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { Scheduler, Lane } from '../scheduler.js';

describe('Scheduler', () => {
  it('executes higher priority lanes first', async () => {
    const scheduler = new Scheduler();
    const order: number[] = [];

    scheduler.enqueue(Lane.Background, async () => { order.push(2); });
    scheduler.enqueue(Lane.Interactive, async () => { order.push(1); });
    scheduler.enqueue(Lane.System, async () => { order.push(0); });

    await scheduler.flush();
    expect(order).toEqual([0, 1, 2]);
  });

  it('cancels background tasks when interactive arrives', async () => {
    const scheduler = new Scheduler();
    let backgroundCancelled = false;

    scheduler.enqueue(Lane.Background, async (signal) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          backgroundCancelled = true;
          reject(signal.reason);
        });
      });
    });

    // Give background task time to start
    await new Promise(r => setTimeout(r, 50));

    scheduler.enqueue(Lane.Interactive, async () => {});
    await scheduler.flush();

    expect(backgroundCancelled).toBe(true);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement Scheduler**

```typescript
// packages/kernel/src/scheduler.ts
import { EventEmitter } from 'node:events';

export enum Lane {
  System = 0,
  Interactive = 1,
  Background = 2,
}

interface Task {
  lane: Lane;
  fn: (signal: AbortSignal) => Promise<void>;
  controller: AbortController;
}

export class Scheduler extends EventEmitter {
  private queues: Map<Lane, Task[]> = new Map([
    [Lane.System, []],
    [Lane.Interactive, []],
    [Lane.Background, []],
  ]);
  private runningBackground: Task | null = null;

  enqueue(lane: Lane, fn: (signal: AbortSignal) => Promise<void>): void {
    const controller = new AbortController();
    const task: Task = { lane, fn, controller };
    this.queues.get(lane)!.push(task);

    // Preempt background if interactive arrives
    if (lane === Lane.Interactive && this.runningBackground) {
      this.runningBackground.controller.abort(new Error('Preempted by interactive task'));
      this.runningBackground = null;
    }

    this.emit('enqueue', lane);
  }

  async flush(): Promise<void> {
    for (const lane of [Lane.System, Lane.Interactive, Lane.Background]) {
      const queue = this.queues.get(lane)!;
      while (queue.length > 0) {
        const task = queue.shift()!;
        if (task.controller.signal.aborted) continue;

        if (lane === Lane.Background) {
          this.runningBackground = task;
        }
        try {
          await task.fn(task.controller.signal);
        } catch (err: any) {
          if (err?.message !== 'Preempted by interactive task') {
            this.emit('error', err);
          }
        } finally {
          if (this.runningBackground === task) {
            this.runningBackground = null;
          }
        }
      }
    }
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(kernel): add lane-based priority scheduler with preemption"
```

---

## Task 11: Config Loader (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/config.ts`
- Test: `packages/kernel/src/__tests__/config.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('loadConfig', () => {
  const testDir = path.join(os.tmpdir(), 'crevnclaw-cfg-' + Date.now());

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('loads and validates config.json', () => {
    fs.mkdirSync(testDir, { recursive: true });
    const config = {
      port: 3100,
      origin_allowlist: ['http://localhost:3000'],
      providers: [{ type: 'bedrock', model: 'anthropic.claude-3-5-sonnet-20241022-v2:0', region: 'us-east-1' }],
      active_provider: 'bedrock',
      circuit_breaker: { max_daily_spend: 5.0, max_loops_per_hour: 50 },
    };
    fs.writeFileSync(path.join(testDir, 'config.json'), JSON.stringify(config));

    const loaded = loadConfig(testDir);
    expect(loaded.port).toBe(3100);
    expect(loaded.providers[0].type).toBe('bedrock');
  });

  it('throws on invalid config', () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'config.json'), '{"port": "not a number"}');

    expect(() => loadConfig(testDir)).toThrow();
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement loadConfig**

```typescript
// packages/kernel/src/config.ts
import { GatewayConfigSchema, type GatewayConfig } from '@crevnclaw/types';
import fs from 'node:fs';
import path from 'node:path';

export function loadConfig(baseDir: string): GatewayConfig {
  const configPath = path.join(baseDir, 'config.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return GatewayConfigSchema.parse(raw);
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(kernel): add config loader with Zod validation"
```

---

## Task 12: WebSocket Server with Auth (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/server.ts`
- Test: `packages/kernel/src/__tests__/server.test.ts`

**Dependencies:** `ws`, `@types/ws`, `jsonwebtoken`, `@types/jsonwebtoken`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { GatewayServer } from '../server.js';
import WebSocket from 'ws';

describe('GatewayServer', () => {
  let server: GatewayServer;

  afterEach(async () => {
    await server?.stop();
  });

  it('rejects connections without auth token', async () => {
    server = new GatewayServer({
      port: 0, // random port
      originAllowlist: ['http://localhost:3000'],
      secret: 'test-secret',
    });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`);
    const closePromise = new Promise<number>(resolve => {
      ws.on('close', (code) => resolve(code));
    });

    const code = await closePromise;
    expect(code).toBe(1008); // Policy Violation
  });

  it('accepts connections with valid token', async () => {
    server = new GatewayServer({
      port: 0,
      originAllowlist: ['http://localhost:3000'],
      secret: 'test-secret',
    });
    const port = await server.start();
    const token = server.generateToken();

    const ws = new WebSocket(`ws://localhost:${port}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const openPromise = new Promise<void>(resolve => {
      ws.on('open', () => resolve());
    });

    await openPromise;
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement GatewayServer**

```typescript
// packages/kernel/src/server.ts
import { WebSocketServer, type WebSocket } from 'ws';
import { createServer, type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'node:events';
import type { WSMessage } from '@crevnclaw/types';

export interface ServerConfig {
  port: number;
  originAllowlist: string[];
  secret: string;
}

export class GatewayServer extends EventEmitter {
  private httpServer: Server;
  private wss: WebSocketServer;
  private config: ServerConfig;
  private clients: Set<WebSocket> = new Set();

  constructor(config: ServerConfig) {
    super();
    this.config = config;
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ noServer: true });
    this.setupUpgrade();
    this.setupConnection();
  }

  private setupUpgrade(): void {
    this.httpServer.on('upgrade', (req, socket, head) => {
      const origin = req.headers.origin || '';
      if (this.config.originAllowlist.length > 0 && !this.config.originAllowlist.includes(origin)) {
        // Allow connections without origin (CLI, tests) but block mismatched origins
        if (origin !== '') {
          socket.destroy();
          return;
        }
      }

      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const token = auth.slice(7);
      try {
        jwt.verify(token, this.config.secret);
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req);
        });
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });
  }

  private setupConnection(): void {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as WSMessage;
          this.emit('message', msg, ws);
        } catch {
          ws.close(1003, 'Invalid message format');
        }
      });
    });
  }

  broadcast(msg: WSMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === 1) client.send(data);
    }
  }

  generateToken(): string {
    return jwt.sign({ type: 'gateway' }, this.config.secret, { expiresIn: '24h' });
  }

  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, () => {
        const addr = this.httpServer.address() as { port: number };
        resolve(addr.port);
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) client.close();
    this.clients.clear();
    this.wss.close();
    return new Promise((resolve) => {
      this.httpServer.close(() => resolve());
    });
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(kernel): add secure WebSocket server with JWT auth"
```

---

## Task 13: CLI Pairing (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/pairing.ts`
- Test: `packages/kernel/src/__tests__/pairing.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { PairingService } from '../pairing.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('PairingService', () => {
  const testDir = path.join(os.tmpdir(), 'crevnclaw-pair-' + Date.now());

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('generates and validates a pairing token', () => {
    const svc = new PairingService('test-secret', testDir);
    const token = svc.generate();

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    const valid = svc.validate(token);
    expect(valid).toBe(true);
  });

  it('persists token to config dir', () => {
    const svc = new PairingService('test-secret', testDir);
    svc.generate();

    const tokenFile = path.join(testDir, '.pairing-token');
    expect(fs.existsSync(tokenFile)).toBe(true);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement PairingService**

```typescript
// packages/kernel/src/pairing.ts
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';

export class PairingService {
  private secret: string;
  private configDir: string;

  constructor(secret: string, configDir: string) {
    this.secret = secret;
    this.configDir = configDir;
  }

  generate(): string {
    const token = jwt.sign({ type: 'pairing', iat: Date.now() }, this.secret, { expiresIn: '1h' });
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(path.join(this.configDir, '.pairing-token'), token);
    return token;
  }

  validate(token: string): boolean {
    try {
      jwt.verify(token, this.secret);
      return true;
    } catch {
      return false;
    }
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(kernel): add CLI pairing service with JWT tokens"
```

---

## Task 14: AWS Bedrock Provider (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/providers/bedrock.ts`
- Create: `packages/kernel/src/providers/index.ts`
- Test: `packages/kernel/src/__tests__/providers/bedrock.test.ts`

**Dependencies:** `@aws-sdk/client-bedrock-runtime`

**Step 1: Write failing test (using mocked AWS client)**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { BedrockProvider } from '../../providers/bedrock.js';

describe('BedrockProvider', () => {
  it('sends chat request and parses response', async () => {
    const mockSend = vi.fn().mockResolvedValue({
      output: { message: { content: [{ text: 'Hello back!' }] } },
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const provider = new BedrockProvider({
      region: 'us-east-1',
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    });
    // Inject mock client
    (provider as any).client = { send: mockSend };

    const response = await provider.chat([
      { role: 'user', content: 'Hello' }
    ]);

    expect(response.content).toBe('Hello back!');
    expect(response.usage.input_tokens).toBe(10);
    expect(response.provider).toBe('bedrock');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement BedrockProvider**

```typescript
// packages/kernel/src/providers/bedrock.ts
import { BedrockRuntimeClient, ConverseCommand, type Message } from '@aws-sdk/client-bedrock-runtime';
import type { LLMProvider, ChatMessage, ChatResponse, EmbeddingResponse, ToolDefinition } from '@crevnclaw/types';

export interface BedrockConfig {
  region: string;
  model: string;
}

export class BedrockProvider implements LLMProvider {
  readonly name = 'bedrock';
  private client: BedrockRuntimeClient;
  private model: string;

  constructor(config: BedrockConfig) {
    this.client = new BedrockRuntimeClient({ region: config.region });
    this.model = config.model;
  }

  async chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<ChatResponse> {
    const bedrockMessages: Message[] = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: [{ text: m.content }],
      }));

    const systemPrompt = messages.find(m => m.role === 'system');

    const command = new ConverseCommand({
      modelId: this.model,
      messages: bedrockMessages,
      system: systemPrompt ? [{ text: systemPrompt.content }] : undefined,
      toolConfig: tools ? {
        tools: tools.map(t => ({
          toolSpec: {
            name: t.name,
            description: t.description,
            inputSchema: { json: t.input_schema },
          },
        })),
      } : undefined,
    });

    const response = await this.client.send(command);
    const content = response.output?.message?.content?.[0];

    return {
      content: (content as any)?.text || '',
      usage: {
        input_tokens: response.usage?.inputTokens || 0,
        output_tokens: response.usage?.outputTokens || 0,
      },
      model: this.model,
      provider: 'bedrock',
    };
  }

  async *streamChat(messages: ChatMessage[], _tools?: ToolDefinition[]): AsyncIterable<string> {
    // Bedrock streaming via ConverseStream — simplified for now
    const response = await this.chat(messages);
    yield response.content;
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    // Use Bedrock Titan Embeddings
    const command = {
      modelId: 'amazon.titan-embed-text-v2:0',
      body: JSON.stringify({ inputText: text }),
      contentType: 'application/json',
      accept: 'application/json',
    };

    const { InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const response = await this.client.send(new InvokeModelCommand(command));
    const body = JSON.parse(new TextDecoder().decode(response.body));

    return {
      embedding: body.embedding,
      usage: { tokens: body.inputTextTokenCount || 0 },
    };
  }
}
```

```typescript
// packages/kernel/src/providers/index.ts
import type { LLMProvider, ProviderConfig } from '@crevnclaw/types';
import { BedrockProvider } from './bedrock.js';

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case 'bedrock':
      return new BedrockProvider({ region: config.region!, model: config.model });
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export { BedrockProvider };
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(kernel): add AWS Bedrock LLM provider with plugin-ready interface"
```

---

## Task 15: Circuit Breaker (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/circuit-breaker.ts`
- Test: `packages/kernel/src/__tests__/circuit-breaker.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('allows requests within limits', async () => {
    const mockLedger = {
      getDailySpend: vi.fn().mockReturnValue(1.0),
      getHourlyLoopCount: vi.fn().mockReturnValue(5),
      record: vi.fn(),
    };

    const breaker = new CircuitBreaker(
      { max_daily_spend: 5.0, max_loops_per_hour: 50 },
      mockLedger as any,
    );

    expect(breaker.isTripped()).toBe(false);
  });

  it('trips when daily spend exceeded', () => {
    const mockLedger = {
      getDailySpend: vi.fn().mockReturnValue(6.0),
      getHourlyLoopCount: vi.fn().mockReturnValue(5),
      record: vi.fn(),
    };

    const breaker = new CircuitBreaker(
      { max_daily_spend: 5.0, max_loops_per_hour: 50 },
      mockLedger as any,
    );

    expect(breaker.isTripped()).toBe(true);
    expect(breaker.tripReason()).toContain('daily spend');
  });

  it('trips when loop count exceeded', () => {
    const mockLedger = {
      getDailySpend: vi.fn().mockReturnValue(1.0),
      getHourlyLoopCount: vi.fn().mockReturnValue(55),
      record: vi.fn(),
    };

    const breaker = new CircuitBreaker(
      { max_daily_spend: 5.0, max_loops_per_hour: 50 },
      mockLedger as any,
    );

    expect(breaker.isTripped()).toBe(true);
    expect(breaker.tripReason()).toContain('loops per hour');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement CircuitBreaker**

```typescript
// packages/kernel/src/circuit-breaker.ts
import { EventEmitter } from 'node:events';
import type { CircuitBreakerConfig } from '@crevnclaw/types';
import type { Ledger } from '@crevnclaw/memory';

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private ledger: Ledger;

  constructor(config: CircuitBreakerConfig, ledger: Ledger) {
    super();
    this.config = config;
    this.ledger = ledger;
  }

  isTripped(): boolean {
    return this.tripReason() !== null;
  }

  tripReason(): string | null {
    const dailySpend = this.ledger.getDailySpend();
    if (dailySpend >= this.config.max_daily_spend) {
      return `Exceeded max daily spend: $${dailySpend.toFixed(2)} >= $${this.config.max_daily_spend.toFixed(2)}`;
    }

    const hourlyLoops = this.ledger.getHourlyLoopCount();
    if (hourlyLoops >= this.config.max_loops_per_hour) {
      return `Exceeded max loops per hour: ${hourlyLoops} >= ${this.config.max_loops_per_hour}`;
    }

    return null;
  }

  check(): void {
    const reason = this.tripReason();
    if (reason) {
      this.emit('tripped', reason);
      throw new Error(`Circuit breaker tripped: ${reason}`);
    }
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(kernel): add economic circuit breaker with spend and loop limits"
```

---

## Task 16: Message Router (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/router.ts`
- Test: `packages/kernel/src/__tests__/router.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MessageRouter } from '../router.js';

describe('MessageRouter', () => {
  it('routes messages to registered handlers', async () => {
    const router = new MessageRouter();
    const handler = vi.fn();

    router.on('chat', handler);
    await router.route({ type: 'chat', id: '1', timestamp: new Date().toISOString(), payload: { text: 'hello' } });

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'chat' }));
  });

  it('ignores unregistered message types', async () => {
    const router = new MessageRouter();
    // Should not throw
    await router.route({ type: 'thought', id: '1', timestamp: new Date().toISOString(), payload: {} });
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement MessageRouter**

```typescript
// packages/kernel/src/router.ts
import { EventEmitter } from 'node:events';
import type { WSMessage, WSMessageType } from '@crevnclaw/types';

export class MessageRouter extends EventEmitter {
  async route(msg: WSMessage): Promise<void> {
    this.emit(msg.type, msg);
  }
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(kernel): add typed message router"
```

---

## Task 17: Lobster Workflow Engine (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/workflow/parser.ts`
- Create: `packages/kernel/src/workflow/engine.ts`
- Create: `packages/kernel/src/workflow/freeze.ts`
- Test: `packages/kernel/src/__tests__/workflow/engine.test.ts`

**Dependencies:** `js-yaml`, `@types/js-yaml`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { WorkflowEngine } from '../../workflow/engine.js';
import { parseWorkflow } from '../../workflow/parser.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const sampleYaml = `
name: deploy
description: Deploy to production
steps:
  - id: build
    name: Build project
    type: action
    action: shell
    args:
      command: npm run build
    next: review
  - id: review
    name: Review build
    type: approval
    on_approve: deploy
    on_reject: null
  - id: deploy
    name: Deploy
    type: action
    action: shell
    args:
      command: ./deploy.sh
`;

describe('WorkflowEngine', () => {
  const freezeDir = path.join(os.tmpdir(), 'crevnclaw-wf-' + Date.now());

  afterEach(() => {
    fs.rmSync(freezeDir, { recursive: true, force: true });
  });

  it('parses workflow YAML', () => {
    const wf = parseWorkflow(sampleYaml);
    expect(wf.name).toBe('deploy');
    expect(wf.steps).toHaveLength(3);
  });

  it('runs until approval gate and freezes', async () => {
    const wf = parseWorkflow(sampleYaml);
    const engine = new WorkflowEngine(freezeDir);

    const actionHandler = async (_action: string, _args: Record<string, unknown>) => {};
    const state = await engine.run(wf, actionHandler);

    expect(state.status).toBe('waiting_approval');
    expect(state.current_step).toBe('review');
  });

  it('thaws frozen state and continues', async () => {
    const wf = parseWorkflow(sampleYaml);
    const engine = new WorkflowEngine(freezeDir);
    const actions: string[] = [];

    const actionHandler = async (action: string, _args: Record<string, unknown>) => {
      actions.push(action);
    };

    // Run to approval gate
    await engine.run(wf, actionHandler);

    // Approve and continue
    const finalState = await engine.approve(wf.name, 'approve', actionHandler);

    expect(finalState.status).toBe('completed');
    expect(actions).toContain('shell');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement parser**

```typescript
// packages/kernel/src/workflow/parser.ts
import yaml from 'js-yaml';
import { z } from 'zod';
import type { WorkflowDefinition } from '@crevnclaw/types';

const StepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['action', 'approval', 'conditional']),
  action: z.string().optional(),
  args: z.record(z.unknown()).optional(),
  next: z.string().nullable().optional(),
  on_approve: z.string().nullable().optional(),
  on_reject: z.string().nullable().optional(),
});

const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string(),
  steps: z.array(StepSchema).min(1),
});

export function parseWorkflow(yamlContent: string): WorkflowDefinition {
  const raw = yaml.load(yamlContent);
  return WorkflowSchema.parse(raw);
}
```

**Step 4: Implement freeze/thaw**

```typescript
// packages/kernel/src/workflow/freeze.ts
import type { WorkflowState } from '@crevnclaw/types';
import fs from 'node:fs';
import path from 'node:path';

export class FreezeStore {
  private dir: string;

  constructor(freezeDir: string) {
    this.dir = freezeDir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  freeze(state: WorkflowState): void {
    const file = path.join(this.dir, `${state.workflow_name}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...state, frozen_at: new Date().toISOString() }));
  }

  thaw(workflowName: string): WorkflowState | null {
    const file = path.join(this.dir, `${workflowName}.json`);
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return null;
    }
  }

  remove(workflowName: string): void {
    const file = path.join(this.dir, `${workflowName}.json`);
    try { fs.unlinkSync(file); } catch {}
  }
}
```

**Step 5: Implement engine**

```typescript
// packages/kernel/src/workflow/engine.ts
import type { WorkflowDefinition, WorkflowState, WorkflowStep } from '@crevnclaw/types';
import { FreezeStore } from './freeze.js';

type ActionHandler = (action: string, args: Record<string, unknown>) => Promise<void>;

export class WorkflowEngine {
  private freezeStore: FreezeStore;

  constructor(freezeDir: string) {
    this.freezeStore = new FreezeStore(freezeDir);
  }

  async run(workflow: WorkflowDefinition, handler: ActionHandler): Promise<WorkflowState> {
    const state: WorkflowState = {
      workflow_name: workflow.name,
      current_step: workflow.steps[0].id,
      status: 'running',
      context: {},
    };

    return this.execute(workflow, state, handler);
  }

  async approve(workflowName: string, decision: 'approve' | 'reject', handler: ActionHandler): Promise<WorkflowState> {
    const state = this.freezeStore.thaw(workflowName);
    if (!state) throw new Error(`No frozen state for workflow: ${workflowName}`);

    this.freezeStore.remove(workflowName);

    // Find current step to determine next
    // We need the workflow definition — load from state context
    const workflow = state.context.__workflow as WorkflowDefinition;
    const step = workflow.steps.find(s => s.id === state.current_step);
    if (!step) throw new Error(`Step not found: ${state.current_step}`);

    const nextId = decision === 'approve' ? step.on_approve : step.on_reject;
    if (!nextId) {
      state.status = decision === 'approve' ? 'completed' : 'failed';
      return state;
    }

    state.current_step = nextId;
    state.status = 'running';
    return this.execute(workflow, state, handler);
  }

  private async execute(workflow: WorkflowDefinition, state: WorkflowState, handler: ActionHandler): Promise<WorkflowState> {
    while (state.status === 'running') {
      const step = workflow.steps.find(s => s.id === state.current_step);
      if (!step) {
        state.status = 'completed';
        break;
      }

      if (step.type === 'approval') {
        state.status = 'waiting_approval';
        state.context.__workflow = workflow as any;
        this.freezeStore.freeze(state);
        break;
      }

      if (step.type === 'action' && step.action) {
        await handler(step.action, step.args || {});
      }

      if (step.next) {
        state.current_step = step.next;
      } else {
        state.status = 'completed';
      }
    }

    return state;
  }
}
```

**Step 6: Run test — expect PASS**

**Step 7: Commit**

```bash
git add -A && git commit -m "feat(kernel): add Lobster workflow engine with YAML parser and freeze/thaw"
```

---

## Task 18: Kernel Entry Point & CLI (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/index.ts`
- Create: `packages/kernel/src/cli.ts`

**Step 1: Wire everything together in index.ts**

```typescript
// packages/kernel/src/index.ts
export { Scheduler, Lane } from './scheduler.js';
export { GatewayServer } from './server.js';
export { PairingService } from './pairing.js';
export { MessageRouter } from './router.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { createProvider, BedrockProvider } from './providers/index.js';
export { WorkflowEngine } from './workflow/engine.js';
export { parseWorkflow } from './workflow/parser.js';
export { loadConfig } from './config.js';
```

**Step 2: Create CLI entry point**

```typescript
// packages/kernel/src/cli.ts
import { loadConfig } from './config.js';
import { GatewayServer } from './server.js';
import { Scheduler } from './scheduler.js';
import { MessageRouter } from './router.js';
import { PairingService } from './pairing.js';
import { createProvider } from './providers/index.js';
import { MemoryStore, Ledger } from '@crevnclaw/memory';
import { CircuitBreaker } from './circuit-breaker.js';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const BASE_DIR = path.join(os.homedir(), '.crevnclaw');

async function main() {
  const command = process.argv[2];

  if (command === 'pair') {
    const secret = crypto.randomBytes(32).toString('hex');
    const pairing = new PairingService(secret, BASE_DIR);
    const token = pairing.generate();
    console.log(`Pairing token: ${token}`);
    console.log('Paste this token into your client to connect.');
    return;
  }

  // Default: start gateway
  const config = loadConfig(BASE_DIR);
  const secret = crypto.randomBytes(32).toString('hex');

  const memoryStore = new MemoryStore(path.join(BASE_DIR, 'memory'));
  const ledger = new Ledger(memoryStore.getDb());
  const breaker = new CircuitBreaker(config.circuit_breaker, ledger);
  const scheduler = new Scheduler();
  const router = new MessageRouter();

  const providerConfig = config.providers.find(p => p.type === config.active_provider);
  if (!providerConfig) throw new Error(`Provider not found: ${config.active_provider}`);
  const provider = createProvider(providerConfig);

  const server = new GatewayServer({
    port: config.port,
    originAllowlist: config.origin_allowlist,
    secret,
  });

  breaker.on('tripped', (reason: string) => {
    server.broadcast({
      type: 'bankrupt',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { reason },
    });
  });

  const port = await server.start();
  const token = server.generateToken();

  console.log(`CrevnClaw Gateway running on port ${port}`);
  console.log(`Connect with token: ${token}`);
}

main().catch(console.error);
```

Add to `packages/kernel/package.json`:
```json
"bin": {
  "crevnclaw": "dist/cli.js"
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(kernel): add CLI entry point wiring all kernel components"
```

---

## Task 19: Dashboard Setup (@crevnclaw/dashboard)

**Files:**
- Create: Next.js project in `packages/dashboard/`

**Step 1: Initialize Next.js**

Run: `cd packages/dashboard && pnpm dlx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-pnpm`

**Step 2: Add dependencies**

Run: `pnpm --filter @crevnclaw/dashboard add @trpc/server @trpc/client @trpc/next @tanstack/react-query ws`

**Step 3: Create tRPC setup**

```typescript
// packages/dashboard/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../server/router';

export const trpc = createTRPCReact<AppRouter>();
```

```typescript
// packages/dashboard/src/lib/ws.ts
export function createWSConnection(url: string, token: string) {
  const ws = new WebSocket(url, [`Bearer-${token}`]);

  return {
    ws,
    onMessage(handler: (msg: any) => void) {
      ws.addEventListener('message', (e) => {
        handler(JSON.parse(e.data));
      });
    },
    send(msg: any) {
      ws.send(JSON.stringify(msg));
    },
    close() {
      ws.close();
    },
  };
}
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(dashboard): initialize Next.js with tRPC and WebSocket setup"
```

---

## Task 20: Dashboard - Thought Stream Page

**Files:**
- Create: `packages/dashboard/src/app/thought-stream/page.tsx`
- Create: `packages/dashboard/src/components/thought-stream.tsx`

**Step 1: Implement ThoughtStream component**

```tsx
// packages/dashboard/src/components/thought-stream.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface ThoughtEntry {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export function ThoughtStream({ wsUrl, token }: { wsUrl: string; token: string }) {
  const [entries, setEntries] = useState<ThoughtEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${token}` } } as any);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setEntries(prev => [...prev, msg]);
    };

    return () => ws.close();
  }, [wsUrl, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="h-full overflow-y-auto bg-black text-green-400 font-mono p-4 text-sm">
      {entries.map((entry) => (
        <div key={entry.id} className="mb-2">
          <span className="text-gray-500">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>
          <span className="text-yellow-400 ml-2">[{entry.type}]</span>
          <pre className="ml-4 text-green-300 whitespace-pre-wrap">
            {JSON.stringify(entry.payload, null, 2)}
          </pre>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

**Step 2: Create page**

```tsx
// packages/dashboard/src/app/thought-stream/page.tsx
import { ThoughtStream } from '../../components/thought-stream';

export default function ThoughtStreamPage() {
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Live Thought Stream</h1>
        <span className="text-green-400 text-sm">● Connected</span>
      </header>
      <main className="flex-1">
        <ThoughtStream
          wsUrl={process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3100'}
          token={process.env.NEXT_PUBLIC_WS_TOKEN || ''}
        />
      </main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(dashboard): add live thought stream page"
```

---

## Task 21: Dashboard - Panic Button & Memory Browser

**Files:**
- Create: `packages/dashboard/src/components/panic-button.tsx`
- Create: `packages/dashboard/src/components/memory-browser.tsx`
- Create: `packages/dashboard/src/app/memory/page.tsx`

**Step 1: Implement PanicButton**

```tsx
// packages/dashboard/src/components/panic-button.tsx
'use client';

import { useState } from 'react';

export function PanicButton({ wsUrl, token }: { wsUrl: string; token: string }) {
  const [killing, setKilling] = useState(false);

  const handlePanic = async () => {
    setKilling(true);
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'panic',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          payload: {},
        }));
        ws.close();
      };
    } finally {
      setTimeout(() => setKilling(false), 2000);
    }
  };

  return (
    <button
      onClick={handlePanic}
      disabled={killing}
      className="bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white font-bold py-4 px-8 rounded-lg text-xl shadow-lg transition-all"
    >
      {killing ? 'KILLING...' : 'EMERGENCY STOP'}
    </button>
  );
}
```

**Step 2: Implement MemoryBrowser**

```tsx
// packages/dashboard/src/components/memory-browser.tsx
'use client';

import { useState, useEffect } from 'react';

interface ConversationEntry {
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export function MemoryBrowser({ apiUrl }: { apiUrl: string }) {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(`${apiUrl}/api/conversations`)
      .then(r => r.json())
      .then(setConversations)
      .catch(console.error);
  }, [apiUrl]);

  const filtered = conversations.filter(c =>
    c.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4">
      <input
        type="text"
        placeholder="Search memories..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full p-2 mb-4 bg-gray-800 text-white border border-gray-700 rounded"
      />
      <div className="space-y-2">
        {filtered.map((entry) => (
          <div key={entry.id} className="p-3 bg-gray-800 rounded border border-gray-700">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span className="font-semibold">{entry.role}</span>
              <span>{new Date(entry.created_at).toLocaleString()}</span>
            </div>
            <p className="text-gray-200">{entry.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create memory page and commit**

```bash
git add -A && git commit -m "feat(dashboard): add panic button and memory browser components"
```

---

## Task 22: Dashboard - Main Layout & Settings

**Files:**
- Modify: `packages/dashboard/src/app/layout.tsx`
- Modify: `packages/dashboard/src/app/page.tsx`
- Create: `packages/dashboard/src/app/settings/page.tsx`
- Create: `packages/dashboard/src/components/spend-chart.tsx`

**Step 1: Create main layout with navigation sidebar**

Navigation links: Thought Stream, Memory, Settings. Panic button always visible in header.

**Step 2: Create settings page with circuit breaker config**

Simple form to view/edit `max_daily_spend` and `max_loops_per_hour`. Displays current spend.

**Step 3: Create spend chart component**

Simple bar chart showing daily spend vs. limit using CSS (no charting library needed for v1).

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(dashboard): add layout, settings page, and spend chart"
```

---

## Task 23: Docker Sandbox Image

**Files:**
- Create: `docker/sandbox/Dockerfile`

**Step 1: Create Dockerfile**

```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl git jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
USER node

CMD ["node"]
```

**Step 2: Test build**

Run: `docker build -t crevnclaw/sandbox:latest docker/sandbox/`
Expected: Image builds successfully

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(sandbox): add Docker sandbox base image"
```

---

## Task 24: MCP Host Support (@crevnclaw/kernel)

**Files:**
- Create: `packages/kernel/src/mcp.ts`
- Test: `packages/kernel/src/__tests__/mcp.test.ts`

**Step 1: Implement MCP Host that connects to configured MCP servers**

The MCP Host spawns configured MCP server processes, communicates via JSON-RPC over stdio, discovers tools, and exposes them through the tool registry.

**Step 2: Write test with mock MCP server process**

**Step 3: Wire into kernel startup — load MCP servers from config, discover tools, register in sandbox tool registry**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(kernel): add MCP Host for external tool server discovery"
```

---

## Task 25: Integration Test & Default Config

**Files:**
- Create: `packages/kernel/src/__tests__/integration.test.ts`
- Create: default `config.json` template

**Step 1: Write integration test**

Test that spins up Gateway, connects via WebSocket, sends a chat message, verifies it routes through scheduler and router.

**Step 2: Create default config template**

```json
{
  "port": 3100,
  "origin_allowlist": ["http://localhost:3000"],
  "providers": [
    {
      "type": "bedrock",
      "model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "region": "us-east-1"
    }
  ],
  "active_provider": "bedrock",
  "circuit_breaker": {
    "max_daily_spend": 5.00,
    "max_loops_per_hour": 50
  },
  "mcp_servers": [],
  "sandbox": {
    "cpu_limit": 1,
    "memory_limit": "512m",
    "timeout_ms": 30000,
    "host_network": false
  }
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add integration test and default config template"
```

---

## Summary

| Task | Package | Component |
|------|---------|-----------|
| 1 | root | Monorepo scaffolding |
| 2 | types | Shared interfaces & Zod schemas |
| 3 | memory | SQLite store & migrations |
| 4 | memory | Conversation store |
| 5 | memory | Cost ledger |
| 6 | memory | Embedding pipeline & RAG retrieval |
| 7 | memory | Directive loader |
| 8 | sandbox | Docker executor |
| 9 | sandbox | Tool registry |
| 10 | kernel | Lane-based scheduler |
| 11 | kernel | Config loader |
| 12 | kernel | WebSocket server + auth |
| 13 | kernel | CLI pairing |
| 14 | kernel | AWS Bedrock provider |
| 15 | kernel | Circuit breaker |
| 16 | kernel | Message router |
| 17 | kernel | Lobster workflow engine |
| 18 | kernel | CLI entry point |
| 19 | dashboard | Next.js setup |
| 20 | dashboard | Thought stream page |
| 21 | dashboard | Panic button & memory browser |
| 22 | dashboard | Layout, settings, spend chart |
| 23 | sandbox | Docker image |
| 24 | kernel | MCP Host support |
| 25 | root | Integration test & default config |
