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
- **Context budget:** 200K hard limit. ~7,500 overhead. Remainder for work.

## Session Protocol (Claude.ai)

### On Start
1. **Canary**: Call `task(action: "list")` via vault-mcp. If unreachable, note degraded mode — use mac-mcp to read/write `~/.claude/tasks-fallback.md` and `~/.claude/checkpoints-fallback.md` instead.
2. **Recover**: Call `checkpoint(action: "load")` via vault-mcp to pull latest session state (objective, open tasks, recent decisions, blockers).
3. **Orient**: Read the SESSION-STATUS project file for what changed last session.

### On End
1. **Save**: Call `checkpoint(action: "save")` via vault-mcp with objective, recent_actions, blockers.
2. **Generate SESSION-STATUS**: Write updated `~/Developer/infrastructure/SESSION-STATUS.md` via mac-mcp with: completed items, open tasks, key decisions, next steps, git log.
3. **Tell user**: "SESSION-STATUS written to ~/Developer/infrastructure/SESSION-STATUS.md — replace the project file."

### Degraded Mode (vault-mcp unreachable)
- Tasks: `mac-mcp read_file/write_file` to `~/.claude/tasks-fallback.md`
- Checkpoints: `mac-mcp read_file/write_file` to `~/.claude/checkpoints-fallback.md`
- Everything else (mac-mcp, CC agents, git) works normally

## Secrets — macOS Keychain (NEVER ask the user to provide secrets)

All secrets are in macOS Keychain under account "osman". Read programmatically:

```bash
security find-generic-password -a "osman" -s "SECRET_NAME" -w
```

| Key | Purpose |
|-----|---------|
| CF_API_TOKEN | Cloudflare API (Workers/D1/KV) |
| CF_GLOBAL_API_KEY | Zero Trust / AI Controls API |
| CF_EMAIL | Paired with Global Key |
| MAC_MCP_AUTH_TOKEN | mac-mcp secret path + Bearer |
| VAULT_AUTH_TOKEN | vault-mcp Bearer |
| EXECUTOR_SECRET | executor.deltaops.dev auth |

Rules: NEVER hardcode. NEVER ask user to paste. If missing, give exact `security add-generic-password` command.
Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd

## Tool Reference (10 consolidated, vault-mcp)

workflow(action: init|spec|write|close), workflow_query(query: summary|consensus|state|stats|chooser),
task(action: add|update|done|retro|list), execute(instruction, executor, model, repo, task_type, complexity),
github(action: read|write|pr), checkpoint(action: load|save|decide),
search(query), pricing(), health(), backup()

## Key Paths

- Infrastructure repo: ~/Developer/infrastructure/
- Local MCP server: ~/Developer/local-mcp/server.js
- Dotfiles: ~/Developer/dotfiles/claude/ (symlinked from ~/.claude/)
- LaunchAgents: ~/Library/LaunchAgents/com.osman.{local-mcp,mcp-tunnel,mcp-watchdog}.plist
- Archive: ~/Developer/archive/ (read-only reference)
- Logs: ~/logs/

## Conventions

- Commits: conventional (feat:, fix:, docs:, chore:)
- Git identity: Osama Osman <oosman@deltaops.dev>
- Never create top-level ~/ directories. Use ~/Developer/.
- All .claude/ config in ~/Developer/dotfiles/claude/, symlinked from ~/.claude/.
- Full passwordless sudo for user osman via /etc/sudoers.d/claude-full.
- Docs: see docs/ for architecture, setup, ADRs 0001-0031.
