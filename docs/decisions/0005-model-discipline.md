<!-- RESUME CONTEXT
What: ADR-0005 — Model discipline (Opus orchestrates, Sonnet/Haiku executes)
Why: Records the core cost and capability separation
Next: Enforcement in mac-mcp server
Depends-on: _adr-template.md
-->
---
title: "Model Discipline Rule"
status: accepted
date: 2026-02-27
tags: [architecture, constraints, models]
supersedes: null
---

# ADR-0005: Model Discipline Rule

## Context
Opus is expensive ($5/$25 per MTok) and should be reserved for planning/orchestration. Dispatching Opus for implementation work wastes the cost advantage of the model ladder.

## Decision
Opus plans and orchestrates ONLY (Claude.ai conversations). All CC agents dispatched via cc_dispatch MUST use sonnet (default) or haiku. Never opus. Enforced server-side: Mac MCP server has FORBIDDEN_MODELS array that rejects opus dispatch requests.

## Consequences
- ✅ Cost discipline — implementation work uses $3/$15 Sonnet, not $5/$25 Opus
- ✅ Server-side enforcement prevents accidental misuse
- ⚠️ If a task genuinely needs Opus-level reasoning, must be done in Claude.ai conversation, not delegated
