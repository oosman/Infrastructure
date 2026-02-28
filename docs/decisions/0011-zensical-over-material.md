<!-- RESUME CONTEXT
What: ADR-0011 — Zensical over MkDocs Material
Why: Records the switch from MkDocs Material to Zensical and its rationale
Next: Implementation in Phase 0
Depends-on: _adr-template.md
-->
---
title: "Zensical over MkDocs Material"
status: accepted
date: 2026-02-28
tags: [kb, rendering]
supersedes: null
---

# ADR-0011: Zensical over MkDocs Material

## Context
MkDocs Material is entering maintenance mode — the Insiders repo was deleted in May 2026. The KB needs a rendering engine that is actively maintained and compatible with existing mkdocs.yml configuration.

## Decision
Use Zensical as the documentation renderer. It provides mkdocs.yml compatibility, Disco search, and a clean default theme. Material remains a 5-minute fallback since config is compatible.

## Consequences
- ✅ Active development and support from Zensical maintainers
- ✅ Drop-in replacement — existing mkdocs.yml works with minimal changes
- ✅ Disco search replaces Material's search plugin
- ⚠️ Some Material-specific features (Insiders) are unavailable
