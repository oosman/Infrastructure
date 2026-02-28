<!-- RESUME CONTEXT
What: Cloudflare services — DNS, Workers, Tunnels, D1, KV
Why: Documents all Cloudflare resources used by infrastructure
Next: task-routing.md for operational details
Depends-on: architecture.md
-->
---
title: "Cloudflare Services"
type: reference
status: active
date: 2026-02-28
tags: [cloudflare, infrastructure]
---

# Cloudflare Services

## Domain

deltaops.dev — managed via Cloudflare DNS.

## Subdomains

| Subdomain | Target | Type |
|-----------|--------|------|
| vault.deltaops.dev | Cloudflare Worker (vault-mcp) | Worker route |
| mac-mcp.deltaops.dev | Cloudflare Tunnel → localhost:3001 | Tunnel |
| executor.deltaops.dev | Cloudflare Tunnel → Lightsail VM (QUIC, hardened) | Tunnel ✅ |
| ssh-mac.deltaops.dev | Cloudflare Tunnel → Mac SSH (port 22) | Tunnel |
| mcp-test.deltaops.dev | MCP Server Portal (CF Access OAuth) | Portal ✅ |

## Workers

- vault-mcp: Stateless Worker, Streamable HTTP, 10 MCP tools. Free tier.

## Tunnels

- Mac tunnel: mac-mcp.deltaops.dev (HTTP/2, 4 connections) + ssh-mac.deltaops.dev (SSH)
- Executor tunnel: executor.deltaops.dev (QUIC, retries 5, grace 30s, keepalive 90s, metrics enabled)

## MCP Server Portal

- Portal: mcp-test.deltaops.dev (24 tools: 10 vault + 11 mac + 3 portal)
- Managed OAuth with Dynamic Client Registration
- Access policies on portal + individual servers
- Decision: ADR-0030 (adopt)

## Resources

- D1 database: vault-db (5a0c53ff-963c-48f9-b68d-f13536104aa1) — 8 tables, data flowing (tasks, stages, circuit_breaker accumulating)
- Workers KV: TASKS_KV (0e01cc2910764d66a3cf8910f8e25eff) — human task storage
- Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd
