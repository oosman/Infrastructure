# Session Status — 2026-02-28 (Session 2)

## Completed This Session

### Phase 1.0: VM SSH + Fallback Chain
| Item | Status | Notes |
|------|--------|-------|
| AWS CLI | ✅ | Already working (oosman-cli IAM user) |
| VM SSH | ✅ | `ssh vm` works (lightsail-infra.pem) |
| VM: dotfiles symlink | ✅ | ~/.claude → ~/dotfiles/claude |
| VM: infrastructure repo | ✅ | SCP'd to ~/Developer/infrastructure/ |
| VM: Claude CLI | ✅ | v2.1.63 installed via npm |
| D1 schema migration | ✅ | 7 tables + 4 indexes created via API |
| Tunnel config | ✅ | Already clean |

### Phase 1.0b: Revive Executor
| Item | Status | Notes |
|------|--------|-------|
| Executor process | ✅ | Running via systemd, healthy on :8080 |
| Tunnel endpoint | ✅ | executor.deltaops.dev → 200 |
| Tunnel renamed | ✅ | pipeline-executor → executor (new ID: a118767b) |
| Old tunnel deleted | ✅ | 98b4f6eb confirmed deleted |
| VM paths renamed | ✅ | ~/pipeline → ~/executor, ~/Pipeline → archive |
| Systemd unit cleaned | ✅ | Description and paths updated |

### Legacy Naming Purge
| Scope | Status | Notes |
|-------|--------|-------|
| infrastructure/ repo | ✅ | 10 files cleaned, committed c6784cf |
| dotfiles/ repo | ✅ | handoff skill cleaned, committed 44e350a |
| local-mcp/ repo | ✅ | Already clean |
| VM executor code | ✅ | package.json + entrypoint.js log lines |
| VM systemd units | ✅ | executor.service cleaned |
| VM directories | ✅ | ~/pipeline → ~/executor |
| SSH key | ✅ | lightsail-pipeline.pem → lightsail-infra.pem |
| Archive dir | ✅ | mobile-pipeline-extract → vault-mcp-extract |
| CF tunnel | ✅ | pipeline-executor → executor |
| CF DNS CNAME | ✅ | Updated to new tunnel ID |

### Cannot Rename (external)
- Lightsail instance: `pipeline-vm` (AWS doesn't support renaming)
- vault-mcp Worker route `/pipeline/...` (deployed code, fix in next Worker deploy)

## VM Details
- Instance: pipeline-vm (Lightsail Small, us-east-1a) — AWS name, cannot rename
- IP: 100.53.55.116
- OS: Ubuntu 24.04, Node 20.20.0
- SSH: `ssh vm` (lightsail-infra.pem)
- Tunnel: executor (a118767b-58b8-45be-bb8a-f8185d29a8de)
- VAULT_AUTH_TOKEN: available in ~/executor/.env on VM

## Next: Phase 1.1 — Auth on mac-mcp (P0)
mac-mcp is currently ZERO AUTH. Dual-connection model required:
- Claude.ai → CF Access (CF-Access-Jwt-Assertion header)
- CC/scripts → Bearer token (Authorization header)

### Remaining Phase 1.0 items (need Osama input)
1. GitHub SSH key on VM (for git pull)
