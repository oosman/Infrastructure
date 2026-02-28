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

The orchestrator (Claude.ai with human) decomposes intent into concrete tasks. Two execution paths:

1. **Mac:** cc_dispatch via mac-mcp → CC agent (Sonnet) on Mac
2. **VM:** execute tool via vault-mcp → executor on Lightsail → claude/codex/gemini CLI

```
Human intent → Claude.ai (Opus orchestrator)
    → Decompose into tasks with acceptance criteria

Path 1 (Mac):
    → cc_dispatch(name, prompt, cwd) via mac-mcp
    → CC agent (Sonnet) executes on Mac
    → cc_result(name) returns output

Path 2 (VM):
    → execute(instruction, executor) via vault-mcp
    → POST executor.deltaops.dev/execute
    → claude/codex/gemini CLI on Lightsail VM
    → Mermaid-compressed result → D1 logged

    → Orchestrator validates and accepts or retries
    → vault-mcp records workflow state to D1
```

## Current Focus

The active work stream is building the infrastructure itself — the system that will later orchestrate builds and other projects. This is organized into phases:

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | KB Bootstrap (docs, ADRs, commands, skills, resume context) | ✅ Complete |
| 1 | Emergency Security (auth on all endpoints, SSH, secrets) | ✅ Complete |
| 2 | SSE Reliability & Mac Hardening (keepalive, watchdog, logs) | ✅ Complete |
| 3 | vault-mcp v2 (Streamable HTTP, 10 tools, D1+KV) | ✅ Complete |
| 4 | Executor Hardening (systemd, memory/CPU limits, dedicated user) | ✅ Complete |
| 5 | Orchestration Wiring (execute→workflow lifecycle, circuit breakers) | 🔄 Next |
| 6 | Portal Spike (MCP Server Portal evaluation) | 🔄 Next |
| 7 | AI Gateway (classification routing, cost analytics) | Planned |
| 8 | Context Continuity (compaction, session handoff) | Planned |

## Principles

- **Humans own intent and curation**, machines own implementation and validation
- **Model discipline**: Opus plans, Sonnet/Haiku implements (see [ADR-0005](decisions/0005-model-discipline.md))
- **Decomposition over monoliths**: break large tasks into scoped CC agent dispatches
- **Validate before accepting**: every task result is checked by the orchestrator
