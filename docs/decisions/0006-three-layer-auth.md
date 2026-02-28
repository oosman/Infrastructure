---
title: "3-Layer Authentication"
status: accepted
date: 2026-02-27
tags: [security, authentication, cloudflare]
supersedes: null
---

# ADR-0006: 3-Layer Authentication

## Context
mac-mcp had zero authentication, exposing remote code execution. All MCP endpoints need defense in depth to prevent unauthorized access.

## Decision
3-layer auth on all endpoints: Bearer token (app-level) + Cloudflare Access Service Token (edge) + Anthropic IP allowlist (WAF). Each layer is independently configured and revocable.

## Consequences
- ✅ Near-zero attack surface — attacker must bypass all three layers
- ✅ Each layer independently revocable without affecting others
- ⚠️ More complex initial setup and credential rotation
