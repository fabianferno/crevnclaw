# CrevnClaw Design Document

**Date:** 2026-02-19
**Scope:** Phases 1-3 (Gateway Kernel, Brain & Memory, Control & Workflow)
**Skipped:** Phase 4 (Mobile Companion)

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Modular monorepo (pnpm workspaces) | Matches hub-and-spoke topology; clean boundaries |
| Dashboard stack | Next.js + tRPC + SQLite | Local-first, no cloud dependency |
| Initial LLM provider | AWS Bedrock | User preference; plugin-ready for others |
| Tool execution | Docker only | Full OS isolation, arbitrary runtimes, resource limits |
| Package manager | pnpm | Fast, disk-efficient, excellent workspace support |
| Testing | Vitest | Fast, ESM-native, good TypeScript support |
| Validation | Zod | Runtime validation at package boundaries |

---

## Monorepo Structure

```
crevnclaw/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   ├── types/                # @crevnclaw/types - shared interfaces & schemas
│   ├── kernel/               # @crevnclaw/kernel - Gateway control plane
│   ├── sandbox/              # @crevnclaw/sandbox - Docker execution
│   ├── memory/               # @crevnclaw/memory - SQLite + vector + RAG
│   └── dashboard/            # @crevnclaw/dashboard - Next.js Mission Control
├── docker/
│   └── sandbox/
│       └── Dockerfile
└── docs/
    └── plans/
```

---

## Package: @crevnclaw/types

Shared TypeScript interfaces and Zod schemas used across packages.

Key types:
- `LLMProvider` interface (chat, streamChat, embed)
- `ToolDefinition` (MCP-compatible JSON schema)
- `WorkflowDefinition` (Lobster DSL types)
- `Message`, `Conversation`, `Fact` (memory types)
- `CircuitBreakerConfig`, `GatewayConfig`
- WebSocket message protocol types

---

## Package: @crevnclaw/kernel

The central orchestrator (control plane).

### Components

**1. Lane-Based Scheduler (`scheduler.ts`)**
- 3 priority lanes: System (0), Interactive (1), Background (2)
- Event-driven using Node.js EventEmitter + AbortController
- Lane 2 tasks preempt immediately when Lane 1 receives input
- Each task is an async function with an AbortSignal

**2. Secure WebSocket Server (`server.ts`)**
- `ws` library
- Origin header validation against allowlist
- Bearer token auth on HTTP upgrade
- Handshake middleware pipeline

**3. CLI Pairing (`pairing.ts`)**
- `./crevnclaw pair --generate` creates JWT token
- Token stored in `~/.crevnclaw/config.json`
- Used for initial web/mobile handshake
- Bypasses local network discovery

**4. Message Router (`router.ts`)**
- Typed event bus for internal message routing
- Routes between: user connections, sandbox executions, memory queries, LLM calls

**5. LLM Provider System (`providers/`)**
- Plugin-ready architecture: providers implement `LLMProvider` interface
- Initial provider: AWS Bedrock (`@aws-sdk/client-bedrock-runtime`)
- Providers registered in config.json, loaded at startup
- Interface: `chat()`, `streamChat()`, `embed()`

**6. Economic Circuit Breaker (`circuit-breaker.ts`)**
- Wraps LLM client as middleware
- Tracks token usage + cost in memory package's ledger table
- Enforces `max_daily_spend` and `max_loops_per_hour` from config
- On breach: severs LLM connection, emits "Bankrupt" event via WebSocket

**7. Lobster Workflow Engine (`workflow/`)**
- YAML DSL parser using js-yaml + Zod validation
- States: pending -> running -> waiting_approval -> completed | failed
- Freeze: serialize workflow state to `.lobster/frozen_states/` as JSON
- Thaw: on user approval via chat, rehydrate and continue
- Workflow files stored in `~/.crevnclaw/workflows/`

### File Layout

```
packages/kernel/
├── src/
│   ├── index.ts
│   ├── scheduler.ts
│   ├── server.ts
│   ├── router.ts
│   ├── pairing.ts
│   ├── circuit-breaker.ts
│   ├── config.ts
│   ├── providers/
│   │   ├── interface.ts
│   │   └── bedrock.ts
│   └── workflow/
│       ├── parser.ts
│       ├── engine.ts
│       └── freeze.ts
├── package.json
└── tsconfig.json
```

---

## Package: @crevnclaw/sandbox

Docker-based tool execution with zero-trust isolation.

### Components

**1. Docker Executor (`executor.ts`)**
- Uses `dockerode` for Docker API
- Each tool call: spin up container -> mount inputs -> execute -> capture output -> destroy
- Resource limits: 1 CPU core, 512MB RAM, 30s timeout (configurable)
- No network access by default

**2. Tool Registry (`tools.ts`)**
- Tools defined as MCP-compatible JSON schemas
- Each tool maps to a container command + image
- Input validation against schema before execution
- Tool discovery for MCP Host support

**3. God Mode (`god-mode.ts`)**
- When `host_network: true` in AGENTS.md session config
- Containers get host network access
- Requires explicit CLI confirmation at startup

