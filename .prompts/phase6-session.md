# Phase 6 — MCP Server Portal Spike (30 min)

## Context
Phases 0-4 complete. Phase 5 running in parallel. This is a **30-minute spike** to test Cloudflare's MCP Server Portal for consolidating MCP endpoints into one URL.

## Research Findings (already done)
- Portal uses **OAuth** for client auth — Claude.ai supports this ✅
- When adding servers to Portal, you provide the **full HTTP URL** — secret path segments work ✅
- Portal stores server URLs server-side — secrets never exposed to MCP client ✅
- Portal supports both OAuth-authed and unauthenticated upstream servers ✅
- Portal syncs tools by calling `tools/list` on the server URL you provide

## Our Servers
| Server | Portal URL to use | Auth model |
|--------|-------------------|------------|
| vault-mcp | `https://vault.deltaops.dev/mcp` | Bearer token — Portal needs to auth somehow |
| mac-mcp | `https://mac-mcp.deltaops.dev/{SECRET}/mcp` | Secret in URL — Portal stores it server-side ✅ |

**Known risk:** vault-mcp `/mcp` requires Bearer auth. When Portal tries to sync tools, it may fail because it can't pass a Bearer token. Two fixes if this happens:
- Option A: Make vault-mcp's `tools/list` method unauthenticated (keep tool execution authed via session)
- Option B: Add the VAULT_AUTH_TOKEN as a query param or path segment (like mac-mcp pattern)

Read the MAC_MCP_AUTH_TOKEN secret path from the Mac MCP connector URL in Claude.ai settings (it's the path segment before /mcp).

## Steps

### 1. Add MCP Servers to Cloudflare (5 min)
1. Go to Cloudflare One → Access controls → AI controls → MCP servers tab
2. Add vault-mcp:
   - Name: `vault-mcp`
   - HTTP URL: `https://vault.deltaops.dev/mcp`
   - Add an Allow policy (e.g., email = your email)
   - Save and connect — if it prompts for OAuth, that means vault-mcp needs OAuth support (go to step 1b)
   - If it just validates and shows tools → great, move on
3. Add mac-mcp:
   - Name: `mac-mcp`  
   - HTTP URL: `https://mac-mcp.deltaops.dev/{SECRET_PATH}/mcp` (use the actual secret segment)
   - Add an Allow policy
   - Save and connect

**If vault-mcp fails to connect** (likely — Bearer auth blocks tool sync):
- Option A (quick): Temporarily allow unauthenticated `tools/list` on vault-mcp. Edit vault-mcp index.ts to skip auth for `method: "tools/list"` only. Deploy with `cd ~/Developer/infrastructure/vault-mcp && npx wrangler deploy`. Re-test.
- Option B (better): Add vault-mcp's Bearer token as a path segment like mac-mcp. Change vault-mcp to accept `/mcp/{token}` in addition to Bearer header. Deploy. Use the token URL in Portal config.

### 2. Create Portal (5 min)
1. Cloudflare One → Access controls → AI controls → Add MCP server portal
2. Name: `DeltaOps Infrastructure`
3. Custom domain: `mcp-test.deltaops.dev` (test subdomain first)
4. Add both servers (vault-mcp + mac-mcp)
5. For each server: "Require user auth" → Disabled (we use server-side auth, not per-user OAuth)
6. Add Access policy: Allow → email = your email
7. Save

### 3. Test from Claude.ai (10 min)
1. Go to Claude.ai Settings → Connectors
2. Add new MCP connector with URL: `https://mcp-test.deltaops.dev/mcp`
3. It should trigger OAuth popup → log in → see both servers
4. Test:
   - Are all 10 vault-mcp tools visible?
   - Are all 11 mac-mcp tools visible?
   - Run: `task list` (vault-mcp) — does it return data?
   - Run: `health_check` (mac-mcp) — does it return health?
   - Run: `echo ok` via run_command (mac-mcp) — does it execute?

### 4. Measure Latency (5 min)
Compare in conversation:
- Direct vault-mcp tool call vs portal vault-mcp tool call
- Direct mac-mcp tool call vs portal mac-mcp tool call
- Note any perceptible delay

### 5. Decision (5 min)

| Outcome | Action |
|---------|--------|
| Both work, no perceptible delay | **Adopt.** Create production portal at `mcp.deltaops.dev`. Remove individual connectors. |
| Both work, noticeable delay | **Skip.** Latency tax not worth it for solo operator. |
| vault-mcp fails, mac-mcp works | **Partial.** Evaluate if vault-mcp fix is worth it. |
| Neither works | **Skip.** Stay 3-endpoint. |

### 6. If Adopting
1. Create production portal at `mcp.deltaops.dev`
2. Move servers from test to production portal
3. Update Claude.ai: replace 2 individual connectors with single portal connector
4. Delete test portal (`mcp-test.deltaops.dev`)
5. Keep direct connector configs documented as fallback

### 7. Cleanup & ADR
- Delete test portal if not adopting (or if moved to production)
- Create ADR-0029 in `~/Developer/infrastructure/docs/decisions/0029-portal-decision.md`
- Use template from `docs/decisions/_adr-template.md`
- Include: what was tested, latency measurements, auth findings, decision, rationale
- Commit and push

## CF Account ID
3d18a8bf1d47b952ec66dc00b76f38cd

## Rules
- 30-minute hard timebox
- Don't modify mac-mcp code
- Only modify vault-mcp if needed for auth compatibility (minimal change)
- Test on mcp-test.deltaops.dev first, not production
- Write ADR regardless of outcome
- This is independent of Phase 5 — don't touch execute/workflow code
