<!-- RESUME CONTEXT
What: Intent validation — how human intent becomes validated implementation
Why: Documents the core philosophy of human-AI task decomposition
Next: memory-layer.md for context persistence
Depends-on: workflow.md
-->
---
title: "Intent Validation"
type: explanation
status: active
date: 2026-02-28
tags: [intent, workflow]
---

# Intent Validation

## From Intent to Implementation

Human provides intent in natural language via Claude.ai. The orchestrator decomposes it into concrete tasks with acceptance criteria.

```
Human intent (natural language)
    → Orchestrator decomposes into tasks
    → Each task has acceptance criteria
    → CC agent implements
    → Orchestrator validates result against criteria
    → Accept or retry
```

## Core Principle

**Humans own intent and curation. Machines own implementation and validation.**

The human decides *what* to build and *why*. The orchestrator figures out *how* to decompose it. The executor implements it. The orchestrator validates it matches intent.

## Intent Flow for Code Tasks

1. Human states intent in Claude.ai conversation
2. Orchestrator decomposes into scoped task with clear prompt
3. `execute` tool dispatches to CC agent via mac-mcp
4. CC agent produces code changes and result summary
5. Orchestrator reviews result against original intent
6. Accept (commit/deploy) or reject (retry with feedback)

## Plan Validation

The infrastructure plan itself uses this pattern. Each phase has:
- **Intent**: What the phase achieves
- **Acceptance criteria**: How to verify it worked
- **Validation gate**: Tests that must pass before proceeding

This is formalized in the plan validation prompt, ensuring phases aren't marked complete until criteria are met.

## Key Insight

Intent validation prevents drift. Without it, executors may produce technically correct code that doesn't match what was actually needed. The orchestrator acts as the validation layer between human intent and machine output.
