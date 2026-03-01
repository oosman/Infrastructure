# Closed-Loop Feedback System — Build Plan

> **Date:** 2026-03-01
> **Status:** Approved, in-progress
> **Goal:** Close the feedback loop so KB stays current, sessions start informed, transcripts are captured, and nothing depends on manual updates.

---

## The Problem

Open loop. Agents complete work → git commits → nothing feeds back → KB goes stale → plan goes stale → every session rediscovers reality. completion.md went stale within hours of creation. Agents nag "please update SESSION-STATUS" but nobody does. Static project files in Claude.ai can't self-invalidate.

## Target Architecture

Three sources of truth:
- **GitHub** = agent truth (code, commits, repo state)
- **KB (Zensical)** = human truth (rendered, browsable, auto-rebuilds from git)
- **vault-mcp D1** = system truth (tasks, metrics, sessions, checkpoints, transcripts)

The loop:
```
Agent completes task
  → git commit (code + KB doc update, atomic)
  → GitHub Actions rebuilds KB site
  → User sees current state in browser

Session ends (/done)
  → vault-mcp session_end (one tool call, Claude assembles summary)
  → VPS Chrome captures full verbatim transcript from Claude.ai
  → vault-mcp writes transcript to D1 + GitHub
  → KB rebuilds with session page + full transcript

Next session starts
  → vault-mcp session_start (one tool call, zero params)
  → Returns scoped context for THIS track only
  → No stale files, no manual updates, no wasted tokens
```

## Design Principles

1. **One tool call each** for session_start and session_end. Zero follow-up questions.
2. **Scoped context, not lean context.** Load everything relevant to your track. Load nothing from other tracks.
3. **No local dependencies.** VPS Chrome handles transcript capture. Works from phone, laptop, anywhere.
4. **KB update is infrastructure, not convention.** Task isn't done until KB reflects it.
5. **Set project instructions once, never update.** vault-mcp returns live context.

---

## Verified Current State (2026-03-01)

### Working
- KB site live at https://oosman.github.io/Infrastructure/ (200 OK)
- GitHub Actions deploying on push (last run: 2026-03-01 02:55 UTC)
- mkdocs.yml with 43-entry nav, Material theme, mermaid
- 31 ADRs, 10+ KB docs, 16 slash commands, 7 skills
- vault-mcp healthy (10 tools, D1 with 9 tables, 42 open tasks)
- mac-mcp healthy (11 tools, auth working)
- executor HTTP healthy, SSH via direct IP (100.53.55.116)
- SSH hardened: password auth disabled, root login disabled, fail2ban active, UFW enabled
- Chrome 145 + Xvfb installed on VPS, confirmed working with extensions

### Broken / Missing
- ~/.claude is regular directory, NOT symlink to dotfiles
- Chrome extension native host not installed (transcript capture non-functional)
- All KB docs dated Feb 28 (24+ hours stale)
- completion.md manually maintained, already stale
- No post-task KB update enforcement
- No worktree policy for local CC dispatch
- No vault-mcp session_start/session_end tools
- No session registry for parallel session awareness
- No transcript capture pipeline
- Executor SSH blocked via domain (works via direct IP only)
- Log rotation not configured on Mac

---

## Build Order

### Step 0: Fix dotfiles symlink (2 min)
~/.claude is a regular directory. Should be symlink to ~/Developer/dotfiles/claude/.
- Back up current ~/.claude
- Replace with symlink
- Verify all commands/skills/settings resolve

### Step 1: Clean KB to reflect reality (30 min)
Source of truth can't start dirty.
- Update stale docs: architecture.md, workflow.md, risks.md, vault-mcp.md
- Remove false known issues (http2Origin, AWS CLI, minio — all fixed)
- Add verified current state
- Update completion.md with today's work
- Atomic commit + push → KB rebuilds

### Step 2: KB update gate in CLAUDE.md (5 min)
Add enforcement rule to CLAUDE.md:
> "Every git commit that changes code MUST include a corresponding KB update in docs/. Atomic commits only. Task is not done until KB reflects it."

Behavioral enforcement — not perfect, but free and immediate.

### Step 3: Build session_start / session_end in vault-mcp (2-3 hrs)

**session_start() — zero params, one call:**
- D1 canary (health)
- Register this session (generate session_id, store started_at)
- Query active parallel sessions (other tracks)
- Round-robin assignment: first tab gets Track A, next gets Track B
- Return scoped context for assigned track:
  - Track name, last checkpoint state, recent commits on that branch
  - Open blockers, relevant decisions, stale KB docs for this track
  - Other active sessions listed briefly (name + branch only, for collision awareness)
- ~50-100 tokens orientation, not a context dump

