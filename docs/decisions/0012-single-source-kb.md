<!-- RESUME CONTEXT
What: ADR-0012 — Single-source KB with flat docs/ and frontmatter typing
Why: Records the decision to use docs/ as the canonical knowledge base
Next: Implementation in Phase 0
Depends-on: _adr-template.md
-->
---
title: "Single-Source KB"
status: accepted
date: 2026-02-28
tags: [kb, architecture]
supersedes: null
---

# ADR-0012: Single-Source KB

## Context
Documentation could live in multiple places (wiki, Notion, separate docs repo) or be organized into Diataxis directories. A single flat docs/ directory with frontmatter typing keeps things simple and version-controlled.

## Decision
docs/ IS the documentation. Zensical renders it. No Diataxis subdirectories — use YAML frontmatter `type` field (explanation, reference, how-to, overview) instead of directory structure.

## Consequences
- ✅ Single source of truth — docs/ is canonical, git-tracked
- ✅ Flat structure is easy to navigate and search
- ✅ Frontmatter typing provides categorization without directory nesting
- ⚠️ Large doc sets may eventually need subdirectories
