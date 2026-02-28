# Phase 5 — Orchestration Wiring Session Prompt

## Context
Phases 0-4 complete. vault-mcp v2 deployed with 10 tools. Executor running. **Much of Phase 5 code already exists** — the gap is wiring the execute tool into the workflow lifecycle, not building from scratch.

## What ALREADY EXISTS (don't rebuild)

### vault-mcp (~/Developer/infrastructure/vault-mcp/)
| File | Lines | What it does |
|------|-------|-------------|
| src/tools/execute.ts | 78 | Proxies to executor via POST /execute with x-auth-token. Returns normalized response. **Missing:** workflow init before, workflow write after, circuit breaker check. |
| src/tools/workflow.ts | 320 | Full lifecycle: init (creates D1 task + checks circuit breaker), spec, write (logs stage), close. Already calls getCircuitBreakerState. |
| src/tools/workflow-query.ts | 177 | Queries: summary, consensus, state, stats, chooser. |
| src/logic/circuit-breaker.ts | 69 | getCircuitBreakerState (queries D1), incrementCircuitBreaker. Thresholds: $20/day halt, $80/month alert. |
| src/logic/chooser.ts | 153 | Model recommendation based on task features. |
| src/logic/consensus.ts | 82 | Consensus diffing logic. |
| src/tools/task.ts | 223 | Human task CRUD in KV (separate from workflow tasks in D1). |

### Executor (VM: /home/ubuntu/executor/)
| File | Lines | What it does |
|------|-------|-------------|
| src/entrypoint.js | 613 | HTTP server, auth (x-auth-token), job queue (MAX_EXECUTORS=2, 180s timeout), worktree isolation, dispatches to claude/codex/gemini CLIs. |
| src/compress.js | 280 | Full Mermaid compression: normalizeOutput, toMermaid, 4 verbosity levels (summary/mermaid/standard/full). |
| src/consensus.js | ~80 | 2-way diff between executor outputs. |

### CLIs on VM (all installed and authed)
```
claude  2.1.63 (Claude Code) — Max OAuth
codex   0.104.0 — ChatGPT sub
gemini  0.29.7 — Gemini Ultra account
```

### D1 Tables (vault-db: 5a0c53ff-963c-48f9-b68d-f13536104aa1)
tasks, stages, circuit_breaker, model_stats, checkpoints, decisions, transcripts, _cf_KV

### Secrets (macOS Keychain, account "osman")
```bash
security find-generic-password -a "osman" -s "SECRET_NAME" -w
```
| Key | Purpose |
|-----|---------|
| CF_API_TOKEN | Cloudflare API (Workers/D1/KV) |
| VAULT_AUTH_TOKEN | Bearer for vault-mcp /mcp and REST |
| MAC_MCP_AUTH_TOKEN | Secret path segment for mac-mcp |
| EXECUTOR_SECRET | x-auth-token for executor.deltaops.dev |

### Wrangler secrets (already set on vault-mcp Worker)
VAULT_AUTH_TOKEN, EXECUTOR_SECRET, GITHUB_PAT, GITHUB_WEBHOOK_SECRET

## What Needs Wiring (the actual Phase 5 work)

### 5.1 Execute → Workflow Lifecycle Integration (the main gap)
The execute tool (execute.ts) currently just proxies to the executor and returns. It needs to:

1. **Before proxy:** Check circuit breaker, create workflow task via D1
2. **After proxy:** Log stage result (cost, latency, tokens, model) to D1
3. **On error:** Log error stage, return graceful message

