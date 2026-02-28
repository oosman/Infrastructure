<!-- RESUME CONTEXT
What: ADR-0025 — Executors write raw fields, Haiku backfills structured
Why: Records the async classification pattern for task results
Next: Implementation in vault-mcp waitUntil()
Depends-on: _adr-template.md
-->
---
title: "Classification Pass Structured Fields"
status: accepted
date: 2026-02-28
tags: [vault-mcp, classification]
supersedes: null
---

# ADR-0025: Classification Pass Structured Fields

## Context
Executor results need structured metadata (category, complexity, outcome) for analytics and routing decisions. Making executors produce this adds complexity to their prompts and slows responses.

## Decision
Executors write raw_diff and commit_message only. A Haiku/Flash classification pass backfills structured fields asynchronously via waitUntil() in the Worker. Cost: ~$0.002 per task.

## Consequences
- ✅ Executors stay focused on implementation — simpler prompts
- ✅ Classification is async — doesn't block the response
- ⚠️ Structured fields have slight delay before availability
