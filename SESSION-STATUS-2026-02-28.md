# Session Status — 2026-02-28

## What's Done
- Mac MCP v3.1.0 operational, auth fix committed (local-mcp repo, `e6ba7b3`)
- Mac MCP running with zero auth (MAC_MCP_AUTH_TOKEN removed from launchd to unblock Claude.ai)
- Claude.ai MCP connection working
- Infrastructure Plan v2 merged and reviewed
- Handoff prompt created at `/mnt/user-data/outputs/session-handoff-next.md`
- D1 database renamed: pipeline-db → vault-db (UUID: 5a0c53ff-963c-48f9-b68d-f13536104aa1)
- Plan file scrubbed: all pipeline-db → vault-db, 0002_pipeline.sql → 0001_schema.sql
- CLAUDE.md and docs/architecture.md updated in repo (commit ea371e4)

## What's In Flight (other sessions)
1. **Merge/cleanup session** — gave it a 10-point cleanup prompt for the plan. Check if it finished.
2. **Handoff execution session** — working from session-handoff-next.md. Unknown progress.

## What's NOT Done Yet
### Urgent (P0)
- [ ] mac-mcp is ZERO AUTH from public internet (full RCE). Phase 1.1 closes this.
- [ ] Phase 1.1 must implement DUAL auth: CF Access (Claude.ai) + Bearer token (CC/scripts)

### Important
- [ ] Dotfiles has uncommitted bootstrap work (commands, skills, agents, settings changes)
- [ ] AWS CLI auth broken (`rm ~/.aws/credentials ~/.aws/config && aws configure`)
- [ ] VM SSH unreachable (check Lightsail console)
- [ ] D1 has zero tables (run migrations against vault-db)
- [ ] local-mcp repo has no remote — needs `git remote add origin` + push
- [ ] wrangler.toml needs vault-db UUID update (if it exists in vault-mcp source)

### Decisions Made Today
- Claude.ai MCP cannot send Bearer tokens → dual-connection model required
- MCP SDK pinned to 1.17.3 (1.27.0 auto-upgrade broke auth)
- local-mcp belongs in dotfiles (not infrastructure repo)
- D1 renamed pipeline-db → vault-db (zero tables, clean swap)
- Naming: no more "pipeline" anywhere in active project

### Key File Locations
- Infrastructure plan: project knowledge (infrastructure-plan-merged.md)
- Handoff: `/mnt/user-data/outputs/session-handoff-next.md`
- Mac MCP server: `~/Developer/local-mcp/server.js`
- Dotfiles: `~/Developer/dotfiles/` (uncommitted changes!)
- Infrastructure repo: `~/Developer/infrastructure/`

## Next Session: Start Here
1. Commit dotfiles changes: `cd ~/Developer/dotfiles && git add -A && git commit -m "bootstrap: commands, skills, agents, settings"`
2. Check if merge/cleanup session finished the plan scrub
3. Execute Phase 1.1 (dual auth on mac-mcp) — this is the P0
