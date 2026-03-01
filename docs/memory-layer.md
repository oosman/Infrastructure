<!-- RESUME CONTEXT
What: Context persistence — four layers of memory across sessions
Why: Documents how context survives compaction, outages, and session boundaries
Next: decisions/ for related ADRs (0020, 0022, 0031)
Depends-on: workflow.md, architecture.md
-->
---
title: "Context Persistence"
type: explanation
status: active
date: 2026-02-28
tags: [context, compaction, memory, degraded-mode]
---

# Context Persistence

## The Problem

AI sessions have finite context windows. Compaction and session boundaries cause context loss. vault-mcp outages can remove access to task and checkpoint data. The memory layer ensures critical information persists through all of these.

## Four Layers

### Layer 0: Canary (Session Start)

Every session begins with a health check — `task(action: "list")` via vault-mcp. This determines whether the session operates in normal or degraded mode. See [ADR-0031](decisions/0031-session-canary-degraded-mode.md).

- **Reachable:** Normal mode. vault-mcp is the source of truth for tasks, checkpoints, workflow state.
- **Unreachable:** Degraded mode. Tasks written to `~/.claude/tasks-fallback.md`, checkpoints to `~/.claude/checkpoints-fallback.md`. Both are symlinked from dotfiles (git-tracked). On recovery, reconcile local fallback with D1.

### Layer 1: Prevention

Delay compaction as long as possible:
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=90` — compact later, not sooner
- Short, focused sessions — avoid hitting the limit
- Decompose large tasks into separate CC agent dispatches

### Layer 2: Capture

Save state before it's lost:
- `/compact` command — saves vault-mcp checkpoint + local HANDOFF.md before compaction
- PreCompact hook copies transcript to a known location
- `/handoff` command — auto-saves checkpoint, git log (5 commits), open tasks from D1, structured markdown
- `/done` command — end-of-session trailing-reasoning capture
- Resume context comments in every doc file (for agent recovery)

### Layer 3: Recovery

Restore context at session start:
- Canary (Layer 0) determines normal vs degraded mode
- SessionStart hook reminds to read CLAUDE.md + HANDOFF.md
- `/session-resume` skill loads prior context
- KB docs (docs/) are searchable — agents can find what they need
- `checkpoint(action: "load")` restores latest vault-mcp checkpoint with open tasks, decisions, Mermaid diagram

## Always-Available Context

| Source | Scope | Loaded | Degraded Mode |
|--------|-------|--------|---------------|
| CLAUDE.md | Project instructions | Always (auto-injected) | ✅ Available |
| KB docs (docs/) | Architecture, decisions, ops | On search/read | ✅ Available |
| Skills/commands | Reusable prompts | On invocation | ✅ Available |
| Claude.ai memory | Cross-session facts | Auto (Claude.ai only) | ✅ Available |
| HANDOFF.md | Session state snapshot | On session resume | ✅ Available |
| vault-mcp checkpoint | D1 state + open tasks + decisions | On load | ❌ Fallback file |
| vault-mcp tasks | KV task list | On list | ❌ Fallback file |

## Fallback Files (Degraded Mode)

| File | Path | Purpose |
|------|------|---------|
| `tasks-fallback.md` | `~/.claude/tasks-fallback.md` | Append-only task log when vault-mcp is down |
| `checkpoints-fallback.md` | `~/.claude/checkpoints-fallback.md` | Append-only checkpoint log when vault-mcp is down |
| `degraded.log` | `~/.claude/degraded.log` | Timestamped log of degraded mode entries |

All fallback files are symlinked from `~/Developer/dotfiles/claude/` and git-tracked.

## Long-Term Source of Truth

The KB site (docs/) is the canonical long-term source of truth. CLAUDE.md is a compressed summary. When they conflict, update CLAUDE.md to match docs/.
