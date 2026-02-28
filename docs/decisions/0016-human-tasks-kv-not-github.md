<!-- RESUME CONTEXT
What: ADR-0016 — Human tasks use KV not GitHub Issues
Why: Records why task tracking uses Workers KV instead of GitHub
Next: Implementation in vault-mcp task tool
Depends-on: _adr-template.md
-->
---
title: "Human Tasks KV Not GitHub"
status: accepted
date: 2026-02-28
tags: [tasks, vault-mcp]
supersedes: null
---

# ADR-0016: Human Tasks KV Not GitHub

## Context
Human tasks need to be accessible from every surface — Claude.ai, CC agents, and iPhone (via MCP). GitHub Issues requires API auth setup per client and has heavyweight metadata. A simpler system is needed.

## Decision
Human tasks use vault-mcp Workers KV with binary status (open/done), freeform project strings, and ULID keys. Every surface with MCP access can read/write tasks via the `task` tool.

## Consequences
- ✅ Universal access from any MCP-connected surface
- ✅ Simple binary status — no workflow state machine
- ✅ ULID keys provide time-ordered, collision-free IDs
- ⚠️ No built-in labels, milestones, or assignees (by design)
