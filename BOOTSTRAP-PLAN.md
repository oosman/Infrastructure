# Infrastructure Bootstrap Plan

> **Created:** 2026-02-27
> **Status:** Ready to implement
> **Context:** Full audit completed. This document captures everything needed for implementation without re-auditing.

---

## Goal

Rebuild the dev surface from the ground up. Three-instance model:

1. **PERSONAL** — ~/dotfiles/ ↔ oosman/dotfiles repo. NOW.
2. **INFRASTRUCTURE** — ~/Developer/infrastructure/ ↔ oosman/infrastructure repo. NOW.
3. **FUTURE CODEGEN** — ~/Developer/codegen-future/ ↔ new repo. LATER, after infra is complete.

## Naming Purge

The words **"(legacy)"**, **"(legacy)"**, and **"(legacy)"** must be eliminated from ALL:
- Directory names, repo names, CLAUDE.md files, launchd plists
- .zshrc aliases/functions, Claude.ai project instructions
- CC dispatch default paths, mcp-config.json files
- Mac MCP server.js default cwd

## Model Discipline (NON-NEGOTIABLE)

**Opus plans. Sonnet/Haiku execute. No exceptions.**

| Role | Model | Where |
|------|-------|-------|
| Planning, orchestration, review, decomposition | Opus | Claude.ai, CC (interactive only) |
| All CC agents and subagents | Sonnet (default) or Haiku (trivial) | CC dispatch, CC subagents |
| Automated classification, linting, formatting | Haiku | waitUntil() calls, background tasks |

Rules:
- CC dispatch (`cc_dispatch`) must NEVER use `--model opus`. Server.js should enforce this — reject any dispatch requesting opus.
- CC subagent config (AGENTS.md, agent definitions) must specify `model: sonnet` explicitly.
- Opus is the orchestrator sitting in Claude.ai (or interactive CC). It decides WHAT to do. Sonnet/Haiku do the work.
- If a Sonnet agent fails on a task, escalate to Opus for re-planning — do NOT re-run with Opus as executor.
- This applies to all three instances (personal, infrastructure, future codegen).

Rationale: Opus context is expensive and limited (200K). Using it for execution wastes the orchestrator's context window on implementation details. Sonnet handles 95%+ of coding tasks. Haiku handles mechanical tasks at fraction of the cost. Opus adds value through judgment, not keystrokes.

## Mac MCP Awareness (CRITICAL FOR NEW SESSIONS)

**Problem:** Every new Claude.ai session "forgets" that Mac MCP tools exist. Claude defaults to saying "I can't access your filesystem" or searching past chats, even though Mac:run_command, Mac:read_file, Mac:write_file, Mac:list_dir, Mac:cc_dispatch, Mac:cc_status, Mac:cc_result are all connected.

**Solution:** Project instructions must include this block:

```
## Mac MCP — Local Machine Access

You have DIRECT ACCESS to the user's Mac via Mac MCP tools. These are always available:
- Mac:run_command — execute shell commands
- Mac:read_file — read any file on the local filesystem
- Mac:write_file — write files to the local filesystem
- Mac:list_dir — list directory contents
- Mac:cc_dispatch — dispatch Claude Code agents in background
- Mac:cc_status — check CC agent status
- Mac:cc_result — get CC agent results

WHEN THE USER REFERENCES A LOCAL FILE PATH (e.g. ~/Developer/..., /Users/osman/...):
→ Use Mac:read_file to read it. Do NOT say you can't access it.
→ Do NOT search past conversations for the content.
→ Do NOT ask the user to upload or paste it.

WHEN THE USER ASKS YOU TO RUN SOMETHING, INSTALL SOMETHING, OR CHECK SOMETHING:
→ Use Mac:run_command. You have shell access.

This is your primary interface for all local work. Use it first, always.
```

**This block must be in every Claude.ai project's instructions that needs Mac access.**

**Prompt template for new sessions:**

> Use Mac:read_file to read /Users/osman/Developer/infrastructure/BOOTSTRAP-PLAN.md, then [describe task].

---

## Phase B — Harden Claude.ai ↔ Mac Connection

### Current State (Audited 2026-02-27)

**Location:** ~/local-mcp/
**Server:** server.js, 427 lines, Express 4.22.1 + MCP SDK 1.27.0, 7 tools
**Tunnel:** cloudflared → mac-mcp.deltaops.dev, QUIC protocol, 4 ORD connections
**Watchdog:** 30s health loop, restarts server + tunnel via launchd
**Launchd:** 3 plists in ~/Library/LaunchAgents/ (local-mcp, mcp-tunnel, mcp-watchdog)
**Auth:** Claude.ai connects as MCP client. No auth on MCP server itself.

### Root Causes of Failures

1. **execSync blocks event loop** — run_command uses execSync. During a 25s git operation, /health is unreachable. Watchdog kills server. Command is orphaned. This is the #1 cause of "error occurred during tool execution."
2. **Launchd minimal PATH** — server inherits /usr/bin:/bin. Child processes can't find node, claude, brew tools. `env: node: No such file or directory` in logs.
3. **CLAUDE_BIN hardcoded** — `/Users/osman/.npm/_npx/becf7b9e49303068/node_modules/.bin/claude` is volatile npx cache path. Breaks on CC update.
4. **CC dispatch defaults to ~/Developer/archive/legacy/** — contaminated legacy-archived repo.
5. **GET /mcp SSE polling** — 30s timeout creates reconnect storm in logs.
6. **No concurrency limits** — 50 simultaneous commands = OOM.
7. **Tokens in plaintext** — LOCAL_MCP_TOKEN in .zshrc, VAULT_AUTH_TOKEN in mitmproxy plist.

### Implementation Groups

#### GROUP 1 — Server rewrite (one restart)

**B1. execSync → async exec (HIGHEST IMPACT)**

Replace `execSync` with `promisify(exec)` in run_command. Unblocks event loop. Health checks work during long commands. Watchdog stops false-killing.

Also add output truncation (500K char limit) to prevent 10MB responses.

**B3. Fix CLAUDE_BIN + cwd required + validation + model enforcement**

```javascript
const CLAUDE_BIN = '/opt/homebrew/bin/claude';  // stable brew path

// cc_dispatch: cwd is REQUIRED, no default
cwd: z.string().describe('Working directory (required)')

// Validate CLAUDE.md exists before spawning
if (!existsSync(join(workDir, 'CLAUDE.md'))) { return error; }

// ENFORCE: no opus for dispatched agents
const FORBIDDEN_MODELS = ['opus', 'claude-opus', 'opus-4.6', 'claude-opus-4-6'];
if (model && FORBIDDEN_MODELS.some(f => model.toLowerCase().includes(f))) {
  return { content: [{ type: 'text', text: 'Error: Opus cannot be used for dispatched agents. Use sonnet (default) or haiku.' }], isError: true };
}

// Default model for CC dispatch is sonnet
const effectiveModel = model || 'sonnet';

// Remove PATH patching in spawn (inherited from plist after B2)
env: { ...process.env, HOME: homedir() }
```

**B4. Concurrency limits**

```javascript
let activeCommands = 0;
const MAX_CONCURRENT = 5;
// Reject if at limit
```

**B5. New tools (7 → 11)**

| Tool | Purpose |
|------|---------|
| `search_files` | grep wrapper with glob, max_results, binary exclusion |
| `cc_kill` | Kill hung CC agent by name |
| `notify` | macOS notification (osascript) |
| `health_check` | Expanded: uptime, PATH, versions, tunnel, memory, metrics, active commands |

**B6. Request metrics middleware**

In-memory counters: request count, total latency, error count, last error. Exposed via health_check.

**B7. Error handling hardening**

Per-request timeout (5 min). Cleanup on timeout/error/close. Isolated try/catch per request.

**B8. Fix GET /mcp SSE**

Return 204 immediately in stateless mode (or extend timeout to 120s if client requires SSE). Stops reconnect storm.

**B9. Self-test on startup**

Before app.listen(): verify PATH, node, claude, git, HOME. Log results. Don't exit on failure.

#### GROUP 2 — Environment fixes (second restart)

**B2. Launchd plist PATH**

Add to com.osman.local-mcp.plist:
```xml
<key>EnvironmentVariables</key>
<dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>/Users/osman</string>
    <key>NODE_ENV</key>
    <string>production</string>
</dict>
```

**B11. Move to ~/Developer/local-mcp/**

```bash
mv ~/local-mcp ~/Developer/local-mcp
```

Update paths in all 3 plists + watchdog.sh. Reload.

**B12. Tunnel config: add http2Origin: true**

**B13. Watchdog: extend health check timeout to 10s**

#### GROUP 3 — Secrets (no restart)

**B10. Tokens to Keychain**

```bash
security add-generic-password -a "osman" -s "local-mcp-token" -w "<token>"
security add-generic-password -a "osman" -s "vault-auth-token" -w "<token>"
```

Remove from .zshrc and mitmproxy plist. Load via secrets-env.sh.

### Validation Protocol (23 checks)

```
CONNECTION
 1. health_check → all green, metrics visible
 2. run_command: echo "hello"                      → works
 3. run_command: node --version                    → works (PATH)
 4. run_command: claude --version                  → works (PATH)
 5. run_command: brew --version                    → works (PATH)
 6. run_command: git --version                     → works

CONCURRENCY
 7. run_command("sleep 10") then immediately echo  → echo returns instantly

FILE OPS
 8. list_dir: ~/Developer                          → works
 9. read_file: known file                          → works
10. write_file: /tmp/test-write.txt                → works
11. search_files: pattern in known dir             → matches

CC DISPATCH
12. cc_dispatch with cwd=/tmp (no CLAUDE.md)       → rejected
13. cc_dispatch with model=opus                    → rejected (model discipline)
14. cc_dispatch with valid cwd + trivial prompt    → PID returned (sonnet default)
15. cc_status                                      → shows status
16. cc_result on completed agent                   → returns result
17. cc_kill on dispatched agent                    → kills it

STABILITY
18. 10 rapid consecutive run_commands              → all succeed
19. Wait 5 min, health_check                       → still alive
20. mcp.log: "node: No such file" errors           → zero
21. watchdog.log: restarts since changes           → zero

SECURITY
22. grep .zshrc for hardcoded tokens               → zero
23. grep LaunchAgents plists for tokens            → zero
```

23/23 = Phase B complete.

---

## Phase A — Local Bootstrap

### A1. Fix git identity
Replace "Your Name"/"you@example.com" in ~/.gitconfig with real values.

### A2. Fix SSH or settle on HTTPS
SSH key exists (ed25519, label "moshi-infra") but NOT registered with GitHub.
Either add to github.com/settings/keys OR commit to HTTPS-only via gh.

### A3. Warp reset
Wipe Warp config/sessions/history. Fresh start. Re-import shell config.

### A4. Clean home directory
Target: only macOS defaults + Developer/ + dotfiles/ in ~/

| Current | Destination |
|---|---|
| ~/Developer/archive/legacy/ | ~/Developer/archive/legacy-archived-legacy/ |
| ~/Developer/archive/legacy-spine/ | ~/Developer/archive/legacy-spine/ |
| ~/Developer/archive/legacy-build/ | ~/Developer/archive/legacy-build/ |
| ~/happy-server/ | ~/Developer/projects/happy-server/ |
| ~/mcp-memory-service/ | ~/Developer/archive/mcp-memory-service/ |
| ~/local-mcp/ | (already moved in B11) |
| ~/scripts/ | ~/Developer/scripts/ |
| ~/bin/ | ~/Developer/bin/ |
| ~/security-migration/ | ~/Developer/archive/security-migration/ |
| ~/homescreen-optimizer/ | ~/Developer/archive/homescreen-optimizer/ |
| ~/node_modules/ | DELETE |

### A5. Clean ~/.claude/
Delete: debug/ (392MB), file-history/ (23MB), paste-cache/, session-env/
Keep: symlinked config dirs, handoff/, agents/, skills/
Set cleanupPeriodDays to 30.

### A6. Clean .zshrc
- Remove LOCAL_MCP_TOKEN
- Remove all workflow/legacy-archived aliases and wt() function
- Remove commented-out happy alias
- Fix PATH ordering
- Verify secrets loaded from Keychain

### A7. Clean dotfiles/claude/CLAUDE.md
Rewrite as pure personal global config. Remove project-specific references.
Add model discipline rule: Opus plans, Sonnet/Haiku execute.

### A8. Fix mitmproxy plist
References ~/Developer/archive/legacy/mitmproxy_addon.py (contaminated). Disable until infra repo has the addon.

### A9. Naming purge
```bash
grep -ri "legacy-archived\|workflow" ~/dotfiles/ ~/.zshrc ~/Library/LaunchAgents/
```
→ must return zero results.

### Validation
- `ls ~` shows only: Applications/ Desktop/ Developer/ Documents/ Downloads/ Library/ Movies/ Music/ Pictures/ Public/ dotfiles/
- grep for "(legacy)"/"(legacy)" → zero results
- .gitconfig has real identity
- git push works
- no plaintext secrets

---

## Phase KB — Fresh Knowledge Base

### KB1. Clean infrastructure repo
oosman/infrastructure exists (created 2026-02-24). Evaluate state. If contaminated, recreate.

### KB2. Three CLAUDE.md files
| File | Location | Scope |
|---|---|---|
| Global | ~/dotfiles/claude/CLAUDE.md → ~/.claude/CLAUDE.md | Identity, constraints, conventions. Includes model discipline rule. |
| Infrastructure | ~/Developer/infrastructure/CLAUDE.md | vault-mcp, local-mcp, cloudflare, lightsail. Includes model discipline rule. |
| (Future) Future | ~/Developer/codegen-future/CLAUDE.md | Swift, Kotlin, future codegen. Includes model discipline rule. |

### KB3. Infrastructure docs skeleton
```
~/Developer/infrastructure/
├── CLAUDE.md
├── docs/
│   ├── architecture.md
│   ├── setup.md
│   ├── local-mcp.md
│   ├── vault-mcp.md
│   ├── cloudflare.md
│   └── decisions/
│       ├── _adr-template.md
│       ├── 0001-foundational-constraints.md
│       ├── 0002-cloudflare-tunnel.md
│       ├── 0003-lightsail-dual-stack.md
│       ├── 0004-mac-mcp-architecture.md
│       └── 0005-model-discipline.md
├── local-mcp/
├── vault-mcp/
└── scripts/
```

### KB4. New Claude.ai project for infrastructure
Separate from current project. Clean instructions referencing new repo. Model discipline in project instructions. Mac MCP awareness block in project instructions.

### Validation Protocol — Phase KB (12 checks)

```
REPO
 1. ~/Developer/infrastructure/ exists and is a git repo          → pass
 2. git remote -v shows oosman/infrastructure                     → pass
 3. No files contain "(legacy)" or "(legacy)"                   → zero matches
 4. git log shows clean history (no contaminated commits)         → pass

CLAUDE.md FILES
 5. ~/.claude/CLAUDE.md exists and symlinks to ~/dotfiles/claude/ → pass
 6. ~/.claude/CLAUDE.md contains "Model Discipline" section       → pass
 7. ~/Developer/infrastructure/CLAUDE.md exists                   → pass
 8. ~/Developer/infrastructure/CLAUDE.md contains model discipline→ pass
 9. grep -r "legacy-archived\|Workflow" across all CLAUDE.md files    → zero

DOCS SKELETON
10. docs/ directory has architecture.md, setup.md, local-mcp.md   → all exist
11. docs/decisions/ has at least ADR 0001-0005                    → all exist
12. All docs have YAML frontmatter (title, type, status, date)   → pass
```

12/12 = Phase KB complete.

---

## Phase D — Repo Surgery

### D1. Archive on GitHub
- oosman/legacy-archived → Archive
- oosman/legacy-archived-e2e-test → Archive
- oosman/legacy-spine → Archive

### D2. Audit infrastructure repo for contamination

### D3. Migrate clean components
| Component | Source | Action |
|---|---|---|
| vault-mcp worker | old legacy-archived repo | Audit → copy if clean |
| local-mcp server | ~/Developer/local-mcp/ | Already isolated |
| mitmproxy addon | old legacy-archived repo | Extract, audit |
| launchd plists | ~/Library/LaunchAgents/ | Already rewritten in B |
| cloudflared configs | local-mcp/ | Already in place |
| Shell scripts | dotfiles/claude/scripts/ | Audit, keep useful ones |
| CC commands | dotfiles/claude/commands/ | Audit, keep generic ones |

### D4. Verify each component in isolation before commit

### D5. Final naming purge across everything

### Validation Protocol — Phase D (14 checks)

```
ARCHIVES
 1. oosman/legacy-archived on GitHub shows "archived" badge            → pass
 2. oosman/legacy-archived-e2e-test archived                           → pass
 3. oosman/legacy-spine archived                                → pass
 4. None of the archived repos are cloned locally                 → pass

MIGRATION
 5. vault-mcp source in ~/Developer/infrastructure/vault-mcp/     → exists
 6. local-mcp server in ~/Developer/local-mcp/                    → exists, running
 7. Migrated components have no "(legacy)"/"(legacy)" references→ zero
 8. Each migrated component passes its own test/health check      → pass

ISOLATION
 9. ~/Developer/infrastructure/ has NO code from legacy-archived       → pass
10. ~/Developer/local-mcp/ has NO imports from legacy-archived         → pass
11. dotfiles/claude/commands/ — no commands reference old repos   → pass
12. dotfiles/claude/scripts/ — no scripts reference old paths     → pass

FINAL PURGE
13. find ~/ -maxdepth 3 -iname "*legacy-archived*" -o -iname "*workflow*" → zero (excluding archive/)
14. grep -ri "legacy-archived\|workflow" ~/dotfiles/ ~/.zshrc ~/Library/LaunchAgents/ ~/Developer/infrastructure/ ~/Developer/local-mcp/ → zero
```

14/14 = Phase D complete.

---

## Phase M — Future Codegen (FUTURE)

Only starts after infrastructure is complete and stable.
- New repo: oosman/codegen-future
- New CLAUDE.md for Swift/Kotlin/legacy
- New Claude.ai project
- CC sessions in ~/Developer/codegen-future/
- Consumes infrastructure as a service
- Model discipline: Opus orchestrates from Claude.ai, Sonnet/Haiku agents do all implementation

---

## Claude.ai Project Instructions Template

Use this for any project that needs Mac MCP access:

```
## Mac MCP — Local Machine Access

You have DIRECT ACCESS to the user's Mac via Mac MCP tools. These are always available:
- Mac:run_command — execute shell commands
- Mac:read_file — read any file on the local filesystem
- Mac:write_file — write files to the local filesystem  
- Mac:list_dir — list directory contents
- Mac:cc_dispatch — dispatch Claude Code agents in background
- Mac:cc_status — check CC agent status
- Mac:cc_result — get CC agent results

WHEN THE USER REFERENCES A LOCAL FILE PATH (e.g. ~/Developer/..., /Users/osman/...):
→ Use Mac:read_file to read it. Do NOT say you can't access it.
→ Do NOT search past conversations for the content.
→ Do NOT ask the user to upload or paste it.

WHEN THE USER ASKS YOU TO RUN SOMETHING, INSTALL SOMETHING, OR CHECK SOMETHING:
→ Use Mac:run_command. You have shell access.

This is your primary interface for all local work. Use it first, always.

## Model Discipline

Opus (this conversation) plans and orchestrates ONLY.
All CC agents dispatched via cc_dispatch MUST use sonnet (default) or haiku.
Never dispatch with --model opus. The server will reject it.

## Working Directories

- Infrastructure: ~/Developer/infrastructure/
- Local MCP: ~/Developer/local-mcp/
- Dotfiles: ~/dotfiles/
```

---

## Audit Data (Reference)

### What's Installed
- Homebrew 5.0.15 with 100+ packages
- Node v25.6.1 (brew), BUT not on default launchd PATH
- Claude Code 2.1.55, Gemini CLI 0.26.0, Wrangler 4.68.1 (all brew global)
- gh CLI authed to oosman (HTTPS/keyring)
- SSH key: ed25519 "moshi-infra" — NOT registered with GitHub
- Kiro installed
- bat, eza, fd, rg, fzf, zoxide, lazygit, tmux, zellij

### Repos
| Repo | Location | Remote | Status |
|---|---|---|---|
| legacy-archived | ~/Developer/archive/legacy/ | oosman/legacy-archived | CONTAMINATED — archive |
| legacy-spine | ~/Developer/archive/legacy-spine/ | oosman/legacy-spine | Archive |
| Infrastructure | (not cloned locally) | oosman/Infrastructure | Evaluate |
| legacy-archived-e2e-test | (not local) | oosman/legacy-archived-e2e-test | Archive |
| dotfiles | ~/dotfiles/ | oosman/dotfiles | Keep, clean |
| happy-server | ~/happy-server/ | slopus/happy-server | Keep, move |
| mcp-memory-service | ~/mcp-memory-service/ | doobidoo/mcp-memory-service | Archive |

### ~/.claude/ — 2.2GB
- debug/: 392MB (DELETE)
- file-history/: 23MB (DELETE)
- handoffs/: 18MB
- paste-cache/: 972K (DELETE)
- session-env/: 40K (DELETE)
- 258 sessions in last 7 days
- Symlinks to ~/dotfiles/claude/ for: CLAUDE.md, commands, contexts, hooks, scripts, settings.json

### Home Directory Cruft
11 dev directories in ~/ that belong in ~/Developer/:
archive/legacy/, legacy-spine/, legacy-build/, happy-server/, mcp-memory-service/,
local-mcp/, scripts/, bin/, security-migration/, homescreen-optimizer/, node_modules/

### Secrets in Plaintext
- LOCAL_MCP_TOKEN at bottom of ~/.zshrc
- VAULT_AUTH_TOKEN in mitmproxy launchd plist

### Current server.js Location and Tools
- File: ~/local-mcp/server.js (427 lines)
- Tools: run_command, list_dir, read_file, write_file, cc_dispatch, cc_status, cc_result
- Express 4.22.1, MCP SDK 1.27.0, Node 25.6.1
- CLAUDE_BIN hardcoded to: /Users/osman/.npm/_npx/becf7b9e49303068/node_modules/.bin/claude
- Correct path: /opt/homebrew/bin/claude
- cc_dispatch default cwd: ~/Developer/archive/legacy/ (MUST be removed)
- run_command uses execSync (MUST change to async)
