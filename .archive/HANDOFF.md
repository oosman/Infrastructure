# HANDOFF — 2026-02-28 (v3)

## Resume Point
Phases 1-2 complete. Phase 3 in progress (parallel session). Next: Phase 4 (Executor Hardening).

## What's Done
- **Phase 1** — Auth (secret path), backup SSH, tunnel configs (both Mac + VM), executor alive, secrets in Keychain, Bot Fight + Browser Integrity off, credential perms, cleanup
- **Phase 2** — SSE keepalive, sleep prevention, log rotation, WiFi watchdog, tunnel alerts, full sudo

## Key Info
- SSH key: `~/.ssh/lightsail-infra.pem` (not lightsail-pipeline)
- VM: `ssh -i ~/.ssh/lightsail-infra.pem ubuntu@100.53.55.116`
- VM → Mac: `ssh mac` (via ssh-mac.deltaops.dev tunnel)
- Restart mac-mcp: `ssh mac "launchctl kickstart -k gui/501/com.osman.local-mcp"`
- Full sudo: `/etc/sudoers.d/claude-full`
- CF Account: `3d18a8bf1d47b952ec66dc00b76f38cd`

## Keychain
| Key | Status |
|-----|--------|
| CF_API_TOKEN | ✅ |
| MAC_MCP_AUTH_TOKEN | ✅ |
| EXECUTOR_SECRET | ✅ |

## Still TODO
- [ ] local-mcp repo needs git remote + push
- [ ] Phase 3: vault-mcp v2 (in progress, other session)
- [ ] Phases 4-8
