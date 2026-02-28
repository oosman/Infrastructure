<!-- RESUME CONTEXT
What: ADR-0017 — Naming conventions (infrastructure/workflow only)
Why: Records the naming purge eliminating legacy terms
Next: Enforcement via grep audits
Depends-on: _adr-template.md
-->
---
title: "Naming: Infrastructure and Workflow Only"
status: accepted
date: 2026-02-28
tags: [naming, conventions]
supersedes: null
---

# ADR-0017: Naming: Infrastructure and Workflow Only

## Context
The project accumulated inconsistent naming: "pipeline", "deltaforce", and other legacy terms appeared across code, docs, and conversation. Ambiguous naming causes confusion during context recovery and cross-session work.

## Decision
Use "infrastructure" for the repo/project and "workflow" for the task orchestration system. Never use "pipeline" or "deltaforce". All legacy naming has been purged.

## Consequences
- ✅ Consistent terminology across all docs, code, and conversation
- ✅ Easier context recovery — names match what things actually are
- ⚠️ Requires vigilance to avoid regression in new content
