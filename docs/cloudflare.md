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
date: 2026-02-27
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
| executor.deltaops.dev | Cloudflare Tunnel → Lightsail VM | Tunnel (future) |

## Workers

- vault-mcp: Workflow state, tasks, GitHub integration. Free tier.

## Tunnels

- local-mcp tunnel: Mac → mac-mcp.deltaops.dev (4 ORD connections, http2Origin enabled)
- executor tunnel: Lightsail → executor.deltaops.dev (future, Phase 3)

## Resources

- D1 database (vault-db): workflow state tables
- Workers KV: human task storage (TASKS_KV namespace)
- Durable Objects: McpAgent backing store
