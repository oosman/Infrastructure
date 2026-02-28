> **Read docs/completion.md first** — it is the canonical record of what's done.

# Phase 6 — MCP Server Portal Spike (30 min)

## Context
Phases 0-4 complete. Phase 5 running in parallel. Test Cloudflare's MCP Server Portal for consolidating MCP endpoints into one URL.

Research confirmed: Portal uses OAuth (Claude.ai supports it), server URLs stored server-side (secret paths work), Portal calls tools/list to sync capabilities.

## KNOWN BLOCKERS — Read Before Starting

### Blocker 1: Zero Trust API requires Global API Key
The `/access/ai_controls/mcp/servers` endpoint **categorically blocks API tokens** regardless of permissions. This is a Cloudflare platform limitation. You need either:

**Option A — Dashboard (fastest):** Osama creates servers + portal manually in CF One dashboard. You handle vault-mcp auth fix, testing, ADR.

**Option B — Global API Key (programmatic):** Check Keychain first:
```bash
CF_EMAIL=$(security find-generic-password -a "osman" -s "CF_EMAIL" -w 2>/dev/null)
CF_GLOBAL_KEY=$(security find-generic-password -a "osman" -s "CF_GLOBAL_API_KEY" -w 2>/dev/null)
```
If missing, Osama must store them:
```bash
# CF dashboard → My Profile → API Tokens → Global API Key → View
security add-generic-password -a osman -s CF_GLOBAL_API_KEY -w "<key>" -U
security add-generic-password -a osman -s CF_EMAIL -w "<email>" -U
```
Then use `X-Auth-Email` + `X-Auth-Key` headers instead of Bearer:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai_controls/mcp/servers" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_GLOBAL_KEY" \
  -H "Content-Type: application/json" \
  -d '...'
```

**If neither option is ready, ask Osama which he prefers and wait. Do not attempt API calls with CF_API_TOKEN — they will fail.**

### Blocker 2: vault-mcp /mcp requires Bearer auth
vault-mcp returns 401 on `/mcp` without Authorization header. When Portal syncs tools (calls `tools/list`), it can't authenticate.

**Tested:**
```
No auth:   POST https://vault.deltaops.dev/mcp → 401
With auth: POST https://vault.deltaops.dev/mcp + Bearer → 200
```

**Fixes (pick one):**
- Option A (quick): Allow `initialize` and `tools/list` methods through without auth in vault-mcp index.ts. Keep `tools/call` authed. Deploy: `cd ~/Developer/infrastructure/vault-mcp && npx wrangler deploy`.
- Option B (better): Add secret path to vault-mcp (like mac-mcp). Register in Portal with `https://vault.deltaops.dev/{VAULT_AUTH_TOKEN}/mcp`.

## Infrastructure Details

### Secrets (macOS Keychain, account "osman")
```bash
security find-generic-password -a "osman" -s "SECRET_NAME" -w
```
| Key | Purpose |
|-----|---------|
| CF_API_TOKEN | Cloudflare Workers/D1/KV (**NOT Zero Trust**) |
| CF_GLOBAL_API_KEY | Global API key (**may not exist yet**) |
| CF_EMAIL | CF account email (**may not exist yet**) |
| VAULT_AUTH_TOKEN | Bearer for vault-mcp (64 chars) |
| MAC_MCP_AUTH_TOKEN | Secret path segment for mac-mcp (64 chars) |
| EXECUTOR_SECRET | x-auth-token for executor (not needed here) |

### Endpoints
| Server | URL | Auth |
|--------|-----|------|
| vault-mcp | `https://vault.deltaops.dev/mcp` | Bearer header |
| mac-mcp | `https://mac-mcp.deltaops.dev/{MAC_MCP_AUTH_TOKEN}/mcp` | Secret in URL |

### Account
- CF Account ID: `3d18a8bf1d47b952ec66dc00b76f38cd`
- Domain: `deltaops.dev`

## Steps

### 1. Verify Prerequisites (2 min)
Check if Global API key or dashboard access is available. If not, ask and wait.

### 2. Fix vault-mcp Auth for Portal Sync (5 min)
Recommend Option A: Allow `initialize` and `tools/list` without Bearer.
```bash
cd ~/Developer/infrastructure/vault-mcp && npx wrangler deploy
# Verify:
curl -sf -X POST https://vault.deltaops.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
# Should return 200 with tools list
```

### 3. Create MCP Servers + Portal (10 min)

**If programmatic (Global API Key):**
```bash
CF_EMAIL=$(security find-generic-password -a "osman" -s "CF_EMAIL" -w)
CF_KEY=$(security find-generic-password -a "osman" -s "CF_GLOBAL_API_KEY" -w)
ACCOUNT="3d18a8bf1d47b952ec66dc00b76f38cd"
MAC_SECRET=$(security find-generic-password -a "osman" -s "MAC_MCP_AUTH_TOKEN" -w)

# Create vault-mcp server
curl -sf -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/ai_controls/mcp/servers" \
  -H "X-Auth-Email: $CF_EMAIL" -H "X-Auth-Key: $CF_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"vault-mcp","http_url":"https://vault.deltaops.dev/mcp"}'

# Create mac-mcp server
curl -sf -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/ai_controls/mcp/servers" \
  -H "X-Auth-Email: $CF_EMAIL" -H "X-Auth-Key: $CF_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"mac-mcp\",\"http_url\":\"https://mac-mcp.deltaops.dev/$MAC_SECRET/mcp\"}"

# Create test portal
curl -sf -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/ai_controls/mcp/portals" \
  -H "X-Auth-Email: $CF_EMAIL" -H "X-Auth-Key: $CF_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"DeltaOps Infrastructure","subdomain":"mcp-test","domain":"deltaops.dev"}'
```

**If dashboard:** Ask Osama to:
1. CF One → Access controls → AI controls → MCP servers tab → Add vault-mcp + mac-mcp
2. Add MCP server portal → `mcp-test.deltaops.dev` → attach both servers
3. Require user auth → Disabled (server-side auth handles it)
4. Access policy → Allow → his email

### 4. Test from Claude.ai (10 min)
Ask Osama to:
1. Add connector: `https://mcp-test.deltaops.dev/mcp`
2. Complete OAuth popup
3. Test: `task list` (vault-mcp), `health_check` (mac-mcp), `run_command echo ok` (mac-mcp)
4. Note latency vs direct connectors

### 5. Decision & ADR (5 min)

| Outcome | Action |
|---------|--------|
| Both work, no delay | Adopt at `mcp.deltaops.dev` |
| Both work, noticeable delay | Skip, 3-endpoint fine |
| One/both fail | Skip, document why |

Write `docs/decisions/0029-portal-decision.md`. Update `docs/completion.md` with result.
```bash
cd ~/Developer/infrastructure && git add -A && git commit -m "docs: ADR-0029 portal spike decision" && git push
```

### 6. Cleanup
- Skip → delete test portal + server entries
- Adopt → create production portal at `mcp.deltaops.dev`, delete test

## Rules
- 30-minute hard timebox
- Don't modify mac-mcp code
- Only modify vault-mcp auth if needed (minimal)
- Write ADR regardless of outcome
- Update docs/completion.md with results
- Read secrets from Keychain, never ask to paste
