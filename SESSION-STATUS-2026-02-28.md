# Session Status — 2026-02-28 (v4)

## Phases 1-2: COMPLETE ✅

### Phase 1 — Emergency Security Hardening ✅
- P0 mac-mcp auth — secret path segment + Bearer token (`41a99e2`)
- Backup SSH path — VM → ssh mac via CF Tunnel (`df7b068`)
- Tunnel config — http2Origin false, protocol http2, retries 10 (`cb04c0b`)
- VM tunnel config — quic → http2, matching originRequest settings
- Secrets infrastructure — Keychain canonical store, documented in CLAUDE.md
- D1 tables — 8 tables confirmed present
- Executor alive — /health → 200, auth enforced (x-auth-token)
- Cleanup — minio removed, stale CF Access keychain entries deleted
- Browser Integrity Check — OFF (dashboard)
- Bot Fight Mode — OFF (dashboard)
- Credential perms — 600 on cloudflared JSON files

### Phase 2 — SSE Reliability & Mac Hardening ✅
- SSE keepalive — 30s heartbeat on mac-mcp streaming responses (`013b4cf`)
- Mac sleep prevention — pmset: sleep 0, disablesleep 1, womp 1
- Log rotation — script + cron every 6 hours
- WiFi change detection — watchdog auto-restarts tunnel on SSID change (`9996f72`)
- Tunnel health alerts — CF dashboard notifications configured
- Full sudo — /etc/sudoers.d/claude-full (passwordless, all commands)

### Notes
- Executor is pure JSON (no SSE) — keepalive N/A
- WAF IP allowlist superseded by secret path auth
- SSH key is `lightsail-infra.pem` (not lightsail-pipeline)

## In Progress
- **Phase 3 (vault-mcp v2)** — parallel Claude.ai session

## Remaining
- [ ] Phase 4: Executor hardening
- [ ] Phase 5: Orchestration wiring
- [ ] Phase 6: Portal spike
- [ ] Phase 7: AI Gateway
- [ ] Phase 8: Context continuity & dashboard
- [ ] local-mcp repo has no git remote — needs push

## Keychain State
| Key | Status |
|-----|--------|
| CF_API_TOKEN | ✅ Valid |
| MAC_MCP_AUTH_TOKEN | ✅ In use |
| EXECUTOR_SECRET | ✅ Stored |

## Validation — Phases 1-2
Run: 2026-02-28 ~11:15 AM CT
Result: **21/21 PASS**, 1 N/A (executor SSE — pure JSON), 1 womp (hardware limitation, moot — sleep disabled)

Tested: VM SSH, executor health+auth, mac-mcp auth (bare/bearer/secret-path), tunnel configs (both), credential perms, cron, minio, SSE keepalive, sleep prevention, WiFi watchdog, backup SSH path, keychain secrets, sudo access, dashboard settings (screenshots)
