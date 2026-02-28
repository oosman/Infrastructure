# Infrastructure

Local dev infrastructure: MCP servers, Cloudflare tunnels, launchd services, vault-mcp, dotfiles.

## Model Discipline (Non-Negotiable)

Opus plans and orchestrates ONLY (Claude.ai conversations).
All CC agents dispatched via cc_dispatch MUST use sonnet (default) or haiku.
Never dispatch with --model opus. The Mac MCP server rejects it.

## Architecture (v2)

```
Claude.ai (Opus 4.6 orchestrator, 200K context)
  → vault-mcp (vault.deltaops.dev) — CF Worker, McpAgent, D1+KV, Streamable HTTP
  → mac-mcp (mac-mcp.deltaops.dev) — Node.js behind CF Tunnel, 3-layer auth
  → executor (executor.deltaops.dev) — Lightsail VM, direct HTTPS or CF Tunnel
  → AI Gateway — CF AI Gateway for classification calls (Phase 7)
```

- **Auth:** Bearer token + CF Access Service Token + Anthropic IP allowlist (all endpoints)
- **Transport:** Streamable HTTP primary, SSE deprecated but supported
- **Naming:** "workflow" not "pipeline" (except `pipeline-db` D1 resource)
- **Context budget:** 200K hard limit. ~7,500 overhead. Remainder for work.

## Tool Reference (10 consolidated, vault-mcp)

workflow(action: init|spec|write|close), workflow_query(query: summary|consensus|state|stats|chooser),
task(action: add|update|done|retro|list), execute(instruction, executor, model, repo, task_type, complexity),
github(action: read|write|pr), checkpoint(action: load|save|decide),
search(query), pricing(), health(), backup()

## Key Paths

- Local MCP server: ~/Developer/local-mcp/server.js
- Cloudflared config: ~/Developer/local-mcp/cloudflared-config.yml
- Watchdog: ~/Developer/local-mcp/watchdog.sh
- LaunchAgents: ~/Library/LaunchAgents/com.osman.{local-mcp,mcp-tunnel,mcp-watchdog}.plist
- Dotfiles: ~/Developer/dotfiles/claude/ (symlinked from ~/.claude/)
- Infrastructure plan: infrastructure-plan-v2.md (canonical)
- Secrets: macOS Keychain (account: osman)
- Archive reference: ~/Developer/archive/mobile-pipeline-extract/ (6 files, 1,617 lines)

## Verification

```bash
curl -sf http://127.0.0.1:3001/health          # Server health
curl -sf http://127.0.0.1:20241/ready           # Tunnel health
launchctl list | grep com.osman                 # All services
```

## Conventions

- Commits: conventional (feat:, fix:, docs:, chore:)
- Git identity: Osama Osman <oosman@deltaops.dev>
- Never create top-level ~/ directories. Use ~/Developer/.
- All .claude/ config lives in ~/Developer/dotfiles/claude/ and is symlinked.

## Docs

See docs/ for architecture details, setup guide, and ADRs (0001-0010).
