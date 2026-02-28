<!-- RESUME CONTEXT
What: ADR-0023 — Circuit breakers for auxiliary API costs only
Why: Records cost control thresholds for infrastructure
Next: Implementation in vault-mcp circuit breaker logic
Depends-on: _adr-template.md
-->
---
title: "Circuit Breakers Auxiliary Only"
status: accepted
date: 2026-02-28
tags: [cost, circuit-breakers]
supersedes: null
---

# ADR-0023: Circuit Breakers Auxiliary Only

## Context
The Max subscription covers orchestrator and CC agent costs at $0 marginal. Auxiliary costs (classification calls, AI Gateway, external APIs) need guardrails to prevent runaway spending.

## Decision
Circuit breakers apply to auxiliary API costs only. Max subscription is excluded. Thresholds: $2/task alert, $5/task halt, $20/day pause, $80/month review.

## Consequences
- ✅ Cost protection without blocking core orchestration
- ✅ Clear escalation path: alert → halt → pause → review
- ⚠️ Requires accurate cost tracking per task in vault-mcp
