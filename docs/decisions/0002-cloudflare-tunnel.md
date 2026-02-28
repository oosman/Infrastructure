<!-- RESUME CONTEXT
What: ADR-0002 — Cloudflare Tunnel for Mac access
Why: Records the decision to use CF Tunnel instead of open ports
Next: Implementation in local-mcp setup
Depends-on: _adr-template.md
-->
---
title: "Cloudflare Tunnel for MCP Access"
status: accepted
date: 2026-02-24
tags: [infrastructure, networking, cloudflare]
supersedes: null
---

# ADR-0002: Cloudflare Tunnel for MCP Access

## Context
Need secure remote access to local Mac MCP server from Claude.ai without exposing ports.

## Decision
Use Cloudflare Tunnel (cloudflared) to route mac-mcp.deltaops.dev → localhost:3001. No Tailscale, no port forwarding.

## Consequences
- ✅ Native to Cloudflare stack (DNS, Workers, Tunnel all in one)
- ✅ Zero open ports on local machine
- ⚠️ Depends on Cloudflare availability
- ⚠️ Tunnel reconnections can cause brief MCP timeouts
