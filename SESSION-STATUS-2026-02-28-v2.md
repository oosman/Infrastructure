# Session Status — 2026-02-28 (Session 2)

## Completed This Session

### Legacy Naming Purge
- infrastructure/ repo: 10 files cleaned (c6784cf)
- dotfiles/ repo: handoff skill cleaned (44e350a)
- VM: ~/pipeline → ~/executor, ~/Pipeline → archive
- VM: systemd unit + package.json + log lines cleaned
- SSH key: lightsail-infra.pem → lightsail-infra.pem
- Archive dir: mobile-pipeline-extract → vault-mcp-extract
- CF tunnel: pipeline-executor → executor (a118767b)
- CF DNS CNAME updated to new tunnel ID
- Cannot rename: Lightsail instance "pipeline-vm" (AWS limitation)

### Phase 1.0b: Revive Executor
- Executor running via systemd, healthy on :8080
- executor.deltaops.dev → 200 via new tunnel
- Old tunnel (98b4f6eb) deleted

### Phase 1.1: mac-mcp Auth — Already Done
- Secret path segment + Bearer token (commit 41a99e2, prior session)

### Phase 4: Executor Hardening (partial)
- Tunnel config hardened: quic protocol, retries 5, grace 30s, keepalive 90s, metrics
- Journald limits: 200M max, 14-day retention
- Logrotate: daily, 14 rotations, compressed
- Auth (x-auth-token): working
- Worktree isolation: built into executor code
- Concurrency limit: MAX_EXECUTORS=2, 180s timeout
- EXECUTOR_SECRET: stored in Mac Keychain
- Decision: stay with tunnel (no Caddy needed)

### Phase 4: Remaining
- [ ] Hardened systemd unit (dedicated executor user, MemoryMax, ProtectSystem)

## Infrastructure State
- VM: pipeline-vm (100.53.55.116), Ubuntu 24.04, Node 20.20.0
- SSH: `ssh vm` (lightsail-infra.pem)
- Tunnel: executor (a118767b-58b8-45be-bb8a-f8185d29a8de), quic, healthy
- Executor: active (systemd), port 8080
- VAULT_AUTH_TOKEN: in ~/executor/.env on VM
- D1: vault-db (5a0c53ff), 7 tables + 4 indexes

## Phase Status
| Phase | Status |
|-------|--------|
| 0 KB Bootstrap | ✅ |
| 1 Security | ✅ |
| 2 SSE/Mac Hardening | ✅ |
| 3 vault-mcp v2 | ✅ |
| 4 Executor Hardening | 🔄 90% (systemd hardening remains) |
| 5 Orchestration Wiring | Not started |
| 6 Portal Spike | Not started |
| 7 AI Gateway | Not started |
| 8 Context Continuity | Not started |

## Pending (need Osama)
- [ ] GitHub SSH key on VM (for git pull — currently using SCP)
