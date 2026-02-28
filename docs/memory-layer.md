<!-- RESUME CONTEXT
What: Context persistence — three layers of memory across sessions
Why: Documents how context survives compaction and session boundaries
Next: decisions/ for related ADRs (0020, 0022)
Depends-on: workflow.md, architecture.md
-->
---
title: "Context Persistence"
type: explanation
status: active
date: 2026-02-28
tags: [context, compaction, memory]
---

# Context Persistence

## The Problem

AI sessions have finite context windows. Compaction and session boundaries cause context loss. The memory layer ensures critical information persists.

## Three Layers

### Layer 1: Prevention

Delay compaction as long as possible:
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=90` — compact later, not sooner
- Short, focused sessions — avoid hitting the limit
- Decompose large tasks into separate CC agent dispatches

### Layer 2: Capture

Save state before it's lost:
- PreCompact hook copies transcript to a known location
- `/handoff` command writes HANDOFF.md with current session state
- Resume context comments in every doc file (for agent recovery)

### Layer 3: Recovery

Restore context at session start:
- SessionStart hook reminds to read CLAUDE.md + HANDOFF.md
- `/session-resume` skill loads prior context
- KB docs are searchable — agents can find what they need

## Always-Available Context

| Source | Scope | Loaded |
|--------|-------|--------|
| CLAUDE.md | Project instructions | Always (auto-injected) |
| KB docs (docs/) | Architecture, decisions, ops | On search/read |
| Skills/commands | Reusable prompts | On invocation |
| Claude.ai memory | Cross-session facts | Auto (Claude.ai only) |
| HANDOFF.md | Session state snapshot | On session resume |

## Long-Term Source of Truth

The KB site (docs/) is the canonical long-term source of truth. CLAUDE.md is a compressed summary. When they conflict, update CLAUDE.md to match docs/.
