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

## Execute Tool Lifecycle (Phase 5)

When the `execute` MCP tool is called:

1. **Circuit breaker check** — query D1 `circuit_breaker` table ($20/day halt, $80/month alert)
2. **Create task** — insert into D1 `tasks` table, get ULID task_id
3. **Proxy to executor** — forward instruction + task_id to executor.deltaops.dev
4. **Log stage** — insert into D1 `stages` table (model, tokens, cost, latency)
5. **Increment circuit breaker** — update daily/monthly cost accumulators
6. **Return** — task_id, mermaid diagram, metrics, stage info

Cost estimation uses per-executor rates: Claude ($3/$15 per MTok), Codex ($2.5/$10), Gemini ($1.25/$5).

### Escalation Protocol (5.6)

On task-quality failure (test_fail, wrong_file, unknown), the execute tool automatically retries with the next-tier model:

```
DeepSeek → Gemini Flash → Gemini 2.5 Pro → Codex → Sonnet → Opus → Consensus → Human
```

Infrastructure failures (auth_failure, timeout, syntax_error) do NOT escalate — they fail immediately.
Max 3 sequential attempts before consensus, 5 total attempts absolute cap.

## Current Focus

The active work stream is building the infrastructure itself — the system that will later orchestrate builds and other projects. This is organized into phases:

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | KB Bootstrap (docs, ADRs, commands, skills, resume context) | ✅ Complete |
| 1 | Emergency Security (auth on all endpoints, SSH, secrets) | ✅ Complete |
| 2 | SSE Reliability & Mac Hardening (keepalive, watchdog, logs) | ✅ Complete |
| 3 | vault-mcp v2 (Streamable HTTP, 10 tools, D1+KV) | ✅ Complete |
| 4 | Executor Hardening (systemd, memory/CPU limits, dedicated user) | ✅ Complete |
| 5 | Orchestration Wiring (execute→D1 lifecycle, circuit breakers, mermaid) | ✅ Complete |
| 6 | Portal Spike (MCP Server Portal evaluation) | 🔄 Next |
| 7 | AI Gateway (classification routing, cost analytics) | Planned |
| 8 | Context Continuity (compaction, session handoff) | Planned |

## Principles

- **Humans own intent and curation**, machines own implementation and validation
- **Model discipline**: Opus plans, Sonnet/Haiku implements (see [ADR-0005](decisions/0005-model-discipline.md))
- **Decomposition over monoliths**: break large tasks into scoped CC agent dispatches
- **Validate before accepting**: every task result is checked by the orchestrator
