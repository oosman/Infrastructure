<!-- RESUME CONTEXT
What: ADR-0028 — Mermaid diagrams as compression protocol
Why: Records using Mermaid for executor output compression
Next: Implementation in executor response format
Depends-on: _adr-template.md
-->
---
title: "Mermaid Compression Protocol"
status: accepted
date: 2026-02-28
tags: [compression, context]
supersedes: null
---

# ADR-0028: Mermaid Compression Protocol

## Context
Executor output (diffs, logs, explanations) consumes significant orchestrator context. Raw text output from a multi-file change can be thousands of tokens. The orchestrator needs structured summaries, not raw dumps.

## Decision
Use Mermaid diagrams as a compression protocol for executor output. Structured diagrams achieve ~100x compression over raw text, are deterministic, and render visually in documentation. Executors return Mermaid where appropriate.

## Consequences
- ✅ ~100x compression reduces context consumption
- ✅ Deterministic format — easy to parse and compare
- ✅ Renders visually in docs and Claude.ai
- ⚠️ Not all output types are well-suited to diagram format
