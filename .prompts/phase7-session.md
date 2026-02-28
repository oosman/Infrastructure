# Phase 7 — AI Gateway Session Prompt

## Read First
- `docs/completion.md` — canonical ledger, update when done
- `CLAUDE.md` — repo context

## Context
Phases 0-6 complete. vault-mcp v2.0.0 deployed with 10 tools, execute tool wired to D1 lifecycle. Executor on VM with 3 CLIs. Portal adopted (mcp-test.deltaops.dev, 24 tools).

## What Already Exists
- vault-mcp Worker with `waitUntil()` plumbing (index.ts passes ctx.waitUntil to routes)
- No classification logic implemented yet — waitUntil is wired but no Haiku/Flash calls exist
- Circuit breaker tracking daily/monthly cost in D1
- CF Account ID: 3d18a8bf1d47b952ec66dc00b76f38cd

## What Phase 7 Delivers
1. **CF AI Gateway created** — `infra-gateway`
2. **Classification pass implemented** — after execute tool returns, waitUntil fires a Haiku call to backfill structured fields (task_type, complexity, language, stack) on the D1 task record
3. **Classification routed through gateway** — base URL points to gateway endpoint, not direct Anthropic API
4. **Caching configured** — system prompt cached (same every time), task content not cached
5. **Analytics visible** — request count, token usage, cache hits in CF dashboard

## Steps

### 7.1 Create Gateway
Use Cloudflare MCP or CF API:
```
Gateway ID: infra-gateway
Endpoint: https://gateway.ai.cloudflare.com/v1/3d18a8bf1d47b952ec66dc00b76f38cd/infra-gateway/
```
Enable: caching (TTL 3600s), logging (7-day retention), rate limiting (100 req/min).

### 7.2 Add Secrets
```bash
cd vault-mcp
npx wrangler secret put CF_AIG_TOKEN
# Value: create a cf-aig-authorization token in gateway settings
```

### 7.3 Implement Classification Pass
In vault-mcp, after execute tool writes stage to D1, fire a waitUntil classification:

```typescript
// In execute.ts, after writeStage succeeds:
ctx.waitUntil(classifyTask(env, taskId, instruction, executorOutput));
```

Classification function:
- POST to `https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/infra-gateway/anthropic/v1/messages`
- Model: claude-haiku-4-5-20251001
- Headers: `cf-aig-authorization: Bearer {CF_AIG_TOKEN}`, `cf-aig-metadata-task_id: {taskId}`, `cf-aig-skip-cache: true`
- System prompt: "Classify this task. Return JSON: {task_type, complexity, language, stack, domain}"
- User content: first 500 chars of instruction + first 500 chars of output
- On success: UPDATE tasks SET task_type=?, complexity=?, language=?, stack=?, domain=? WHERE id=?
- On failure: log and move on (classification is best-effort)

### 7.4 Update env.ts
Add to Env interface:
```typescript
CF_ACCOUNT_ID: string;
CF_AIG_TOKEN: string;
```

### 7.5 Deploy and Validate

## Credentials
- CF_API_TOKEN in Keychain (for wrangler)
- Wrangler OAuth at ~/.wrangler/config/default.toml
- Deploy: `cd vault-mcp && npx wrangler deploy`

## Validation Criteria
- [ ] Gateway visible in CF dashboard (AI → AI Gateway → infra-gateway)
- [ ] Execute tool still works end-to-end (no regression)
- [ ] Classification fires after execution (check D1 tasks table for populated task_type/complexity)
- [ ] Gateway logs show classification requests
- [ ] Cache stats visible (system prompt should cache)
- [ ] Rate limiting active
- [ ] Cost: ~$0.002/classification (Haiku pricing)

## Rules
- Model: sonnet for CC agents (non-negotiable)
- Commit message format: `feat(vault-mcp): phase 7 — AI Gateway + classification`
- Update docs/completion.md with results before ending
- Do NOT touch executor code — this is vault-mcp only