**4. Panic Kill**
- Gateway can destroy ALL running containers instantly
- Used by Mission Control's STOP button

### File Layout

```
packages/sandbox/
├── src/
│   ├── index.ts
│   ├── executor.ts
│   ├── tools.ts
│   └── god-mode.ts
├── package.json
└── tsconfig.json
```

---

## Package: @crevnclaw/memory

SQLite-based storage with vector search and conversation history.

### Components

**1. SQLite Store (`store.ts`)**
- `better-sqlite3` + `sqlite-vec` extension
- Auto-migration on startup
- Database at `~/.crevnclaw/memory/crevnclaw.db`

**2. Schema**

| Table | Column | Type | Description |
|-------|--------|------|-------------|
| vectors | id | INTEGER | Primary key |
| vectors | embedding | F32_BLOB | Embedding vector |
| vectors | content | TEXT | Raw text chunk |
| vectors | metadata | JSON | Timestamp, source, confidence |
| conversations | id | INTEGER | Primary key |
| conversations | session_id | TEXT | Session identifier |
| conversations | role | TEXT | user/assistant/system/tool |
| conversations | content | TEXT | Message content |
| conversations | metadata | JSON | Tool calls, timestamps |
| conversations | created_at | TEXT | ISO timestamp |
| ledger | id | INTEGER | Primary key |
| ledger | cost_usd | REAL | API cost |
| ledger | tokens_in | INTEGER | Input tokens |
| ledger | tokens_out | INTEGER | Output tokens |
| ledger | provider | TEXT | e.g., "bedrock" |
| ledger | model | TEXT | Model identifier |
| ledger | created_at | TEXT | ISO timestamp |

**3. Embedding Pipeline (`embeddings.ts`)**
- Extract facts from conversation turns
- Embed via active LLM provider's embedding endpoint (Bedrock Titan initially)
- Store in vectors table

**4. RAG Retrieval (`retrieval.ts`)**
- Embed query -> vector similarity search via sqlite-vec
- Return top-k results with metadata
- Target: sub-100ms retrieval

**5. Directive Loader (`directives.ts`)**
- Read SOUL.md and AGENTS.md from `~/.crevnclaw/identity/`
- Inject into system prompt for LLM calls

**6. Conversation Store (`conversations.ts`)**
- Full conversation turn storage
- Query by session, time range, role

### File Layout

```
packages/memory/
├── src/
│   ├── index.ts
│   ├── store.ts
│   ├── embeddings.ts
│   ├── retrieval.ts
│   ├── ledger.ts
│   ├── directives.ts
│   └── conversations.ts
├── package.json
└── tsconfig.json
```

---

## Package: @crevnclaw/dashboard

Next.js Mission Control UI for real-time agent observation.

### Features

**1. Live Thought Stream**
- WebSocket connection to Gateway
- Real-time rendering of agent monologue, tool inputs/outputs
- Streaming log with timestamps and lane indicators

**2. State Inspector**
- Browse conversations, vector memories, ledger entries
- tRPC endpoints querying the memory package
- Search over facts via semantic similarity

**3. Panic Button**
- Global STOP button
- Sends kill signal to Gateway -> destroys all Docker containers
- Visual confirmation of kill status

**4. Circuit Breaker Dashboard**
- Real-time spend tracking (charts)
- Limit configuration UI
- Breach history and alerts

### File Layout

```
packages/dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── thought-stream/
│   │   │   └── page.tsx
│   │   ├── memory/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── components/
│   │   ├── thought-stream.tsx
│   │   ├── panic-button.tsx
│   │   ├── spend-chart.tsx
│   │   └── memory-browser.tsx
│   ├── lib/
│   │   ├── trpc.ts
│   │   └── ws.ts
│   └── server/
│       └── router.ts
├── package.json
└── tsconfig.json
```

---

## Runtime Data Directory (~/.crevnclaw/)

```
~/.crevnclaw/
├── config.json               # System config (circuit breakers, providers, MCP servers)
├── identity/
│   ├── SOUL.md               # Persona definition
│   └── AGENTS.md             # Workflow & capability definitions
├── memory/
│   └── crevnclaw.db          # SQLite database
├── workflows/
│   └── *.yaml                # Lobster DSL files
├── .lobster/
│   └── frozen_states/        # Serialized workflow states
└── .sandbox/                 # Docker container mount points
```

---

## WebSocket Protocol

Messages between Gateway and clients use JSON with a typed envelope:

```typescript
type WSMessage = {
  type: 'thought' | 'tool_call' | 'tool_result' | 'approval_request' |
        'approval_response' | 'bankrupt' | 'panic' | 'chat' | 'status';
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
};
```

---

## MCP Host Support

The kernel implements the MCP Host specification:
- Users mount MCP servers via config.json
- On startup, kernel connects to configured MCP servers
- Tools exposed by MCP servers are auto-discovered
- Tool calls route through the sandbox (Docker execution)
- Standard MCP protocol for tool schemas and invocation
