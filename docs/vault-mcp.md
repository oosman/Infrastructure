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

## Status

Deployed v2.0.0. Stateless Worker with Streamable HTTP transport. 10 MCP tools, D1 (8 tables: tasks, stages, circuit_breaker, model_stats, checkpoints, decisions, transcripts, _cf_KV), KV (tasks). All migrations applied.
