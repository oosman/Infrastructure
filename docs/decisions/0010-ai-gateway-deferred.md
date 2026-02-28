<!-- RESUME CONTEXT
What: ADR-0010 — AI Gateway deferred to Phase 7
Why: Records deferring CF AI Gateway integration
Next: Implementation in Phase 7
Depends-on: _adr-template.md
-->
---
title: "AI Gateway Deferred Until Traffic"
status: accepted
date: 2026-02-27
tags: [architecture, cloudflare, ai-gateway]
supersedes: null
---

# ADR-0010: AI Gateway Deferred Until Traffic

## Context
No programmatic API traffic exists until orchestration wiring is complete. The only calls will be classification passes (~$0.002/task) — not enough volume to justify gateway overhead now.

## Decision
Create AI Gateway in Phase 7 after orchestration works. Route classification calls only. Expand when traffic grows.

## Consequences
- ✅ No premature optimization — gateway value scales with volume
- ✅ Simpler initial architecture with fewer moving parts
- ⚠️ Manual cost tracking until gateway is in place
