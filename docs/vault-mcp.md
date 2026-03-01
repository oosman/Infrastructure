<!-- RESUME CONTEXT
What: vault-mcp reference — CF Worker for workflow state, tasks, GitHub
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

Cloudflare Worker providing workflow state management, task tracking, and GitHub integration via MCP protocol.

## Endpoint

https://vault.deltaops.dev/mcp

## Capabilities

- Workflow state: task lifecycle, stage tracking, consensus, circuit breakers (D1 database)
- Human tasks: CRUD via Workers KV, binary status (open/done)
- GitHub: read/write files, create PRs
- Checkpoints: state persistence for session continuity

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

## Status

Deployed v2.1.0 (Phase 7: AI Gateway classification). Stateless Worker with Streamable HTTP transport. 10 MCP tools, D1 (8 tables, data flowing — tasks, stages, circuit_breaker accumulating), KV (tasks). Execute tool wired to full D1 lifecycle (Phase 5 complete).
