# Phase 8 — Context Continuity Session Prompt

## Read First
- `docs/completion.md` — canonical ledger, update when done
- `CLAUDE.md` — repo context

## Context
Phases 0-7 complete. This phase targets **Claude.ai sessions** (the orchestrator), not CC agents. Claude.ai has no slash commands, no hooks, no settings.json. It has: project instructions, project files, MCP tools (vault-mcp, mac-mcp, portal), memory, and conversation context.

## The Problem
Claude.ai sessions lose context through:
1. **Compaction** — context window fills up, older messages get summarized/dropped
2. **Session boundaries** — new conversation = blank slate except memory + project files
3. **vault-mcp outages** — if MCP tools fail, no task tracking or checkpoints

## What Already Exists
- vault-mcp checkpoint tool: `load` (recovery doc from D1), `save` (captures open tasks + decisions + blockers), `decide` (records decisions)
- `docs/completion.md` in project files — canonical ledger
- Claude.ai memory system (userMemories) — persists across sessions
- Project instructions (this session prompt pattern) — read-only context

## What Phase 8 Delivers

### 8.1 Session Canary
Add to **project instructions** (the system prompt Osama configures in Claude.ai):
> On session start: call `health` tool via vault-mcp. If it fails, inform user that vault-mcp is unreachable and you're operating in degraded mode (no D1 logging, no checkpoints).

This is a behavioral instruction, not code. Update the project instructions text to include it.

### 8.2 Degraded Mode Behavior
Define what Claude.ai does when vault-mcp is down — again, project instructions:
- Track tasks via Mac MCP: `write_file` to `~/Developer/infrastructure/.fallback/tasks.md`
- Save checkpoints to: `write_file` to `~/Developer/infrastructure/.fallback/checkpoint.md`
- On recovery: read fallback files and reconcile with vault-mcp

### 8.3 Pre-Compaction Checkpoint
Claude.ai can't detect compaction programmatically. Instead:
- Add to project instructions: "When context is getting long (you've been working for a while), proactively save a checkpoint via vault-mcp before the system compacts."
- Template the checkpoint content: current objective, what's done this session, what's next, key file paths modified, recent decisions
- This is behavioral guidance, not automation

### 8.4 Session Handoff Protocol
When a session ends (user says "done" or "wrapping up"):
1. Call `checkpoint(action: "save")` with objective, recent_actions, blockers
2. Update `docs/completion.md` via Mac MCP (write_file) with anything completed
3. Summarize: what changed, what's next, any blockers
4. The NEXT session can call `checkpoint(action: "load")` to recover

Document this protocol in project instructions.

### 8.5 Dashboard (React Artifact)
Build a React artifact (.jsx) that Claude.ai can render inline. It should:
- Call vault-mcp tools: `workflow_query(query: "stats")`, `health()`, `task(action: "list")`
- Display: cost by model/day, recent tasks, circuit breaker status, service health
- Use Anthropic API-in-artifacts to make vault-mcp calls OR accept pre-fetched data as props

**Important:** This is a Claude.ai artifact, not a deployed web app. It renders in the chat.

## Deliverables (all are text/docs, not code deployments)
1. Updated project instructions text (for Osama to paste into Claude.ai project settings)
2. `.fallback/` directory created with README
3. Dashboard React artifact file (can be kept in repo for reuse)
4. `docs/completion.md` updated with Phase 8 items
5. `docs/memory-layer.md` updated to reflect actual Claude.ai patterns (not CC patterns)

## What This Phase Does NOT Do
- No CC slash commands (those already exist, separate concern)
- No compaction hooks (Claude.ai doesn't support them)
- No settings.json changes (CC only)
- No vault-mcp code changes (checkpoint tool works fine)

## Validation Criteria
- [ ] Project instructions include: canary, degraded mode, pre-compaction checkpoint, handoff protocol
- [ ] `.fallback/` directory exists with README explaining purpose
- [ ] Dashboard artifact renders in Claude.ai with task/cost/health data
- [ ] `docs/memory-layer.md` accurately describes Claude.ai context persistence (not CC)
- [ ] Full lifecycle test: start session → load checkpoint → do work → save checkpoint → end session → start new session → load checkpoint → verify continuity

## Rules
- This is a documentation/instructions phase, minimal code
- Don't modify vault-mcp (checkpoint tool works)
- Update docs/completion.md with results
- Commit: `feat: phase 8 — context continuity for claude.ai sessions`
