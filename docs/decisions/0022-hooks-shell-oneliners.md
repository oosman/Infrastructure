<!-- RESUME CONTEXT
What: ADR-0022 — Compaction hooks are shell one-liners
Why: Records the simplicity constraint for hooks
Next: No further action needed
Depends-on: _adr-template.md
-->
---
title: "Hooks Shell One-Liners"
status: accepted
date: 2026-02-28
tags: [compaction, hooks]
supersedes: null
---

# ADR-0022: Hooks Shell One-Liners

## Context
Compaction hooks could be complex Python scripts with retry logic and API calls. But hooks run in the critical path of context management — complexity here risks breaking the session.

## Decision
Compaction hooks are simple shell one-liners defined in settings.json. No Python, no API calls, no retry logic. The hooks/ directory stays empty. Keep hooks deterministic and fast.

## Consequences
- ✅ Fast execution — no interpreter startup or network calls
- ✅ Easy to debug — visible directly in settings.json
- ⚠️ Limited capability — complex operations must happen elsewhere
