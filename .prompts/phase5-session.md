# Phase 5 — Orchestration Wiring Session Prompt

## Context
Infrastructure phases 0-4 are complete. vault-mcp v2 is deployed at vault.deltaops.dev with 10 tools using stateless Streamable HTTP (McpAgent/DO dropped, using WebStandardStreamableHTTPServerTransport). Executor is running at executor.deltaops.dev with auth, Mermaid compression, and hardened systemd. D1 has 8 tables. KV has task storage. vault-mcp should be connected as an MCP server in Claude.ai by the time this session starts.

## Current State
- vault-mcp: v2.0.0, Streamable HTTP, 10 tools, Bearer auth on /mcp and REST, /health unauthenticated
- executor: Node.js on VM (100.53.55.116), port 8080, x-auth-token auth, MAX_EXECUTORS=2, 180s timeout
- executor has: compress.js (Mermaid compression with 4 verbosity levels), consensus.js (2-way diff), entrypoint.js (613 lines)
- vault-mcp execute tool already proxies to executor via POST /execute with x-auth-token
- D1 tables: tasks, stages, circuit_breaker, model_stats, checkpoints, decisions, transcripts, _cf_KV
- Secrets: EXECUTOR_SECRET, VAULT_AUTH_TOKEN, CF_API_TOKEN, MAC_MCP_AUTH_TOKEN (all in macOS Keychain)
- VM secrets in /home/ubuntu/executor/.env

## What Exists (don't rebuild)
- vault-mcp/src/tools/execute.ts — proxy to executor, Mermaid extraction from response
- vault-mcp/src/tools/workflow.ts — init/spec/write/close actions, D1 writes
- vault-mcp/src/tools/workflow-query.ts — summary/consensus/state/stats/chooser queries
- executor/src/compress.js — full Mermaid compression (normalizeOutput, toMermaid, 4 verbosity levels)
- executor/src/consensus.js — 2-way consensus diffing
- executor/src/entrypoint.js — HTTP server, auth, queueing, worktree isolation, CLI dispatch

## What Needs Wiring (Phase 5 deliverables)

### 5.1 Execute Tool Integration
The execute tool proxies to the executor but doesn't integrate with workflow lifecycle. Wire it:
1. Before proxying: check circuit breakers (query D1 daily/monthly spend)
2. Before proxying: call workflow init to create task entry
3. After response: call workflow write with stage output, cost, latency, tokens
4. Return compressed result (executor already returns Mermaid by default)
5. On error: log error stage, return graceful error

### 5.2 Task Lifecycle End-to-End
Test the full flow: init → spec → execute → write → close
- Orchestrator (Claude.ai) calls execute tool
- vault-mcp creates workflow task, proxies to executor, logs result, returns Mermaid
- Orchestrator reviews, calls close

### 5.3 Circuit Breakers
In vault-mcp, before each execute:
```sql
SELECT SUM(cost_usd) FROM stages WHERE date(created_at) = date('now')
SELECT SUM(cost_usd) FROM stages WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
```
Thresholds: $2/task warn, $5/task halt, $20/day block, $80/month flag.
Store state in circuit_breaker D1 table. Include in health() response.

### 5.4 Mermaid Compression Validation
Executor already has compress.js. Validate:
- Default verbosity returns Mermaid (<80 tokens for simple tasks)
- All 4 levels work (summary, mermaid, standard, full)
- Consensus results return properly formatted diff Mermaid

### 5.5 Per-CLI Validation
Test each executor path end-to-end:
1. claude (CC via Max OAuth on VM) — `execute({executor: "claude", ...})`
2. codex (ChatGPT sub on VM) — `execute({executor: "codex", ...})`  
3. gemini (Gemini CLI on VM) — `execute({executor: "gemini", ...})`
4. consensus (2-way) — `execute({executor: "consensus", ...})`

For each: verify auth, output format, Mermaid compression, workflow logging.

Note: CLIs may not all be installed/authed on VM yet. Check first:
```bash
ssh vm "which claude && which codex && which gemini"
ssh vm "claude --version && codex --version 2>/dev/null"
```

### 5.6 Escalation Protocol
Cheapest → next tier on failure:
DeepSeek → Flash → 2.5 Pro → Sonnet → Opus → Consensus → Human

## Validation Criteria
- [ ] Claude.ai → execute → vault-mcp → VM → executor → Mermaid back
- [ ] Same path with each CLI (claude, codex, gemini)
- [ ] Workflow lifecycle: init → execute → write → close
- [ ] Every execution auto-logged to D1 stages table
- [ ] Circuit breakers fire at thresholds
- [ ] Mermaid compression < 80 tokens for simple tasks
- [ ] Consensus 2-way returns diff Mermaid
- [ ] Error handling: timeout, auth failure, network failure all graceful

## Key Files
- ~/Developer/infrastructure/vault-mcp/src/tools/execute.ts
- ~/Developer/infrastructure/vault-mcp/src/tools/workflow.ts
- ~/Developer/infrastructure/vault-mcp/src/tools/workflow-query.ts
- ~/Developer/infrastructure/vault-mcp/src/routes/execute-proxy.ts
- ~/Developer/infrastructure/vault-mcp/wrangler.toml
- VM: /home/ubuntu/executor/src/entrypoint.js
- VM: /home/ubuntu/executor/src/compress.js
- VM: /home/ubuntu/executor/src/consensus.js

## Deploy Commands
```bash
# vault-mcp
cd ~/Developer/infrastructure/vault-mcp && npx wrangler deploy

# Verify
curl -sf https://vault.deltaops.dev/health
```

## Rules
- Use sonnet for all CC dispatches (never opus)
- Read from Keychain, never ask for secrets
- Test via curl before claiming anything works
- Don't rebuild what exists — wire it together
