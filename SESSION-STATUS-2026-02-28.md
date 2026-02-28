# Session Status — 2026-02-28

## Completed This Session

### P0: mac-mcp Auth (CLOSED)
- Secret path segment auth implemented in server.js
- Claude.ai connects via `https://mac-mcp.deltaops.dev/<secret>/mcp`
- CC/scripts connect via `Authorization: Bearer <secret>` to `/mcp`
- Bare `/mcp` returns 401 — zero-auth RCE is closed
- Commit: `41a99e2` (local-mcp repo)

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

## NOT Done — Priority Order

### 1. VM SSH / Backup Connection (NEXT — was supposed to be first)
- Phase 1.0 in plan — unblocks fallback chain + executor
- AWS CLI auth broken: `rm ~/.aws/credentials ~/.aws/config && aws configure`
- VM SSH unreachable — check Lightsail console
- Fallback chain not operational until VM verified

### 2. Remaining Phase 1
- [ ] D1 has zero tables — run migrations against vault-db
- [ ] Tunnel config: `http2Origin: true` is wrong (Phase 1.5)
- [ ] Log rotation (Phase 1.6)

### 3. Cleanup
- [ ] Delete old Mac MCP connector in Claude.ai (bare /mcp URL)
- [ ] local-mcp repo has no remote — needs `git remote add origin` + push
- [ ] minio launchd plist still loaded
- [ ] CF_ACCESS_CLIENT_ID/SECRET in Keychain are now stale (CF Access abandoned)

## Key Decisions
- Claude.ai MCP cannot send custom headers — only URL + OAuth
- Secret path segment chosen over CF Access, IP allowlist, OAuth proxy
- Keychain is canonical secrets store
- CF Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd
