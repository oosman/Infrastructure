---
title: "Architecture"
type: explanation
status: active
date: 2026-02-27
tags: [architecture, overview]
---

# Architecture

## Three-Instance Model

Development is organized into three isolated instances, each with its own repo, CLAUDE.md, and Claude.ai project:

- **Infrastructure** (this repo) — MCP servers, Cloudflare, services, dotfiles management
- **Mobile Codegen** (future) — Swift/Kotlin mobile app development
- **Personal Projects** — everything else

## System Architecture

```
Claude.ai (Opus 4.6, orchestrator, 200K context)
  │
  ├── Mac MCP (mac-mcp.deltaops.dev)
  │   ├── Shell commands on local Mac
  │   ├── File read/write
  │   ├── CC agent dispatch (Sonnet/Haiku only)
  │   └── Localhost:3001, Cloudflare Tunnel
  │
  ├── vault-mcp (vault.deltaops.dev)
  │   ├── Pipeline state (D1 database)
  │   ├── Human task system (Workers KV)
  │   ├── GitHub read/write
  │   └── Cloudflare Worker
  │
  └── executor (executor.deltaops.dev)
      ├── Claude Code, Codex CLI, Gemini CLI
      └── AWS Lightsail VM (future)
```

## Key Principles

1. **Model discipline**: Opus orchestrates, Sonnet/Haiku implement (see ADR-0005)
2. **Dotfiles as source of truth**: ~/dotfiles/claude/ → ~/.claude/ via symlinks (see ADR-0001)
3. **Cloudflare Tunnel for access**: No open ports, no Tailscale (see ADR-0002)
4. **Keychain for secrets**: macOS Keychain (account: osman), never plaintext in configs

## Service Map

| Service | Endpoint | Location | Status |
|---------|----------|----------|--------|
| Mac MCP | mac-mcp.deltaops.dev | Local Mac | Operational |
| vault-mcp | vault.deltaops.dev | Cloudflare Worker | Operational |
| executor | executor.deltaops.dev | Lightsail VM | Planned |
