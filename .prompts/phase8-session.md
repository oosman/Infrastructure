# Phase 8 — Context Continuity Session Prompt

## Read First
- `docs/completion.md` — canonical ledger, update when done
- `CLAUDE.md` — repo context

## Context
Phases 0-7 complete. This phase improves **Claude.ai session continuity** — how context survives across conversations, compaction, and session boundaries. The target is Claude.ai (Opus orchestrator), NOT CC agents.

## What Already Exists
- `vault-mcp/src/tools/checkpoint.ts` — load/save/decide, builds recovery doc from D1 (open tasks + decisions + blockers)
- `docs/completion.md` — canonical session ledger (read on start, update on finish)
- `docs/memory-layer.md` — documents 3-layer memory model
- Claude.ai memory system — persists facts across conversations automatically
- Claude.ai project files: `infrastructure-plan-merged.md`, `plan-validation-prompt.md`, `CLAUDE.md`
- Project instructions in Claude.ai (read-only from Claude's perspective)
- Compaction triggers at 90% context (CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=90 in CC settings, but Claude.ai has its own compaction)

## What Phase 8 Delivers

### 8.1 Session Start Protocol
Define what Claude.ai should do at the start of every infrastructure session:
1. Call `health()` via vault-mcp as canary — confirms connectivity
2. Read `docs/completion.md` via Mac MCP — know what's done
3. If vault-mcp unreachable → say so, work with Mac MCP only (degraded)

This goes into **project instructions** (the system prompt Osama configures in Claude.ai project settings). Not CLAUDE.md (that's for CC).

### 8.2 Degraded Mode
When vault-mcp tools fail mid-session:
- Don't block the session — continue with Mac MCP tools
- Track decisions/tasks in conversation, summarize at end
- On session end: write catch-up notes via Mac MCP to `~/Developer/infrastructure/.degraded-log.md`
- Next session: reconcile degraded log with vault-mcp when it's back

### 8.3 Session End Protocol
Define what Claude.ai should do before ending a session:
1. Update `docs/completion.md` with what was accomplished (via Mac MCP write_file)
2. Call `checkpoint(action: "save")` with objective, blockers, recent_actions
3. Commit and push changes
4. Summarize: what changed, what's next, any blockers

This also goes into **project instructions**.

### 8.4 Compaction Survival
When Claude.ai compacts context mid-conversation:
- Compaction summary should include: current objective, files modified, decisions made, what's next
- The compaction summary IS the session recovery — make it count
- Test: have a long conversation, let it compact, verify the summary preserves enough to continue

### 8.5 Dashboard (React Artifact)
Build a React artifact that queries vault-mcp tools and displays:
- Cost overview: spend by model, by day (from D1 stages table via `workflow_query(query: "stats")`)
- Recent tasks: status, cost, latency (from `workflow_query(query: "summary")`)
- Circuit breaker: daily/monthly accumulation vs limits
- Service health: vault-mcp, mac-mcp, executor status

This runs **inside Claude.ai** as an artifact. Data comes from vault-mcp MCP tools that are already connected. No deployment needed.

## Deliverables
1. **Updated project instructions** (text for Osama to paste into Claude.ai project settings) — session start/end protocol
2. **Degraded mode pattern** documented in `docs/memory-layer.md`
3. **Dashboard React artifact** (can be saved as .jsx in repo for reuse)
4. **Test results** from: session start → work → compaction → recovery → session end

## Important Distinctions
- **Project instructions** = Claude.ai system prompt (Osama manages via UI, Claude.ai reads)
- **CLAUDE.md** = CC agent context (lives in repo, read by Claude Code)
- **Slash commands** (/handoff, /done, etc.) = CC only, not Claude.ai
- **Memory edits** = Claude.ai's built-in memory, managed via memory_user_edits tool
- This session's output is mostly **text and documentation**, not code deployment

## Validation Criteria
- [ ] Project instructions draft covers session start + end protocol
- [ ] Degraded mode documented and pattern clear
- [ ] Dashboard artifact renders with real data from vault-mcp
- [ ] Compaction test: context survives compaction with enough to continue
- [ ] completion.md updated with Phase 8 results

## Rules
- This is a Claude.ai planning session — orchestrate, don't dispatch CC agents
- vault-mcp checkpoint tool works already — use it, don't rewrite it
- Dashboard is a React artifact, not a deployed app
- Update docs/completion.md with results before ending
