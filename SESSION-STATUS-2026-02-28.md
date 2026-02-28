# Session Status — 2026-02-28

## Completed This Session

### P0: mac-mcp Auth (CLOSED)
- Secret path segment auth implemented in server.js
- Claude.ai connects via `https://mac-mcp.deltaops.dev/<secret>/mcp`
- CC/scripts connect via `Authorization: Bearer <secret>` to `/mcp`
- Bare `/mcp` returns 401 — zero-auth RCE is closed
- Commit: `41a99e2` (local-mcp repo)

### Backup Connection: VM → Mac SSH (OPERATIONAL)
- SSH enabled on Mac (Remote Login)
- VM SSH key generated and authorized on Mac (`~/.ssh/authorized_keys`)
- SSH ingress added to Mac CF tunnel: `ssh-mac.deltaops.dev`
- DNS record created for `ssh-mac.deltaops.dev`
- cloudflared installed on VM with SSH ProxyCommand
- VM SSH config: `Host mac` proxies through CF tunnel
- Tested: VM can SSH to Mac, check mac-mcp health, restart via launchctl
- Backup path: Claude.ai → CC on VM → `ssh mac` → full Mac access

### Secrets Infrastructure
- macOS Keychain established as canonical secrets store
- Pattern: `security find-generic-password -a "osman" -s "KEY" -w`
- Keys stored: CF_API_TOKEN, MAC_MCP_AUTH_TOKEN, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET
- Documented in CLAUDE.md (global + infrastructure)
- secrets.py updated with infra keys
- Commits: `850d424` (infrastructure), `1a328aa` (dotfiles)

### CF Access — Attempted and Abandoned
- Enabled CF Access on account, created service token + app
- Discovered Claude.ai MCP only supports OAuth — no custom headers
- CF Access incompatible with Claude.ai MCP connector model
- Deleted service token + app, pivoted to secret path segment
- Decision: CF Access is wrong tool for Claude.ai MCP auth

### Plan Validation Prompt (v1.1)
- Created reusable plan-validation-prompt.md for project files
- 14-point validation + prework checklists + change governance
- Addresses recurring failure modes: tool audit, credential seeding, parallel coordination

### D1 Rename
- D1 database is now vault-db (UUID: 5a0c53ff-963c-48f9-b68d-f13536104aa1)
- All references updated in plan, CLAUDE.md, docs/architecture.md

## NOT Done — Priority Order

### 1. Remaining Phase 1
- [ ] D1 has zero tables — run migrations against vault-db
- [ ] Tunnel config: `http2Origin: true` is wrong (Phase 1.5)
- [ ] Log rotation (Phase 1.6)
- [ ] Executor status unknown — verify on VM

### 2. Cleanup
- [ ] Delete old Mac MCP connector in Claude.ai (bare /mcp URL)
- [ ] local-mcp repo has no remote — needs `git remote add origin` + push
- [ ] minio launchd plist still loaded
- [ ] CF_ACCESS_CLIENT_ID/SECRET in Keychain are now stale — remove
- [ ] Dotfiles has uncommitted bootstrap work
- [x] AWS CLI auth fixed (oosman-cli, account 454518197708)

## Connection Map
| Path | Route | Purpose |
|------|-------|---------|
| Primary | Claude.ai → CF Tunnel → mac-mcp (secret path) | Normal operation |
| Backup | Claude.ai → CC on VM → `ssh mac` → Mac | mac-mcp recovery |
| Direct | CC on Mac → localhost:3001 | Local CC agents |

## Key Decisions
- Claude.ai MCP cannot send custom headers — only URL + OAuth
- Secret path segment chosen over CF Access, IP allowlist, OAuth proxy
- Keychain is canonical secrets store
- VM SSH to Mac via CF Tunnel is the backup path for Claude.ai
- CF Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd
