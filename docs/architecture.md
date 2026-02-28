<!-- RESUME CONTEXT
What: System architecture — diagram, auth model, transport, tool reference
Why: Central reference for how all infrastructure components connect
Next: setup.md for getting started, service docs for details
Depends-on: index.md
-->
---
title: "Architecture"
type: explanation
status: active
date: 2026-02-28
tags: [architecture, overview]
---

# Architecture (v2)

## Overview

This repo covers the full local dev infrastructure: MCP servers, Cloudflare services, launchd management, and dotfiles.

## System Architecture

```
Claude.ai (Opus 4.6 orchestrator, 200K context)
    │
    │ MCP connections (Streamable HTTP)
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Servers                                                     │
│                                                                   │
│  vault-mcp (CF Worker)    mac-mcp (CF Tunnel)                   │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │ Streamable HTTP   │     │ Node.js + Express│                  │
│  │ D1 + KV           │     │ Streamable HTTP  │                  │
│  │ 10 consolidated   │     │ HTTP/2 tunnel    │                  │
│  │ tools             │     │ Secret path auth │                  │
│  │ Bearer token      │     │ 11 tools         │                  │
│  └──────────────────┘     └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
    │                                          │
    │ API calls (classification)               │ Task execution
    ▼                                          ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│ CF AI Gateway         │    │ Lightsail VM ($12/mo)            │
│ (Phase 7)             │    │ ├── Claude Code (Max OAuth)      │
│ • Cost analytics      │    │ ├── Codex CLI (ChatGPT auth)     │
│ • Response caching    │    │ ├── Gemini CLI (Ultra acct)      │
│ • Rate limiting       │    │ └── Consensus diffing            │
│                       │    │ CF Tunnel (QUIC) — REST only     │
└──────────────────────┘    └──────────────────────────────────┘
```

## Data Flow (Execute Path)

```
vault-mcp execute tool
  → D1: create task (ULID)
  → executor.deltaops.dev/execute (proxy)
    → Claude/Codex/Gemini CLI on VM
    → Mermaid-compressed response
  → D1: log stage (tokens, cost, latency)
  → D1: increment circuit_breaker (daily/monthly)
  → Return: task_id + mermaid + metrics
```

D1 tables with live data: tasks (8), stages (8), circuit_breaker (daily + monthly).

## Auth Model

Auth varies by connection type:
- **Claude.ai → mac-mcp:** Secret path segment in URL
- **Claude.ai → vault-mcp:** Bearer token via MCP connector config
- **CC/scripts → any endpoint:** Bearer token in Authorization header
- **WAF IP allowlist:** Planned, not yet configured

Each layer independently revocable. See ADR-0006 and ADR-0015 (dual-connection model).

## Transport

- **Primary:** Streamable HTTP (current MCP spec)
- SSE endpoint on vault-mcp returns 410 Gone — removed entirely
- See ADR-0008.

## Tool Reference (10 consolidated, vault-mcp)

| Tool | Actions/Params | Purpose |
|------|---------------|---------|
| workflow | init\|spec\|write\|close | Task lifecycle |
| workflow_query | summary\|consensus\|state\|stats\|chooser | Read-only queries |
| task | add\|update\|done\|retro\|list | Human task system (KV) |
| execute | instruction, executor, model, repo | Proxy to VM executor |
| github | read\|write\|pr | GitHub operations |
| checkpoint | load\|save\|decide | State persistence |
| search | query | Transcript search |
| pricing | — | Model pricing from KV |
| health | — | System status |
| backup | — | KV/D1 backup export |

See ADR-0007.

## Key Principles

1. **Model discipline**: Opus orchestrates, Sonnet/Haiku implement (ADR-0005)
2. **Dotfiles as source of truth**: ~/Developer/dotfiles/claude/ → ~/.claude/ via symlinks (ADR-0001)
3. **Cloudflare Tunnel for access**: No open ports on Mac (ADR-0002)
4. **Keychain for secrets**: macOS Keychain (account: osman), never plaintext
5. **Naming**: "workflow" only. vault-db is the D1 database.

## Service Map

| Service | Endpoint | Location | Auth | Status |
|---------|----------|----------|------|--------|
| Mac MCP | mac-mcp.deltaops.dev | Local Mac | Secret path + Bearer | ✅ Healthy |
| vault-mcp | vault.deltaops.dev | CF Worker | Bearer | ✅ Healthy |
| executor | executor.deltaops.dev | Lightsail VM | x-auth-token | ✅ Healthy |
| AI Gateway | CF AI Gateway | Cloudflare | Token | Phase 7 |