Concretely, modify `registerExecuteTool` in execute.ts to:
```typescript
// Before proxy:
const cb = await getCircuitBreakerState(env.VAULT_DB);
if (cb.halted) return mcpError(`Circuit breaker: ${cb.message}`);

const task = await createTask(env.VAULT_DB, {
  task_type: params.task_type ?? "feature",
  complexity: params.complexity ?? "simple",
  language: params.language ?? "typescript",
  stack: params.stack ?? "node",
});

const start = Date.now();

// Proxy (existing code)
const result = await proxyToExecutor(env, params);

// After proxy:
const latencyMs = Date.now() - start;
await writeStage(env.VAULT_DB, {
  task_id: task.id,
  stage_name: params.executor ?? "claude",
  stage_type: "impl",
  model: params.model ?? "sonnet-4.6",
  tokens_input: result.tokens?.input ?? 0,
  tokens_output: result.tokens?.output ?? 0,
  cost_usd: estimateCost(result.tokens, params.model),
  latency_ms: latencyMs,
  output: result,
});

await incrementCircuitBreaker(env.VAULT_DB, estimatedCost);
```

The `createTask` and `writeStage` functions already exist in workflow.ts — import and call them. Don't duplicate D1 logic.

### 5.2 End-to-End Validation (test after wiring)
Test each executor path with a trivial task:
```bash
# From Claude.ai via vault-mcp MCP tool (preferred) or via REST:
VAULT_TOKEN=$(security find-generic-password -a "osman" -s "VAULT_AUTH_TOKEN" -w)

# Test claude executor
curl -sf -X POST https://vault.deltaops.dev/tasks/execute \
  -H "Authorization: Bearer $VAULT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "echo hello world",
    "executor": "claude",
    "repo": "oosman/Infrastructure",
    "task_type": "docs",
    "complexity": "trivial"
  }'

# After: verify stage logged
curl -sf -H "Authorization: Bearer $VAULT_TOKEN" "https://vault.deltaops.dev/workflow/stats"
```

Repeat for codex and gemini executors. Then test consensus (2-way).

### 5.3 Verify Circuit Breakers Fire
After a few test executions, check:
```sql
SELECT * FROM circuit_breaker;
SELECT * FROM stages ORDER BY created_at DESC LIMIT 5;
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 5;
```
Use Cloudflare MCP `d1_database_query` tool with database_id `5a0c53ff-963c-48f9-b68d-f13536104aa1`.

### 5.4 Verify Mermaid Compression
The executor already compresses output. Verify the vault-mcp execute tool passes verbosity through and returns compressed results. Default should be Mermaid (<80 tokens for simple tasks).

### 5.5 Stale Code Cleanup
`src/env.ts` still references `VAULT_MCP: DurableObjectNamespace` — remove it (DO was dropped).
`wrangler.toml` may still have DO migration — check and clean.

## Deploy Commands
```bash
# vault-mcp
cd ~/Developer/infrastructure/vault-mcp && npx wrangler deploy

# Verify deploy
curl -sf https://vault.deltaops.dev/health

# Verify tools (with auth)
VAULT_TOKEN=$(security find-generic-password -a "osman" -s "VAULT_AUTH_TOKEN" -w)
curl -sf -X POST https://vault.deltaops.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VAULT_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Validation Criteria
- [ ] execute tool checks circuit breaker before proxying
- [ ] execute tool creates workflow task in D1 before execution
- [ ] execute tool logs stage result (cost, latency, tokens) to D1 after execution
- [ ] Claude executor end-to-end works (instruction → VM → result → D1 logged)
- [ ] Codex executor end-to-end works
- [ ] Gemini executor end-to-end works
- [ ] Consensus 2-way returns diff
- [ ] Circuit breaker data accumulates in D1
- [ ] Mermaid compression returns <80 tokens for trivial tasks
- [ ] Error handling: timeout, auth failure, network failure all graceful
- [ ] Stale DO references cleaned from env.ts and wrangler.toml

## Rules
- Use sonnet for all CC dispatches (never opus)
- Read secrets from Keychain, never ask Osama to paste them
- Test via curl before claiming anything works
- Don't rebuild existing code — wire it together
- Commit and push after each working change
- Git identity: Osama Osman <oosman@deltaops.dev>
