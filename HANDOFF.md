# HANDOFF — 2026-02-28 Session End

## Resume Point
**Phase 1 Remaining:** D1 migrations, tunnel config fix, log rotation, executor verification.

## Context
This session closed two critical items:
1. **P0 mac-mcp zero-auth RCE** — secret path segment auth, commit `41a99e2`
2. **Backup connection** — VM can SSH to Mac via CF Tunnel (`ssh mac`), restart mac-mcp if needed

The primary and backup paths are now both operational:
| Path | Route | Purpose |
|------|-------|---------|
| Primary | Claude.ai → CF Tunnel → mac-mcp (secret path) | Normal operation |
| Backup | Claude.ai → CC on VM → `ssh mac` → Mac | mac-mcp recovery |

## Immediate Next Steps

### Step 1: Fix AWS CLI ✅ DONE
```bash
```
```bash
```
Region: us-east-1.

### Step 2: Run D1 Migrations
```bash
npx wrangler d1 migrations apply vault-db --remote
```

### Step 3: Fix Tunnel Config
Remove `http2Origin: true` from Mac tunnel config (origin is plain HTTP).

### Step 4: Verify Executor on VM
```bash
ssh mac  # from VM, or direct SSH
# then on VM:
systemctl status executor
curl http://localhost:8080/health
curl https://executor.deltaops.dev/health
```

### Step 5: Log Rotation
Set up newsyslog on Mac + logrotate on VM.

## What Changed Today
| Component | Change | Commit |
|-----------|--------|--------|
| local-mcp/server.js | Secret path auth + Accept header fix | `41a99e2` |
| local-mcp/cloudflared-config.yml | Added ssh-mac.deltaops.dev ingress | (other session) |
| infrastructure/CLAUDE.md | Secrets/Keychain section, vault-db | `850d424`, `ea371e4` |
| infrastructure/docs/architecture.md | vault-db references | `ea371e4` |
| dotfiles/claude/CLAUDE.md | Secrets/Keychain section | `1a328aa` |
| dotfiles/claude/scripts/secrets.py | Infra keys added | `1a328aa` |
| D1 database | Renamed pipeline-db → vault-db | UUID: 5a0c53ff-963c-48f9-b68d-f13536104aa1 |
| VM SSH config | `Host mac` via cloudflared proxy | (other session) |

## Keychain State
| Key | Status |
|-----|--------|
| CF_API_TOKEN | ✅ Valid, verified |
| MAC_MCP_AUTH_TOKEN | ✅ Valid, in use |
| CF_ACCESS_CLIENT_ID | ⚠️ Stale — remove |
| CF_ACCESS_CLIENT_SECRET | ⚠️ Stale — remove |
| EXECUTOR_SECRET | ❌ Not yet stored |

## Claude.ai MCP State
- Mac (secret path): Connected ✅
- Mac (old bare /mcp): Still exists — DELETE IT
- Cloudflare Developer Platform: Configured
- GitHub: Connected

## Key Lessons
- Claude.ai MCP connectors support only URL + OAuth. No custom headers.
- Secret path segment is the canonical auth pattern for self-hosted MCP behind CF Tunnel.
- VM → SSH → Mac via CF Tunnel provides Claude.ai-accessible backup (through CC dispatch on VM).
