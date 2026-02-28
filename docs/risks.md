<!-- RESUME CONTEXT
What: Known risks — SPOFs, mitigations, residual risks
Why: Tracks operational risks and their mitigations
Next: decisions/ for individual architectural decisions
Depends-on: architecture.md
-->
---
title: "Known Risks"
type: reference
status: active
date: 2026-02-28
tags: [risks, operations, reliability]
---

# Known Risks

## Mac MCP — Single Point of Failure

**Risk:** Mac MCP runs on a single local machine. Mac sleep, crashes, or network issues take it offline.

**Mitigations:**

- Launchd auto-restart with watchdog (10s health check interval)
- VM SSH backup connection as fallback (executor on Lightsail can reach Mac)
- Cloudflare Tunnel reconnects automatically on wake

**Residual:** If the Mac is powered off, no local MCP access until it comes back.

## Cloudflare Concentration

**Risk:** vault-mcp, tunnels, DNS, and D1 all depend on Cloudflare. A Cloudflare outage takes down everything.

**Mitigations:**

- Cloudflare has 99.99% SLA on Workers
- Local MCP server still works on localhost:3001 without the tunnel
- D1 backup tool exports state for recovery

**Residual:** Accepted. Cloudflare's reliability justifies the concentration for a solo project.

## 200K Context Limit

**Risk:** Opus orchestrator has a 200K token hard limit. Complex sessions can exhaust context.

**Mitigations:**

- ~7,500 token overhead for system prompts, leaving ~192K for work
- Checkpoint system in vault-mcp for session continuity
- Decompose large tasks into smaller dispatched CC agents

**Residual:** Very large tasks may still require session handoff.

## Credential Management

**Risk:** Secrets stored in macOS Keychain are only accessible on the local Mac.

**Mitigations:**

- All secrets accessed programmatically via `security find-generic-password`
- Python helper at `~/Developer/dotfiles/claude/scripts/secrets.py`
- Quarterly rotation schedule for Bearer tokens

**Residual:** If Keychain is locked or Mac unavailable, secrets are inaccessible.

## Auth — Secret Path Exposure

**Risk:** Bearer tokens transmitted in HTTP headers could be intercepted.

**Mitigations:**

- TLS everywhere (Cloudflare edge, tunnel encryption, Caddy on VM)
- 3-layer auth: Bearer + CF Access Service Token + Anthropic IP allowlist
- Each layer independently revocable (see [ADR-0006](decisions/0006-three-layer-auth.md))

**Residual:** Closed. Defense in depth makes single-layer compromise insufficient.
