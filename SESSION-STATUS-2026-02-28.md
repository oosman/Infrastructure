# Session Status — 2026-02-28 (v3)

## Completed Today

### Phase 1 — Emergency Security ✅
- P0 mac-mcp auth — secret path segment + Bearer token (commit `41a99e2`)
- Backup SSH path — VM → `ssh mac` via CF Tunnel `ssh-mac.deltaops.dev` (commit `df7b068`)
- Tunnel config — `http2Origin: false`, `protocol: http2`, `retries: 10` (commit `cb04c0b`)
- Secrets infrastructure — Keychain canonical store, documented in CLAUDE.md
- D1 tables — confirmed 8 tables exist
- Cleanup — minio removed, stale keychain entries deleted

### Phase 2 — SSE Reliability & Mac Hardening ✅
- SSE keepalive — 30s heartbeat on streaming responses
- Mac sleep prevention — `pmset -c sleep 0, disablesleep 1, womp 1`
- Log rotation — script + cron every 6 hours
- WiFi change detection — watchdog auto-restarts tunnel on SSID change
- Tunnel health alerts — CF dashboard notifications configured
- Sudo access — full passwordless via `/etc/sudoers.d/claude-full`

### Phase 4 — Executor Audit (partial)
- Executor healthy: running on VM port 8080, systemd enabled, auth working
- EXECUTOR_SECRET stored in Keychain
- local-mcp repo pushed to GitHub (oosman/local-mcp, private)
- VM SSH key renamed: `~/.ssh/lightsail-infra.pem`

## In Progress
- Phase 3 (vault-mcp v2) — parallel Claude.ai session

## Remaining
- [ ] Phase 4: Executor tunnel hardening (bare config)
- [ ] Phase 5-8
- [ ] Delete old Mac MCP connector in Claude.ai (bare /mcp URL)

## Key Info
- VM: `ssh -i ~/.ssh/lightsail-infra.pem ubuntu@100.53.55.116`
- VM → Mac: `ssh mac`
- CF Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd
- Executor: x-auth-token auth, port 8080, max 2 concurrent, 180s timeout
