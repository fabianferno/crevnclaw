# CrevnClaw

Local-first autonomous agent OS. A clean-room re-implementation with security, determinism, and observability as first-class priorities.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Dashboard (Next.js)            │
│            Mission Control UI @ :3000            │
└──────────────────────┬──────────────────────────┘
                       │ WebSocket (JWT auth)
┌──────────────────────▼──────────────────────────┐
│                  Gateway Kernel                  │
│  ┌──────────┐ ┌────────────┐ ┌───────────────┐  │
│  │Scheduler │ │Circuit     │ │  Lobster       │  │
│  │(3-lane)  │ │Breaker     │ │  Workflow      │  │
│  └──────────┘ └────────────┘ └───────────────┘  │
│  ┌──────────┐ ┌────────────┐ ┌───────────────┐  │
│  │Bedrock   │ │Message     │ │  MCP Host      │  │
│  │Provider  │ │Router      │ │               │  │
│  └──────────┘ └────────────┘ └───────────────┘  │
└──┬───────────────────┬──────────────────────────┘
   │                   │
┌──▼──────┐     ┌──────▼──────┐
│ Memory  │     │  Sandbox    │
│ SQLite  │     │  Docker     │
│ + RAG   │     │  Executor   │
└─────────┘     └─────────────┘
```

## Packages

| Package | Description |
|---|---|
| `@crevnclaw/types` | Shared Zod schemas and TypeScript interfaces |
| `@crevnclaw/kernel` | Gateway server, scheduler, providers, workflow engine |
| `@crevnclaw/memory` | SQLite store, conversation history, vector search, spending ledger |
| `@crevnclaw/sandbox` | Docker-based tool execution with timeout and panic kill |
| `@crevnclaw/dashboard` | Next.js 15 Mission Control UI |

## Prerequisites

- Node.js >= 22
- pnpm >= 9
- Docker (for sandbox tool execution)
- AWS credentials configured (for Bedrock provider)

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start the dashboard
pnpm --filter @crevnclaw/dashboard dev
```

## Configuration

Copy and edit the default config:

```bash
cp config/default-config.json config/config.json
```

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

## Key Features

**Gateway Kernel** — Lane-based priority scheduler (System/Interactive/Background) with preemption, secure WebSocket server with JWT auth and origin allowlist, CLI pairing service.

**Providers** — Plugin-ready LLM provider system, starting with AWS Bedrock. Factory pattern via `createProvider()` makes adding new providers incremental.

**Circuit Breaker** — Economic safety net: max daily spend and max loops per hour. Trips automatically and exposes reason.

**Memory** — SQLite with WAL mode. Full conversation history, extracted facts with vector embeddings, cosine similarity retrieval, and a spending ledger. Directive loader for SOUL.md/AGENTS.md persona files.

**Sandbox** — Docker-based isolated tool execution via dockerode. Per-execution CPU/memory limits, configurable timeout, and `panicKill()` for emergency shutdown.

**Lobster Workflow Engine** — YAML DSL for multi-step workflows with freeze/thaw state at approval gates. Supports `tool`, `llm`, and `approval` step types.

**MCP Host** — Model Context Protocol host for discovering and calling external tool servers over JSON-RPC/stdio.

**Dashboard** — Dark-themed Mission Control with live thought stream (WebSocket), panic button, memory browser, spend/loop circuit breaker visualization, and gateway settings.

## Project Structure

```
crevnclaw/
├── packages/
│   ├── types/          # Shared schemas (Zod) and interfaces
│   ├── kernel/         # Gateway server, scheduler, providers, workflows
│   ├── memory/         # SQLite store, conversations, vector search, ledger
│   ├── sandbox/        # Docker executor, tool registry
│   └── dashboard/      # Next.js 15 Mission Control UI
├── config/             # Default gateway configuration
├── docker/             # Sandbox Dockerfile
└── docs/plans/         # Design and implementation documents
```

## License

MIT
