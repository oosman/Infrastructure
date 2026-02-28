<!-- RESUME CONTEXT
What: ADR-0024 — Skip Agent-to-Agent protocol
Why: Records decision to not implement A2A protocol
Next: Re-evaluate after 50 tasks
Depends-on: _adr-template.md
-->
---
title: "Skip A2A Protocol"
status: accepted
date: 2026-02-28
tags: [architecture, protocols]
supersedes: null
---

# ADR-0024: Skip A2A Protocol

## Context
The Agent-to-Agent (A2A) protocol provides multi-agent discovery and communication via JSON-RPC. However, this infrastructure has a single orchestrator dispatching to known executors — no agent discovery is needed.

## Decision
Skip A2A protocol. It adds JSON-RPC overhead and would require rewriting working dispatch code. Re-evaluate after 50 completed tasks when usage patterns are established.

## Consequences
- ✅ No unnecessary protocol overhead
- ✅ Existing cc_dispatch flow remains simple and working
- ⚠️ Multi-agent coordination patterns are manual if needed later
