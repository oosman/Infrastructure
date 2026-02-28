# Session Status — 2026-02-28 (v3)

## Completed Today

### Phase 1 — Emergency Security ✅
- **P0 mac-mcp auth** — secret path segment + Bearer token (commit `41a99e2`)
- **Backup SSH path** — VM → `ssh mac` via CF Tunnel (`ssh-mac.deltaops.dev`) (commit `df7b068`)
- **Tunnel config** — `http2Origin: false`, `protocol: http2`, `retries: 10` (commit `cb04c0b`)
- **Secrets infrastructure** — Keychain canonical store, documented in CLAUDE.md (commits `850d424`, `1a328aa`)
- **D1 tables** — confirmed 8 tables already exist (stale info corrected)
- **Cleanup** — minio unloaded+removed, stale CF Access keychain entries deleted

### Phase 2 — SSE Reliability & Mac Hardening ✅
- **SSE keepalive** — 30s heartbeat on streaming responses (CC agent)
- **Mac sleep prevention** — `pmset -c sleep 0, disablesleep 1, womp 1`
- **Log rotation** — script + cron every 6 hours (commit `013b4cf`)
- **WiFi change detection** — watchdog auto-restarts tunnel on SSID change (commit `9996f72`)
- **Tunnel health alerts** — CF dashboard notifications configured
- **Sudo access** — full passwordless sudo via `/etc/sudoers.d/claude-full`

### Infrastructure
- VM SSH working (`ssh -i ~/.ssh/lightsail-pipeline.pem ubuntu@100.53.55.116`)
- VM fallback chain verified: dotfiles, infrastructure repo, claude CLI, vault-mcp connectivity
- AWS CLI working (arn:aws:iam::454518197708:user/oosman-cli)
- CF API token valid in Keychain

## In Progress
- **Phase 3 (vault-mcp v2)** — running in parallel Claude.ai session

## Remaining
- [ ] Phase 4: Executor hardening
- [ ] Phase 5: Orchestration wiring
- [ ] Phase 6: Portal spike
- [ ] Phase 7: AI Gateway
- [ ] Phase 8: Context continuity & dashboard
- [ ] local-mcp repo has no git remote — needs push
- [ ] Delete old Mac MCP connector in Claude.ai (bare /mcp URL)

## Key Decisions
- Claude.ai MCP: no custom headers, only URL + OAuth → secret path segment
- CF Access abandoned (OAuth incompatible with Claude.ai MCP)
- Keychain is canonical secrets store
- Full sudo for all sessions via sudoers.d
- CF Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd
