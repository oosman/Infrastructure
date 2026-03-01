# Infrastructure

Local dev infrastructure: MCP servers, Cloudflare tunnels, launchd services, vault-mcp, dotfiles.

## Model Discipline (Non-Negotiable)

Opus plans and orchestrates ONLY (Claude.ai conversations).
All CC agents dispatched via cc_dispatch MUST use sonnet (default) or haiku.
Never dispatch with --model opus. The Mac MCP server rejects it.

## Architecture (v2)

```
Claude.ai (Opus 4.6 orchestrator, 200K context)
  → vault-mcp (vault.deltaops.dev) — CF Worker, Streamable HTTP, D1+KV
  → mac-mcp (mac-mcp.deltaops.dev) — Node.js behind CF Tunnel, 11 tools
  → executor (executor.deltaops.dev) — Lightsail VM, CF Tunnel (QUIC)
  → AI Gateway — CF Workers AI for post-execution classification
  → MCP Portal — mcp-test.deltaops.dev (CF Access OAuth, 24 tools)
```

- **Auth:** Secret path (Claude.ai → mac-mcp), Bearer token (CC/scripts), WAF planned
- **Transport:** Streamable HTTP (SSE removed, returns 410)
- **Naming:** "workflow" not "pipeline". vault-db is the D1 database.

## Continuity Protocol

### /start (type this at beginning of every new session)
1. **Canary**: Call `task(action: "list")` via vault-mcp.
   - ✅ Reachable → normal mode.
   - ❌ Unreachable → degraded mode: use mac-mcp `read_file`/`write_file` on `~/.claude/tasks-fallback.md` and `~/.claude/checkpoints-fallback.md` instead.
2. **Recover**: Call `checkpoint(action: "load")` via vault-mcp. Display the recovery document (objective, open tasks, recent decisions, blockers).
3. **Verify Mac**: Call mac-mcp `run_command: echo ok`.
4. **Orient**: Summarize current state from checkpoint + SESSION-STATUS project file. Ask user what to work on.

### /done (type this before ending a session)
1. **Save checkpoint**: Call `checkpoint(action: "save")` via vault-mcp with:
   - `objective`: what this session was about (infer from conversation)
   - `recent_actions`: list of what was completed this session
   - `blockers`: anything currently stuck
2. **Update completion.md**: Call mac-mcp `read_file` then `write_file` to append this session's completed items to `~/Developer/infrastructure/docs/completion.md`.
3. **Generate SESSION-STATUS**: Call mac-mcp `write_file` to write `~/Developer/infrastructure/SESSION-STATUS.md` with: infrastructure state, completed items, open tasks, key decisions, recent git log, next steps.
4. **Tell user**: "Checkpoint saved. SESSION-STATUS.md written — replace the project file for next session."

### After architectural decisions
Call `checkpoint(action: "decide")` with the decision and rationale.

### After PR creation
Call `checkpoint(action: "save")` to capture state.

### When asked about past discussions
Call `search(query: "...")` via vault-mcp before saying you don't know.

### Degraded Mode (vault-mcp unreachable)
- Tasks: mac-mcp `write_file` to `~/.claude/tasks-fallback.md`
- Checkpoints: mac-mcp `write_file` to `~/.claude/checkpoints-fallback.md`
- Everything else (mac-mcp, CC agents, git) works normally
- On session end: include "DEGRADED: replay pending" in handoff

## Self-Sufficiency Rule

NEVER ask Osama to run a command, edit a file, or perform any action that you can do yourself. If you can do it via Mac MCP — do it. If it needs a CC agent — dispatch via cc_dispatch. If it needs Cloudflare — use Cloudflare MCP. The only things requiring Osama's hands: Cloudflare dashboard UI, AWS console, password manager storage, physical hardware, replacing Claude.ai project files.

## Secrets — macOS Keychain

All secrets under account "osman". Read: `security find-generic-password -a "osman" -s "NAME" -w`

| Key | Purpose |
|-----|---------|
| CF_API_TOKEN | Cloudflare API (Workers/D1/KV) |
| CF_GLOBAL_API_KEY | Zero Trust / AI Controls |
| CF_EMAIL | Paired with Global Key |
| MAC_MCP_AUTH_TOKEN | mac-mcp secret path + Bearer |
| VAULT_AUTH_TOKEN | vault-mcp Bearer |
| EXECUTOR_SECRET | executor.deltaops.dev auth |

NEVER hardcode. NEVER ask user to paste. If missing, give exact `security add-generic-password` command.
Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd

## Tool Reference (10 consolidated, vault-mcp)

workflow, workflow_query, task, execute, github, checkpoint, search, pricing, health, backup

## Key Paths

- Infrastructure repo: ~/Developer/infrastructure/
- Local MCP server: ~/Developer/local-mcp/server.js
- Dotfiles: ~/Developer/dotfiles/claude/ (symlinked from ~/.claude/)
- LaunchAgents: ~/Library/LaunchAgents/com.osman.{local-mcp,mcp-tunnel,mcp-watchdog}.plist
- Archive: ~/Developer/archive/ (read-only)

## Data Format Convention
- If Claude reads it → Markdown tables or YAML. Never JSON.
- If code reads it → JSON is fine.

## Conventions

- Commits: conventional (feat:, fix:, docs:, chore:)
- Git identity: Osama Osman <oosman@deltaops.dev>
- Never create top-level ~/ directories. Use ~/Developer/.
- Full passwordless sudo for user osman.
- Docs: see docs/ for architecture, setup, ADRs 0001-0031.

## CC Dispatch

- Model: sonnet only (non-negotiable)
- Output: --output-format stream-json
- Region: us-east-1 for AWS
- Domain: deltaops.dev (vault, executor, mac-mcp, mcp-test)
