# Phase 8 — Context Continuity Session Prompt

## Read First
- `docs/completion.md` — canonical ledger, update when done
- `CLAUDE.md` — repo context

## Context
Phases 0-7 complete (assuming 7 runs in parallel). vault-mcp has checkpoint tool (load/save/decide) already working with D1. Dotfiles have 15 slash commands including `/handoff`, `/done`, `/capture`, `/recall`. Compaction triggers at 90% context (CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=90).

## What Already Exists
- `vault-mcp/src/tools/checkpoint.ts` — full implementation: load (latest from D1), save (builds recovery doc with open tasks + decisions + blockers), decide (records to D1 decisions table)
- `/done` command, `/handoff` command, `/capture` command in dotfiles
- `settings.json` with compaction hooks (autocompact at 90%)
- `docs/completion.md` as canonical session ledger
- `docs/memory-layer.md` documenting 3-layer memory model

## What Phase 8 Delivers

### 8.1 Session Canary Protocol
First MCP tool call every session should be `task(action: "list")` as a health check. Implement:
- In CLAUDE.md session protocol: add "Step 0: call task list as canary"
- If vault-mcp unreachable → log warning, enter degraded mode
- Degraded mode: tasks written to local `.claude/tasks-fallback.md`, checkpoint to local file

### 8.2 Degraded Mode Fallback
When vault-mcp is down, sessions should still function:
- Task tracking falls back to local markdown in `~/.claude/tasks-fallback.md`
- Checkpoints fall back to `~/.claude/checkpoints-fallback.md`
- On vault-mcp recovery: reconcile local fallback with D1 (manual or slash command)

### 8.3 Compaction Survival Improvements
Current hooks trigger at 90%. Improve:
- `/compact` command: manually trigger checkpoint save + summary before compaction
- Ensure compaction summary includes: current objective, open tasks, recent decisions, file paths modified
- Test: start session, do work, trigger compaction, verify recovery from checkpoint

### 8.4 Session Handoff Quality
Improve `/handoff` command output:
- Include vault-mcp checkpoint (call save automatically)
- Include recent git log (last 5 commits)
- Include open tasks from D1
- Output as structured markdown suitable for next session's context

### 8.5 Dashboard (React Artifact or HTML)
Simple monitoring view with:
- Cost overview: spend by model, by day, by task type (from D1 stages table)
- Task history: recent tasks with status, cost, latency
- Circuit breaker status: current daily/monthly accumulation vs limits
- Health: all services status

Data source: vault-mcp `workflow_query(query: "stats")` + `health()` tools.

This can be a React artifact in Claude.ai or a standalone HTML page. Keep simple — this is for the operator (Osama), not end users.

## Steps
1. Update CLAUDE.md session protocol with canary
2. Create fallback mechanism (local files when vault-mcp down)
3. Enhance `/compact` command
4. Enhance `/handoff` command to auto-checkpoint
5. Build dashboard artifact
6. Test: full session lifecycle (start → work → compact → handoff → new session → recover)

## File Locations
- Dotfiles commands: ~/Developer/dotfiles/claude/commands/
- Dotfiles hooks: ~/Developer/dotfiles/claude/hooks/
- Settings: ~/Developer/dotfiles/claude/settings.json
- CLAUDE.md (global): ~/Developer/dotfiles/claude/CLAUDE.md
- CLAUDE.md (repo): ~/Developer/infrastructure/CLAUDE.md
- vault-mcp checkpoint: vault-mcp/src/tools/checkpoint.ts (don't rewrite — extend if needed)

## Credentials
- Dotfiles repo: ~/Developer/dotfiles/ (git)
- Infrastructure repo: ~/Developer/infrastructure/ (git)

## Validation Criteria
- [ ] Session canary fires on session start (task list call)
- [ ] Degraded mode works when vault-mcp is unreachable
- [ ] `/compact` saves checkpoint before compaction
- [ ] `/handoff` output includes checkpoint + git log + open tasks
- [ ] Dashboard shows cost, tasks, circuit breaker, health
- [ ] Full lifecycle test: start → work → compact → handoff → new session → recover from checkpoint

## Rules
- Model: sonnet for CC agents
- Don't rewrite checkpoint.ts — it works. Extend or add new files.
- Don't break existing slash commands — enhance them.
- Update docs/completion.md with results before ending.
- Commit messages: `feat: phase 8 — [specific item]`
