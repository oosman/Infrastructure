<!-- RESUME CONTEXT
What: ADR-0014 — CC uses Max OAuth not Vertex AI
Why: Records the auth choice for Claude Code agents
Next: Re-evaluate at Gate G1 for Vertex
Depends-on: _adr-template.md
-->
---
title: "CC Max OAuth Over Vertex"
status: accepted
date: 2026-02-28
tags: [cc, auth, cost]
supersedes: null
---

# ADR-0014: CC Max OAuth Over Vertex

## Context
Claude Code agents need API access. Options are Max OAuth (device-auth flow, included in Max subscription at $0 marginal cost) or Vertex AI (Google Cloud, per-token billing). 200K context hard limit applies to both.

## Decision
Use Max OAuth for all CC agent dispatch. $0 marginal cost per task. Vertex AI is deferred to Gate G1 evaluation when usage patterns are clearer.

## Consequences
- ✅ Zero marginal cost for CC agent execution
- ✅ Simple auth flow — device-auth, no GCP service accounts
- ⚠️ 200K context hard limit per session
- ⚠️ Vertex may offer better rate limits at scale — revisit at G1
