<!-- RESUME CONTEXT
What: ADR-0031 — Session canary protocol and degraded mode for vault-mcp outages
Why: Documents the decision to add health-check-first session protocol
Next: memory-layer.md for full context persistence documentation
Depends-on: ADR-0007 (vault-mcp tools)
-->
---
title: "Session Canary & Degraded Mode"
status: accepted
date: 2026-02-28
tags: [session, continuity, resilience]
supersedes: null
---

# ADR-0031: Session Canary & Degraded Mode

## Context
vault-mcp (Cloudflare Worker) is the source of truth for tasks, checkpoints, and workflow state. If it becomes unreachable during a session, the session loses access to all persistent state management. Sessions need to detect this immediately and operate gracefully without vault-mcp.

## Decision
Every session begins with Step 0: call `task(action: "list")` via vault-mcp as a canary health check. If reachable, proceed normally. If unreachable, enter degraded mode — tasks append to `~/.claude/tasks-fallback.md`, checkpoints append to `~/.claude/checkpoints-fallback.md`. Both files are symlinked from dotfiles (git-tracked). On vault-mcp recovery, local fallback is reconciled with D1 manually.

The `/compact` and `/handoff` commands save vault-mcp checkpoints when available, falling back to local files when not.

## Consequences
- ✅ Sessions never stall due to vault-mcp outage — work continues with local fallback
- ✅ Fallback files are git-tracked via dotfiles — survive reinstalls and are auditable
- ✅ Canary check is cheap (KV list, no D1 query) and catches issues before real work starts
- ⚠️ Degraded mode loses structured queries, circuit breaker enforcement, and D1 workflow tracking
- ⚠️ Manual reconciliation required on recovery — no automated sync
