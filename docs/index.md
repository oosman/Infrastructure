---
title: "Home"
type: overview
status: active
date: 2026-02-28
tags: [home, overview]
---

# Infrastructure Knowledge Base

Local dev infrastructure: MCP servers, Cloudflare tunnels, launchd services, vault-mcp, and dotfiles.

## What's Here

- **[Architecture](architecture.md)** — System diagram, auth model, transport, tool reference
- **[Setup](setup.md)** — Prerequisites, dotfiles, secrets, verification
- **Services**
    - [Mac MCP](local-mcp.md) — Node.js MCP server on localhost, exposed via Cloudflare Tunnel
    - [Vault MCP](vault-mcp.md) — Cloudflare Worker for workflow state, tasks, GitHub integration
    - [Cloudflare](cloudflare.md) — DNS, Workers, Tunnels, D1, KV
- **Operations**
    - [Task Routing](task-routing.md) — Model discipline and orchestrator/executor split
    - [Git Conventions](git-conventions.md) — Branching, commits, PRs, merge strategy
    - [Known Risks](risks.md) — SPOFs, mitigations, operational constraints
- **[Decisions](decisions/0001-foundational-constraints.md)** — Architecture Decision Records (ADR-0001 through ADR-0010)

## Quick Verification

```bash
curl -sf http://127.0.0.1:3001/health          # Mac MCP server
curl -sf http://127.0.0.1:20241/ready           # Cloudflare Tunnel
launchctl list | grep com.osman                 # All launchd services
```
