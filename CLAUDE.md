# Infrastructure

Local dev infrastructure: local-mcp server, Cloudflare tunnel, launchd services, vault-mcp, dotfiles.

## Model Discipline (Non-Negotiable)

Opus plans and orchestrates ONLY (Claude.ai conversations).
All CC agents dispatched via cc_dispatch MUST use sonnet (default) or haiku.
Never dispatch with --model opus. The Mac MCP server rejects it.

## Key Paths

- Local MCP server: ~/Developer/local-mcp/server.js
- Cloudflared config: ~/Developer/local-mcp/cloudflared-config.yml
- Watchdog: ~/Developer/local-mcp/watchdog.sh
- LaunchAgents: ~/Library/LaunchAgents/com.osman.{local-mcp,mcp-tunnel,mcp-watchdog}.plist
- Dotfiles: ~/dotfiles/claude/ (symlinked from ~/.claude/)
- Bootstrap plan: ~/Developer/infrastructure/BOOTSTRAP-PLAN.md
- Secrets: macOS Keychain (account: osman), managed by ~/dotfiles/claude/scripts/secrets.py

## Verification

```bash
# Server health
curl -sf http://127.0.0.1:3001/health

# Tunnel health  
curl -sf http://127.0.0.1:20241/ready

# All three services running
launchctl list | grep com.osman

# Secrets check
python3 ~/dotfiles/claude/scripts/secrets.py
```

## Conventions

- Commits: conventional (feat:, fix:, docs:, chore:)
- Git identity: Osama Osman <oosman@deltaops.dev>
- Never create top-level ~/ directories. Use ~/Developer/.
- All .claude/ config lives in ~/dotfiles/claude/ and is symlinked.

## Architecture

```
Claude.ai (Opus, orchestrator)
  → Mac MCP (mac-mcp.deltaops.dev) → local Mac commands, CC dispatch
  → vault-mcp (vault.deltaops.dev) → pipeline state, tasks, GitHub
  → executor (executor.deltaops.dev) → Lightsail VM (future)
```

## Docs

See docs/ for architecture details, setup guide, and ADRs.
