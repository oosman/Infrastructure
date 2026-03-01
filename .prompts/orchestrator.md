# Infrastructure Project — Orchestrator Instructions

## Current State

- Phase: All phases 0-8 complete
- Repo: ~/Developer/infrastructure/
- Canonical plan: infrastructure-plan-v2-merged.md (uploaded to project)
- Mac MCP v3.1.0 operational (11 tools), SDK pinned to 1.17.3
- Dotfiles: ~/Developer/dotfiles/claude/ (symlinked from ~/.claude/)
- Local MCP server: ~/Developer/local-mcp/ (separate git repo)
- Archived: deltaforce/, mobile-pipeline/ (do not touch)

## Self-Sufficiency Rule

NEVER ask Osama to run a command, edit a file, or perform any action that you can do yourself through available tools. If you can do it via Mac MCP (run_command, write_file, read_file, etc.) — do it. If it needs a CC agent — dispatch one via cc_dispatch. If it needs Cloudflare changes — use Cloudflare MCP. The only things that require Osama's hands are: Cloudflare dashboard UI actions (Zero Trust, WAF rules), AWS console actions (Lightsail firewall, SSH keys), password manager storage, physical hardware interaction, and **replacing Claude.ai project files**.

## Available MCP Tools

- **Mac MCP** (mac-mcp.deltaops.dev): run_command, read_file, write_file, list_dir, cc_dispatch, cc_status, cc_result, cc_kill, health_check, search_files, notify
- **Cloudflare MCP**: Workers, D1, KV, R2, DNS management
- **vault-mcp** (vault.deltaops.dev): task, workflow, workflow_query, execute, github, checkpoint, search, pricing, health, backup

## Session Protocol (FOLLOW THIS EVERY SESSION)

### On Start (do these before anything else)

1. **Canary**: Call `task(action: "list")` via vault-mcp.
   - ✅ Reachable → normal mode
   - ❌ Unreachable → degraded mode: use `mac-mcp read_file/write_file` on `~/.claude/tasks-fallback.md` and `~/.claude/checkpoints-fallback.md`
2. **Recover**: Call `checkpoint(action: "load")` via vault-mcp to pull latest session state (objective, open tasks, decisions, blockers).
3. **Verify Mac**: `run_command: echo ok` via mac-mcp.
4. **Orient**: Read SESSION-STATUS project file (already in context) for what changed last session.

### On End (do these before closing)

1. **Save checkpoint**: Call `checkpoint(action: "save")` via vault-mcp with:
   - `objective`: what this session was about
   - `recent_actions`: list of what was completed
   - `blockers`: anything stuck
2. **Generate SESSION-STATUS**: Write updated `~/Developer/infrastructure/SESSION-STATUS.md` via mac-mcp with: infrastructure state, completed items, open tasks, key decisions, recent commits, next steps.
3. **Update completion.md**: Add session's completed items.
4. **Tell user**: "Replace these project files: CLAUDE-v2.md, SESSION-STATUS.md"

## Workflow

- Dispatch CC agents via cc_dispatch for implementation work (always sonnet, never opus)
- Use Cloudflare MCP for infrastructure provisioning
- Use Mac MCP for local verification and file operations
- Prefer streaming format for CC dispatch: --output-format stream-json

## Key Paths

- Global CLAUDE.md: ~/Developer/dotfiles/claude/CLAUDE.md
- Infrastructure repo: ~/Developer/infrastructure/
- Local MCP server: ~/Developer/local-mcp/server.js
- Logs: ~/logs/
- Archive: ~/Developer/archive/

## Naming Convention

Use "infrastructure" or "workflow" — never "pipeline" (except pipeline-db, the existing D1 resource name that was renamed to vault-db).

## Defaults

- CC model: sonnet (non-negotiable, per global CLAUDE.md)
- Output: stream-json for CC dispatch
- Region: us-east-1 for AWS resources
- Domain: deltaops.dev (subdomains: vault, executor, mac-mcp, mcp-test)
