# Phase 6 — MCP Server Portal Spike (30 min)

## Context
Phases 0-4 complete. Phase 5 running in parallel. Test Cloudflare's MCP Server Portal for consolidating MCP endpoints into one URL.

Research confirmed: Portal uses OAuth (Claude.ai supports it), server URLs stored server-side (secret paths work), Portal calls tools/list to sync capabilities.

## KNOWN BLOCKERS — Read Before Starting

### Blocker 1: CF_API_TOKEN lacks Zero Trust permissions
The existing `CF_API_TOKEN` in Keychain is scoped to Workers/D1/KV only. It **cannot** create MCP servers or portals via API. The Zero Trust APIs require `Access: Apps and Policies Write` permission.

**This requires Osama to do ONE of:**
- Option A: Update existing CF_API_TOKEN in CF dashboard → API Tokens → edit → add `Access: Apps and Policies Write`
- Option B: Create new `CF_ZT_API_TOKEN` with Zero Trust permissions, store in Keychain:
  ```
  security add-generic-password -a osman -s CF_ZT_API_TOKEN -w "<new-token>" -U
  ```

**If Osama has not done this yet, ask him which option he prefers and wait. Do not attempt Zero Trust API calls with the current token — they will 403.**

### Blocker 2: vault-mcp /mcp requires Bearer auth
vault-mcp returns 401 on `/mcp` without Authorization header. When the Portal tries to sync tools (calls `tools/list`), it won't be able to authenticate.

**Tested:**
```
No auth:   POST https://vault.deltaops.dev/mcp → 401
With auth: POST https://vault.deltaops.dev/mcp + "Authorization: Bearer {VAULT_AUTH_TOKEN}" → 200
```

**Fixes (pick one during spike):**
- Option A (quick): Make `initialize` and `tools/list` methods bypass auth in vault-mcp. Keep all tool execution authed. Edit `vault-mcp/src/index.ts`, deploy with `cd ~/Developer/infrastructure/vault-mcp && npx wrangler deploy`.
- Option B (better): Add secret path segment to vault-mcp like mac-mcp uses. Register vault-mcp in Portal with URL `https://vault.deltaops.dev/{VAULT_AUTH_TOKEN}/mcp`. Requires code change to vault-mcp to accept path-based auth.

## Infrastructure Details

### Secrets (all in macOS Keychain, account "osman")
```bash
# Read any secret:
security find-generic-password -a "osman" -s "SECRET_NAME" -w
```
| Key | Chars | Purpose |
|-----|-------|---------|
| CF_API_TOKEN | 40 | Cloudflare API (Workers/D1/KV only — NO Zero Trust) |
| VAULT_AUTH_TOKEN | 64 | Bearer token for vault-mcp |
| MAC_MCP_AUTH_TOKEN | 64 | This IS the secret path segment for mac-mcp |
| EXECUTOR_SECRET | 64 | x-auth-token for executor (not needed for Portal) |

### Endpoints
| Server | URL | Auth | Transport |
|--------|-----|------|-----------|
| vault-mcp | `https://vault.deltaops.dev/mcp` | Bearer header | Streamable HTTP |
| mac-mcp | `https://mac-mcp.deltaops.dev/{MAC_MCP_AUTH_TOKEN}/mcp` | Secret in URL path | Streamable HTTP |

### Account
- CF Account ID: `3d18a8bf1d47b952ec66dc00b76f38cd`
- Domain: `deltaops.dev` (active zone in Cloudflare)

## Steps

### 1. Verify Prerequisites (2 min)
- Check if Osama has updated/created Zero Trust API token
- If not, ask and wait — this is a hard blocker

### 2. Fix vault-mcp Auth for Portal Sync (5 min)
Pick Option A or B from Blocker 2 above. Recommend Option A (quickest):

In `~/Developer/infrastructure/vault-mcp/src/index.ts`, find the auth check for /mcp POST requests. Allow `initialize` and `tools/list` methods through without Bearer token. All other methods (tools/call etc.) still require auth.

```bash
cd ~/Developer/infrastructure/vault-mcp && npx wrangler deploy
# Verify: curl -sf -X POST https://vault.deltaops.dev/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' → should return 200 with tools
```

### 3. Create MCP Servers via API (5 min)
```bash
CF_ZT_TOKEN=$(security find-generic-password -a "osman" -s "CF_ZT_API_TOKEN" -w 2>/dev/null || security find-generic-password -a "osman" -s "CF_API_TOKEN" -w)
ACCOUNT_ID="3d18a8bf1d47b952ec66dc00b76f38cd"
MAC_SECRET=$(security find-generic-password -a "osman" -s "MAC_MCP_AUTH_TOKEN" -w)

# Create vault-mcp server
curl -sf -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai_controls/mcp_servers" \
  -H "Authorization: Bearer $CF_ZT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vault-mcp",
    "http_url": "https://vault.deltaops.dev/mcp"
  }'

# Create mac-mcp server  
curl -sf -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai_controls/mcp_servers" \
  -H "Authorization: Bearer $CF_ZT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"mac-mcp\",
    \"http_url\": \"https://mac-mcp.deltaops.dev/$MAC_SECRET/mcp\"
  }"
```

Note: API schema may differ — check response. If API doesn't work for this, fall back to CF One dashboard: Access controls → AI controls → MCP servers tab.

### 4. Create Test Portal (5 min)
```bash
curl -sf -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai_controls/mcp_portals" \
  -H "Authorization: Bearer $CF_ZT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DeltaOps Infrastructure",
    "subdomain": "mcp-test",
    "domain": "deltaops.dev",
    "servers": ["vault-mcp", "mac-mcp"]
  }'
```

If API fails, use dashboard: AI controls → Add MCP server portal → domain `mcp-test.deltaops.dev`.

### 5. Test from Claude.ai (10 min)
Ask Osama to:
1. Add MCP connector: URL `https://mcp-test.deltaops.dev/mcp`
2. Complete OAuth popup
3. Test vault-mcp: call `task list` or `health`
4. Test mac-mcp: call `health_check` or `run_command` with `echo ok`
5. Note latency vs direct connectors

### 6. Decision & ADR (5 min)

| Outcome | Action |
|---------|--------|
| Both work, no perceptible delay | **Adopt.** Production portal at `mcp.deltaops.dev`. |
| Both work, noticeable delay | **Skip.** 3-endpoint model fine for now. |
| One or both fail | **Skip.** Document why. |

Write `docs/decisions/0029-portal-decision.md` using template from `docs/decisions/_adr-template.md`.
Include: what was tested, auth findings, latency, decision.

```bash
cd ~/Developer/infrastructure && git add -A && git commit -m "docs: ADR-0029 portal spike decision" && git push origin main
```

### 7. Cleanup
- If skipping: delete test portal and MCP server entries in CF dashboard
- If adopting: create production portal at `mcp.deltaops.dev`, delete test, update Claude.ai connectors

## Rules
- 30-minute hard timebox
- Don't modify mac-mcp code at all
- Only modify vault-mcp auth if needed for Portal sync (minimal change)
- Test on mcp-test.deltaops.dev first
- Write ADR regardless of outcome
- Independent of Phase 5 — don't touch execute/workflow/lifecycle code
- Read secrets from Keychain, never ask Osama to paste them
