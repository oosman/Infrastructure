<!-- RESUME CONTEXT
What: ADR-0020 — KB Bootstrap moved to Phase 0
Why: Records why documentation bootstrap precedes all build phases
Next: Execute Phase 0 tasks
Depends-on: _adr-template.md
-->
---
title: "KB Bootstrap Phase Zero"
status: accepted
date: 2026-02-28
tags: [kb, phasing]
supersedes: null
---

# ADR-0020: KB Bootstrap Phase Zero

## Context
KB Bootstrap was originally Phase 9 in the v1 infrastructure plan. However, CC agents need CLAUDE.md and docs/ context during all build phases. Without documentation, agents waste context on rediscovery.

## Decision
Move KB Bootstrap to Phase 0. Complete documentation, ADRs, and resume context before starting any build phase. This ensures all dispatched agents have the context they need from the start.

## Consequences
- ✅ All build phases benefit from documented context
- ✅ CC agents can reference KB docs instead of rediscovering patterns
- ⚠️ Delays the start of implementation phases by one phase
