---
title: "Architecture"
type: explanation
status: active
date: 2026-02-28
tags: [architecture, overview]
---

# Architecture (v2)

## Three-Instance Model

- **Infrastructure** (this repo) — MCP servers, Cloudflare, services, dotfiles
- **Mobile Pipeline** (~/Pipeline/) — AI code generation pipeline (Swift/Kotlin)
- **Personal Projects** — everything else

## System Architecture

```
Claude.ai (Opus 4.6 orchestrator, 200K context)
    │
    │ MCP connections (Streamable HTTP, 3-layer auth)
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Servers                                                     │
│                                                                   │
│  vault-mcp (CF Worker)    mac-mcp (CF Tunnel)    executor-mcp    │
│  ┌──────────────────┐     ┌──────────────────┐   ┌────────────┐ │
│  │ McpAgent class    │     │ Node.js + Express│   │ Lightsail  │ │
│  │ Streamable HTTP   │     │ Streamable HTTP  │   │ Direct HTTPS│ │
│  │ D1 + KV + DO      │     │ HTTP/2 tunnel    │   │ or Tunnel  │ │
│  │ 10 consolidated   │     │ 3-layer auth     │   │ Bearer auth│ │
│  │ tools             │     │ SSE keepalive    │   │ Caddy + TLS│ │
│  │ Bearer + CF Access│     │ 11 tools         │   │            │ │
│  └──────────────────┘     └──────────────────┘   └────────────┘ │
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
└──────────────────────┘    └──────────────────────────────────┘
```

## Auth Model (3-Layer)

1. **Bearer token** — app-level, per-endpoint, in Authorization header
2. **CF Access Service Token** — edge enforcement, CF-Access-Client-Id/Secret headers
3. **Anthropic IP allowlist** — WAF rule blocking non-Anthropic IPs on MCP hostnames

Each layer independently revocable. See ADR-0006.

## Transport

- **Primary:** Streamable HTTP (current MCP spec)
- **Deprecated:** SSE (kept on vault-mcp /sse for backward compat)
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
5. **Naming**: "workflow" not "pipeline" (except pipeline-db D1 resource)

## Service Map

| Service | Endpoint | Location | Auth | Status |
|---------|----------|----------|------|--------|
| Mac MCP | mac-mcp.deltaops.dev | Local Mac | 3-layer (Phase 1) | 🔴 No auth |
| vault-mcp | vault.deltaops.dev | CF Worker | Bearer | 🟢 Healthy |
| executor | executor.deltaops.dev | Lightsail VM | Bearer (Phase 1) | 🟡 SSH dead |
| AI Gateway | CF AI Gateway | Cloudflare | Token | Phase 7 |
