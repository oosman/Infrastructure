<!-- RESUME CONTEXT
What: Task routing — orchestrator/executor split and model discipline
Why: Documents the core workflow pattern and cost management
Next: git-conventions.md for commit/branch standards
Depends-on: architecture.md, decisions/0005-model-discipline.md
-->
---
title: "Task Routing"
type: explanation
status: active
date: 2026-02-28
tags: [workflow, model-discipline, orchestration]
---

# Task Routing

## The Split: Orchestrator vs Executor

The infrastructure enforces a strict separation between planning and execution.

### Orchestrator (Claude.ai — Opus)

- Plans, decomposes tasks, makes architectural decisions
- Runs in Claude.ai conversations with full 200K context
- Dispatches work to executors via `cc_dispatch` through Mac MCP
- **Never executes code directly**

### Executors (CC Agents — Sonnet/Haiku)

- Receive specific, scoped instructions from the orchestrator
- Run as Claude Code agents dispatched by Mac MCP
- Sonnet (default) for implementation, Haiku for simple/fast tasks
- **Never make architectural decisions**

## Model Discipline

This is non-negotiable. See [ADR-0005](decisions/0005-model-discipline.md).

| Role | Model | Cost (in/out per MTok) |
|------|-------|------------------------|
| Orchestrator | Opus | $15 / $75 |
| Executor (default) | Sonnet | $3 / $15 |
| Executor (simple) | Haiku | $0.80 / $4 |

### Enforcement

Mac MCP server rejects `cc_dispatch` calls with `--model opus` or `--model claude-opus`. The `FORBIDDEN_MODELS` array in `server.js` blocks these at the server level before dispatch.

## Dispatch Flow

```
Claude.ai (Opus) → cc_dispatch(name, prompt, cwd) → Mac MCP → Claude Code agent (Sonnet)
                                                         ↓
                                                   cc_status(name) → check progress
                                                   cc_result(name) → get output
                                                   cc_kill(name)   → abort if stuck
```

## When to Use Each Model

| Task | Model | Why |
|------|-------|-----|
| Multi-file refactor | Sonnet | Needs code understanding |
| Write a single function | Haiku | Simple, scoped |
| Run tests and report | Haiku | Mechanical |
| Debug a complex issue | Sonnet | Needs reasoning |
| Architecture decision | Opus (orchestrator) | Planning only |
