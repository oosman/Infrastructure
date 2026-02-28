<!-- RESUME CONTEXT
What: Infrastructure workflow — how tasks flow from intent to execution
Why: Documents the orchestrator/executor pattern and current work stream
Next: task-routing.md for model discipline details
Depends-on: architecture.md
-->
---
title: "Infrastructure Workflow"
type: explanation
status: active
date: 2026-02-28
tags: [workflow, orchestration]
---

# Infrastructure Workflow

## How Work Flows

The orchestrator (Claude.ai with human) decomposes intent into concrete tasks. Tasks are dispatched to CC agents (Sonnet) on Mac or VM via mac-mcp `cc_dispatch`. Results flow back through conversation. vault-mcp logs workflow state to D1.

```
Human intent → Claude.ai (Opus orchestrator)
    → Decompose into tasks with acceptance criteria
    → cc_dispatch(name, prompt, cwd) via mac-mcp
    → CC agent (Sonnet) executes on Mac or VM
    → cc_result(name) returns output
    → Orchestrator validates and accepts or retries
    → vault-mcp records workflow state to D1
```

## Current Focus

The active work stream is building the infrastructure itself — the system that will later orchestrate mobile app builds and other projects. This is organized into phases:

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | KB Bootstrap (docs, ADRs, resume context) | In progress |
| 1 | Auth hardening (3-layer auth on all endpoints) | Planned |
| 2 | Tunnel stabilization (reconnect, watchdog) | Planned |
| 3 | Executor on VM (CC agent on Lightsail) | Planned |
| 4 | Naming purge and cleanup | Complete |
| 5 | Consensus (multi-executor comparison) | Planned |
| 6 | Workflow state (D1 tables, lifecycle) | Planned |
| 7 | AI Gateway (classification, cost tracking) | Planned |
| 8 | Portal (optional dashboard UI) | Deferred |

## Principles

- **Humans own intent and curation**, machines own implementation and validation
- **Model discipline**: Opus plans, Sonnet/Haiku implements (see [ADR-0005](decisions/0005-model-discipline.md))
- **Decomposition over monoliths**: break large tasks into scoped CC agent dispatches
- **Validate before accepting**: every task result is checked by the orchestrator
