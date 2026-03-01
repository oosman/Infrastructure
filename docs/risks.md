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
- Backup SSH path: VM can SSH to Mac via CF Tunnel (ssh-mac.deltaops.dev), kill stuck processes, launchd auto-restarts
- Cloudflare Tunnel reconnects automatically on wake
- Sleep prevention via pmset and active processes

**Residual:** If the Mac is powered off, no local MCP access until it comes back.

## Cloudflare Concentration

**Risk:** vault-mcp, tunnels, DNS, and D1 all depend on Cloudflare. A Cloudflare outage takes down everything.

**Mitigations:**

- Cloudflare has 99.99% SLA on Workers
- Local MCP server still works on localhost:3001 without the tunnel
- D1 backup tool exports state for recovery

**Residual:** Accepted. Cloudflare's reliability justifies the concentration for a solo project.

## vault-mcp Outage (Degraded Mode)

**Risk:** vault-mcp (Cloudflare Worker) becomes unreachable due to deployment issues, Cloudflare incident, or auth misconfiguration. Sessions lose access to task tracking, checkpoints, and workflow state.

**Mitigations:**

- Session canary protocol: `task(action: "list")` as Step 0 detects outage immediately ([ADR-0031](decisions/0031-session-canary-degraded-mode.md))
- Degraded mode: tasks written to `~/.claude/tasks-fallback.md`, checkpoints to `~/.claude/checkpoints-fallback.md`
- Fallback files are symlinked from dotfiles (git-tracked, survives reinstalls)
- All local tooling (mac-mcp, CC agents, git) continues working in degraded mode
- On recovery: reconcile local fallback with D1 manually

**Residual:** Fallback files are append-only markdown — no structured queries, no circuit breaker enforcement. Manual reconciliation required on recovery.

## 200K Context Limit

**Risk:** Opus orchestrator has a 200K token hard limit. Complex sessions can exhaust context.

**Mitigations:**

- ~7,500 token overhead for system prompts, leaving ~192K for work
- `/compact` command saves vault-mcp checkpoint + local handoff before compaction
- PreCompact hook backs up transcript automatically
- SessionStart hook after compaction reminds to read CLAUDE.md + HANDOFF.md
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

**Risk:** Bearer tokens and secret path segments transmitted over HTTPS could theoretically be intercepted.

**Mitigations:**

- TLS everywhere (Cloudflare edge, tunnel encryption)
- Auth model: secret path segments (Claude.ai), Bearer tokens (CC/scripts), WAF IP allowlist (planned)
- Each layer independently revocable (see [ADR-0006](decisions/0006-three-layer-auth.md), [ADR-0015](decisions/0015-dual-connection-model.md))

**Residual:** Closed. Defense in depth makes single-layer compromise insufficient.

## Claude CLI --strict-mcp-config Bug

**Risk:** Claude Code CLI v2.1.55-2.1.63 silently exits with no API call when `--strict-mcp-config` is passed with `--mcp-config "{}"`. The CLI starts, resolves auth, but never sends a request to the API.

**Mitigation:** Removed `--strict-mcp-config` from executor spawn args. CLI loads account MCP servers (~2s overhead) then proceeds normally.

**Residual:** Minor latency overhead from MCP server loading. If a future CLI update fixes this, the flag can be re-added to skip MCP loading.

**Status:** Mitigated. See [ADR-0029](decisions/0029-cli-strict-mcp-workaround.md).

## Mac MCP — Zero Auth Window (Closed)

**Risk:** Mac MCP ran with no authentication briefly during initial setup.

**Resolution:** Secret path segments implemented. mac-mcp returns 401 without valid path. Bearer token also accepted for CC/scripts.

**Status:** Closed.