**session_end(summary, decisions, commits, outcome, next_steps, conversation_url) — one call:**
- Checkpoint save to D1
- Deregister session from active sessions
- Generate session summary page → docs/sessions/YYYY-MM-DD-{slug}.md
- Write to GitHub via vault-mcp github tool
- Trigger VPS Chrome transcript capture (pass conversation_url)
- GitHub Actions rebuilds KB with session page

**D1 schema addition:**
```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  track TEXT,
  branch TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  last_checkpoint_at TEXT,
  files_touched TEXT,    -- JSON array
  summary TEXT,
  decisions TEXT,        -- JSON array
  commits TEXT,          -- JSON array
  outcome TEXT,
  next_steps TEXT,       -- JSON array
  conversation_url TEXT,
  status TEXT DEFAULT 'active'  -- active | ended | abandoned
);
```

Stale session cleanup: sessions active >24hrs without checkpoint → abandoned.

### Step 4: VPS Chrome transcript capture (1-2 hrs)

**Spike CONFIRMED:** Chrome 145 + Xvfb works on VPS. Extensions load. DevTools protocol accessible.

**Remaining work:**
1. Install Claude in Chrome extension in VPS Chrome profile
2. Authenticate to Anthropic (one-time OAuth, session persists in user-data-dir)
3. Build transcript extraction script:
   - vault-mcp calls executor endpoint with conversation_url
   - Executor starts Chrome via Xvfb (or connects to persistent instance)
   - Navigate to conversation URL
   - Extract full DOM (all messages, pre and post compaction)
   - POST to vault-mcp /transcripts/{session_id}
4. vault-mcp writes to D1 transcripts table + docs/transcripts/YYYY-MM-DD-{slug}.md
5. Git push → KB rebuilds with full verbatim transcript
6. Health check: vault-mcp monitors "last transcript received" timestamp

**Open questions (resolve during implementation):**
- Can extension authenticate via OAuth in Xvfb Chrome? (May need initial interactive auth)
- Does OAuth session persist across Chrome restarts?
- Can extension read Claude.ai while you're also viewing it in your own browser?
- Side panel behavior in Xvfb — does it open? Can we trigger shortcuts programmatically?
- Fallback: If extension doesn't cooperate, use DevTools Protocol directly to read DOM

### Step 5: Worktree policy for local CC dispatch (30 min)
- Modify cc_dispatch behavior: each agent gets its own git worktree
- Auto-cleanup worktree on cc_result
- Merge back to main branch on success
- Prevents parallel CC agents from corrupting each other's work

### Step 6: Set-once project instructions (5 min)
Replace all Claude.ai project files with ONE static instruction:
```
On session start: call vault-mcp session_start() with no parameters.
Use the returned context to orient. Do not ask which session to continue —
infer from the user's first message. If their request could collide with
an active session's files, warn them.

When the user says /done: call vault-mcp session_end() with summary,
decisions, commits, outcome, next_steps, and conversation_url assembled
from conversation context. Do not ask the user for any of this.
```

Never update again. vault-mcp returns live context.

### Step 7: Validate end-to-end
- Start new session → session_start returns scoped context
- Dispatch CC agent → agent commits code + KB update atomically
- KB site rebuilds → change visible in browser
- Say /done → session page generated, transcript captured
- Start another session → session_start reflects everything from previous
- Test parallel: two tabs, two tracks, no collisions
- Test from phone: session_start works, /done works, transcript captured on VPS

---

## Dependencies

```
Step 0 (symlink) → Step 1 (clean KB) → Step 2 (gate rule)
Step 3 (session tools) — independent, can parallel with 0-2
Step 4 (VPS Chrome) — independent, IN PROGRESS (spike done)
Step 5 (worktrees) — independent
Step 6 (project instructions) — depends on Step 3
Step 7 (validation) — depends on ALL
```

**Critical path:** Steps 0→1→2 + Step 3 (parallel) + Step 4 (parallel) → Step 6 → Step 7

**Currently executing:** Step 4 (VPS Chrome spike confirmed, continuing to extension install)

---

## What This Replaces

| Before | After |
|--------|-------|
| /bismillah = 3 tool calls | session_start() = 1 call |
| /done = 5 tool calls + manual updates | session_end() = 1 call |
| completion.md (manual, stale in hours) | docs/sessions/*.md (auto-generated) |
| "Update SESSION-STATUS" agent nagging | Gone — vault-mcp tracks state |
| "Which phase are we on?" re-discovery | session_start returns scoped context |
| No parallel awareness | Active session registry with collision detection |
| No transcript history | Full verbatim transcripts in KB |
| Project files need regular updates | Set once, vault-mcp returns live context |
| Browser extension on laptop (local dep) | VPS Chrome (cloud, works from phone) |
