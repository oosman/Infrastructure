# HANDOFF — 2026-02-28 Session End

## Resume Point
**Phase 1.0: Restore VM SSH / Backup Connection** — this is the #1 priority.

## Context
This session closed the P0 mac-mcp zero-auth RCE using a secret URL path segment. That was important but jumped the queue — the plan says VM SSH (Phase 1.0) should come first because it unblocks the fallback chain and executor work.

## Immediate Next Steps

### Step 1: Fix AWS CLI
```bash
rm ~/.aws/credentials ~/.aws/config
aws configure
```
Credentials are in 1Password / password manager. Region: us-east-1.

### Step 2: Verify VM SSH
```bash
aws lightsail get-instance --instance-name <name>
ssh ubuntu@<ip>
```
If SSH fails, check Lightsail console for: instance state, firewall rules (port 22), SSH key.

### Step 3: Verify Fallback Chain Prerequisites
On the VM, confirm:
- [ ] `~/dotfiles/claude/` exists with symlinks to `~/.claude/`
- [ ] `~/Developer/infrastructure/` repo cloned
- [ ] `claude` CLI works (CC fallback)
- [ ] vault-mcp MCP config points to production Worker

### Step 4: Continue Phase 1
- D1 migrations: `npx wrangler d1 migrations apply vault-db --remote`
- Tunnel config fix (remove `http2Origin: true`)
- Log rotation

## What Changed Today
| Component | Change | Commit |
|-----------|--------|--------|
| local-mcp/server.js | Secret path auth + Accept header fix | `41a99e2` |
| infrastructure/CLAUDE.md | Secrets/Keychain section | `850d424` |
| dotfiles/claude/CLAUDE.md | Secrets/Keychain section | `1a328aa` |
| dotfiles/claude/scripts/secrets.py | Infra keys added | `1a328aa` |

## Keychain State
| Key | Status |
|-----|--------|
| CF_API_TOKEN | ✅ Valid, verified |
| MAC_MCP_AUTH_TOKEN | ✅ Valid, in use |
| CF_ACCESS_CLIENT_ID | ⚠️ Stale (CF Access abandoned) |
| CF_ACCESS_CLIENT_SECRET | ⚠️ Stale (CF Access abandoned) |
| EXECUTOR_SECRET | ❌ Not yet stored |

## Claude.ai MCP State
- Mac (secret path): Connected ✅
- Mac (old bare /mcp): Still exists — DELETE IT
- Cloudflare Developer Platform: Configured
- GitHub: Connected

## Key Lesson
Claude.ai MCP connectors support only URL + OAuth. No custom headers. Secret path segment is the canonical auth pattern for self-hosted MCP servers behind CF Tunnel.
