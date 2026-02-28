---
title: "Tool Consolidation (20 → 10)"
status: accepted
date: 2026-02-27
tags: [architecture, vault-mcp, tools]
supersedes: null
---

# ADR-0007: Tool Consolidation (20 → 10)

## Context
vault-mcp had 20+ tools. Schema overhead was ~5,000 tokens per session start, consuming context budget on every conversation.

## Decision
Consolidate to 10 tools using action/query parameters for sub-operations: workflow(action: init|spec|write|close), workflow_query(query: summary|consensus|state|stats|chooser), task, execute, github, checkpoint, search, pricing, health, backup.

## Consequences
- ✅ ~3,000 tokens saved per session start
- ✅ Cleaner mental model for tool selection
- ⚠️ Slightly more complex tool implementations with action routing
