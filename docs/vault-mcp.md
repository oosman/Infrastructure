---
title: "vault-mcp"
type: reference
status: active
date: 2026-02-27
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
- Database: D1 (SQLite)
- KV: Workers KV (task storage)
- Durable Objects: McpAgent class

## Status

Deployed and operational. Workflow state routes built (6 files, 1,617 lines). D1 migrations pending.
