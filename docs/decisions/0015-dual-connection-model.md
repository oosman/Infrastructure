<!-- RESUME CONTEXT
What: ADR-0015 — Dual connection model for MCP servers
Why: Records that Claude.ai and CC/scripts use different auth paths
Next: Implementation in Phase 1 (auth)
Depends-on: _adr-template.md
-->
---
title: "Dual Connection Model"
status: accepted
date: 2026-02-28
tags: [auth, mcp]
supersedes: null
---

# ADR-0015: Dual Connection Model

## Context
Claude.ai connects to MCP servers through Cloudflare Access (no Bearer header possible — the UI doesn't support custom headers). CC agents and scripts connect directly with Bearer tokens. Both paths must work simultaneously on the same server.

## Decision
Support dual auth: Claude.ai authenticates via CF Access Service Token (edge-enforced), while CC/scripts authenticate via Bearer token in the Authorization header. The server accepts either path.

## Consequences
- ✅ Claude.ai and CC agents can use the same MCP server concurrently
- ✅ Each auth path is independently revocable
- ⚠️ Server auth middleware must handle both paths without conflict
