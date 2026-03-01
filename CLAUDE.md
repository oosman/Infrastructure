# Infrastructure

MCP servers, Cloudflare tunnels, launchd services, vault-mcp, dotfiles.

## Model Discipline (Non-Negotiable)

Opus orchestrates ONLY (Claude.ai). CC agents use sonnet (default) or haiku.
Never dispatch with --model opus. Mac MCP server rejects it.

## Architecture (v2)

```
Claude.ai (Opus orchestrator, 200K context)
  → vault-mcp (vault.deltaops.dev) — CF Worker, Streamable HTTP, D1+KV
  → mac-mcp (mac-mcp.deltaops.dev) — Node.js behind CF Tunnel
  → executor (executor.deltaops.dev) — Lightsail VM, CF Tunnel, systemd
```

Auth: secret path (Claude.ai) + Bearer token (CC/scripts) + WAF IP allowlist.
Transport: Streamable HTTP. Naming: "workflow" not "pipeline". DB: vault-db.

## Secrets — macOS Keychain

Account "osman". Read: `security find-generic-password -a "osman" -s "NAME" -w`

| Key | Purpose |
|-----|---------|
| CF_API_TOKEN | Cloudflare API |
| MAC_MCP_AUTH_TOKEN | mac-mcp Bearer auth |
| EXECUTOR_SECRET | executor.deltaops.dev auth |
| VAULT_AUTH_TOKEN | vault-mcp Bearer auth |

NEVER hardcode, never ask user to paste. If missing, give exact `security add-generic-password` command.
CF Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd

## Tools (10 consolidated, vault-mcp)

workflow, workflow_query, task, execute, github, checkpoint, search, pricing, health, backup

## Key Paths

- MCP server: ~/Developer/local-mcp/server.js
- Tunnel config: ~/Developer/local-mcp/cloudflared-config.yml
- Dotfiles: ~/Developer/dotfiles/claude/ (symlinked from ~/.claude/)
- LaunchAgents: ~/Library/LaunchAgents/com.osman.{local-mcp,mcp-tunnel,mcp-watchdog}.plist
- Archive: ~/Developer/archive/ (read-only reference)

## Verification

```bash
curl -sf http://127.0.0.1:3001/health       # mac-mcp
curl -sf http://127.0.0.1:20241/ready        # tunnel
launchctl list | grep com.osman              # services
```

## Conventions

- Commits: conventional (feat:, fix:, docs:, chore:)
- Git identity: Osama Osman <oosman@deltaops.dev>
- Never create top-level ~/ directories. Use ~/Developer/.
- All .claude/ config in ~/Developer/dotfiles/claude/, symlinked.
- Full passwordless sudo for user osman via /etc/sudoers.d/claude-full.
- Docs: see docs/ for architecture, setup, ADRs 0001-0031.

## Session Protocol

1. **Step 0 — Canary**: Call `task(action: "list")` via vault-mcp as health check.
   - If reachable: proceed normally.
   - If unreachable: enter **degraded mode** — log warning, use local fallback files:
     - Tasks: `~/.claude/tasks-fallback.md`
     - Checkpoints: `~/.claude/checkpoints-fallback.md`
   - On recovery: reconcile local fallback with D1 via `/reconcile` or manual review.
2. On start: read COMPLETION.md (canonical record of what's done)
3. On finish: update COMPLETION.md with what you completed (commit, item, date)
4. If it's not in COMPLETION.md, assume it's not done
