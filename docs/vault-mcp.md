<!-- RESUME CONTEXT
What: vault-mcp reference — CF Worker for workflow state, tasks, GitHub, session continuity
Why: Documents the Cloudflare Worker MCP server
Next: cloudflare.md for infrastructure details
Depends-on: architecture.md
-->
---
title: "vault-mcp"
type: reference
status: active
date: 2026-02-28
tags: [mcp, cloudflare, vault]
---

# vault-mcp

Cloudflare Worker providing workflow state management, task tracking, GitHub integration, and session continuity via MCP protocol.

## Endpoint

https://vault.deltaops.dev/mcp

## Capabilities

- Workflow state: task lifecycle, stage tracking, consensus, circuit breakers (D1 database)
- Human tasks: CRUD via Workers KV, binary status (open/done)
- GitHub: read/write files, create PRs
- Checkpoints: state persistence for session continuity
- Session canary: `task(action: "list")` as first call determines normal vs degraded mode

## Auth

Bearer token in MCP config. Rotate quarterly: `npx wrangler secret put VAULT_AUTH_TOKEN`

## Infrastructure

- Runtime: Cloudflare Workers (free tier)
- Database: D1 (SQLite) — vault-db (5a0c53ff-963c-48f9-b68d-f13536104aa1)
- KV: Workers KV (task storage)
- Stateless Worker — no Durable Objects (all state in D1/KV)

## Execute Tool Lifecycle

The `execute` tool (Phase 5) wires executor calls to D1:
- Creates a task record before execution
- Logs stage results (success or error) after execution
- Tracks cost per-task and per-stage
- Feeds circuit breaker daily/monthly accumulators
- Returns mermaid-compressed output + task_id for traceability

## Classification (Phase 7)

After execute tool completes, a waitUntil fires Workers AI (Llama 3.1 8B) through AI Gateway to classify the task. Backfills task_type, complexity, language, stack, domain on the D1 task record. Best-effort — failures are logged and swallowed.

## Checkpoint Tool (Phase 8)

The checkpoint tool serves dual purposes:

1. **Session canary** — `task(action: "list")` as Step 0 of every session. If vault-mcp is unreachable, the session enters degraded mode with local fallback files.
2. **State persistence** — `checkpoint(action: "save")` creates a recovery document in D1 with open tasks (Mermaid diagram), recent decisions, blockers, and recent actions. `checkpoint(action: "load")` retrieves the latest. `checkpoint(action: "decide")` records architectural decisions.

The `/compact` and `/handoff` slash commands automatically call checkpoint save before compaction or session handoff.

When vault-mcp is unreachable, sessions fall back to local markdown files (`~/.claude/tasks-fallback.md`, `~/.claude/checkpoints-fallback.md`). See [memory-layer.md](memory-layer.md) and [ADR-0031](decisions/0031-session-canary-degraded-mode.md).

## Status

Deployed v2.1.0 (Phase 7: AI Gateway classification, Phase 8: session canary). Stateless Worker with Streamable HTTP transport. 10 MCP tools, D1 (8 tables, data flowing — tasks, stages, circuit_breaker accumulating), KV (tasks). Execute tool wired to full D1 lifecycle (Phase 5 complete).
