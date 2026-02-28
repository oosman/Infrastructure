---
title: "Streamable HTTP over SSE"
status: accepted
date: 2026-02-27
tags: [architecture, transport, cloudflare]
supersedes: null
---

# ADR-0008: Streamable HTTP over SSE

## Context
SSE is deprecated in the MCP spec. mac-mcp already uses Streamable HTTP. SSE has a 100-second timeout cliff on Cloudflare that causes dropped connections.

## Decision
Streamable HTTP as primary transport for all MCP endpoints. SSE kept for backward compatibility on vault-mcp /sse endpoint only.

## Consequences
- ✅ No 100-second timeout issue for request-response tools
- ✅ Aligns with MCP spec direction
- ⚠️ Long-running tasks still need keepalives to avoid idle timeouts
