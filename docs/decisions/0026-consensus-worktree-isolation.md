<!-- RESUME CONTEXT
What: ADR-0026 — Consensus runs require worktree isolation
Why: Records the isolation requirement for multi-executor consensus
Next: Implementation in Phase 5
Depends-on: _adr-template.md
-->
---
title: "Consensus Worktree Isolation"
status: accepted
date: 2026-02-28
tags: [consensus, executor]
supersedes: null
---

# ADR-0026: Consensus Worktree Isolation

## Context
Consensus runs dispatch multiple executors against the same task to compare outputs. If executors share a working directory, their changes contaminate each other's diffs, making comparison meaningless.

## Decision
Each executor in a consensus run must operate in a separate git worktree or clone. This is a precondition for Phase 5 (consensus).

## Consequences
- ✅ Clean, independent diffs from each executor
- ✅ Deterministic comparison of outputs
- ⚠️ Disk space overhead for multiple worktrees
- ⚠️ Cleanup logic required after consensus completes
