# vault-mcp v2 Rebuild Specification

## Overview
Rebuild vault-mcp using the Cloudflare Agents SDK McpAgent class.
Consolidate 20+ tools to 10. Rename routes to /workflow. Use Streamable HTTP + SSE.

## Architecture
- Cloudflare Worker at vault.deltaops.dev
- VaultMcpAgent class extending McpAgent from "agents/mcp"
- McpServer from "@modelcontextprotocol/sdk/server/mcp.js"
- D1 for workflow state, KV for human tasks
- Bearer token auth on all endpoints
- REST API routes for HTTP clients (curl, scripts, iPhone)

## Bindings
- D1: binding=VAULT_DB, database_name=vault-db, database_id=5a0c53ff-963c-48f9-b68d-f13536104aa1
- KV: binding=TASKS_KV, id=0e01cc2910764d66a3cf8910f8e25eff
- DO: binding=VAULT_MCP, class_name=VaultMcpAgent
- Secrets: VAULT_AUTH_TOKEN, GITHUB_PAT, GITHUB_WEBHOOK_SECRET, EXECUTOR_SECRET

## 10 Consolidated Tools

### 1. workflow
Action: init | spec | write | close
- init: Create workflow task (validates task_type, complexity, language, stack). Checks circuit breaker.
- spec: Write specification for task (task_id, spec text)
- write: Write stage output (task_id, stage_name, stage_type, model, output{files_changed, security_surface, test_targets, dependencies_added, breaking_changes, raw}, tokens_input, tokens_output, cost_usd, latency_ms). Updates circuit breaker and task totals.
- close: Finalize task (task_id, final_model, first_attempt_success, human_correction_needed, quality_score, consensus_type, consensus_result, models_used). Updates model_stats.

### 2. workflow_query
Query: summary | consensus | state | stats | chooser | stage_read
- summary: Get thin status for a task (~150 tokens)
- consensus: Diff all impl stages (needs 2+)
- state: Session recovery document (open tasks, recent closed, circuit breaker)
- stats: Aggregate dashboard (task counts, cost by model, model performance)
- chooser: Model recommendation based on task_type, complexity, language, stack, context_tokens
- stage_read: Read a single stage output (task_id, stage_name)

### 3. task
Action: add | update | done | retro | list
- add: Create human task (title, project, source, context). Context required when source=auto.
- update: Edit task fields (id, title, project, context, occurred_at)
- done: Mark complete (id)
- retro: Record already-completed work (title, project, context, occurred_at)
- list: Filter by status/project (default: open). Returns markdown format option.

### 4. execute
Proxy to Lightsail VM executor. Params: instruction, executor (claude|codex|gemini|consensus), model, repo, task_type, complexity, language, stack, verbosity.

### 5. github
Action: read | write | pr
- read: Read file from repo (owner, repo, path, ref)
- write: Write/update file (owner, repo, path, content, message, sha, branch)
- pr: Create pull request (owner, repo, title, body, head, base)

### 6. checkpoint
Action: load | save | decide
- load: Load latest recovery document from D1
- save: Create checkpoint (objective, blockers, recent_actions)
- decide: Record architectural decision (decision, rationale, task_id)

### 7. search
Search transcripts: query string, optional session date, limit.

### 8. pricing
Get model pricing/recommendation. Same as chooser but standalone.

### 9. health
System status: D1 connectivity, KV connectivity, executor reachability, timestamps.

### 10. backup
Export KV tasks and D1 data as JSON.

## D1 Schema (4 tables — migrations run separately, do NOT run them)
- tasks: id, task_type, complexity, language, stack, domain, scope, is_greenfield, has_tests, description, spec, status, total_attempts, models_used, final_model, first_attempt_success, total_cost_usd, total_latency_ms, human_correction_needed, quality_score, consensus_type, consensus_result, created_at, completed_at, updated_at
- stages: id, task_id, stage_name, stage_type, model, output (JSON), tokens_input, tokens_output, cost_usd, latency_ms, created_at
- circuit_breaker: period_type, period_key, total_cost_usd, task_count, updated_at (UNIQUE on period_type+period_key)
- model_stats: id (model:task_type:complexity), model, task_type, complexity, language, total_tasks, successes, failures, avg_cost_usd, avg_latency_ms, first_attempt_success_rate, human_correction_rate, updated_at
- checkpoints: id, content, trigger_signals, cumulative_weight, created_at
- decisions: id, decision, rationale, task_id, created_at
- transcripts: id, session_date, role, content, created_at

## REST Routes (keep for HTTP clients)
POST /workflow/init → create task
POST /workflow/:id/spec → write spec
POST /workflow/:id/stage → write stage
GET  /workflow/:id/summary → task summary
POST /workflow/:id/close → close task
GET  /workflow/:id/consensus → consensus
GET  /workflow/:id/stage/:name → read stage
GET  /workflow/:id/{files-changed,security-surface,test-targets,dependencies-added,breaking-changes} → projections
GET  /workflow/state/current → session state
GET  /workflow/stats → aggregate stats
GET  /workflow/chooser?task_type=&complexity=&language= → model recommendation

POST /tasks → add task
GET  /tasks?status=&project=&format=md → list tasks
PUT  /tasks/:id → update task
POST /tasks/:id/done → complete task
POST /tasks/retroactive → retroactive task

GET  /search?q=&session=&limit= → transcript search
POST /transcripts → transcript ingest
POST /execute → executor proxy
POST /github/webhook → GitHub webhook
GET  /github/status → webhook status
GET  /health → health check (NO AUTH required)

## Auth
- Bearer token auth on all endpoints EXCEPT /health and /github/webhook (has its own HMAC auth)
- MCP endpoint (/mcp) also requires Bearer token
- Constant-time comparison for token verification

## Entry Point Pattern
```typescript
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class VaultMcpAgent extends McpAgent<Env, {}, {}> {
  server = new McpServer({ name: "vault-mcp", version: "2.0.0" });

  async init() {
    // Register all 10 tools using this.server.tool()
    // Each tool uses z.object() for schema
    // Handler has access to this.env for D1/KV bindings
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Health — no auth
    if (url.pathname === "/health") return healthResponse();

    // GitHub webhook — own auth
    if (url.pathname.startsWith("/github/")) return handleGitHubWebhook(request, env);

    // MCP transport → VaultMcpAgent DO (Streamable HTTP)
    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      if (!verifyBearerAuth(request, env)) return unauthorized();
      // Route to DO — use VaultMcpAgent.serve() pattern or manual DO routing
      return (VaultMcpAgent.serve("/mcp") as any).fetch(request, env, ctx);
    }

    // REST API — Bearer auth
    if (!verifyBearerAuth(request, env)) return unauthorized();
    // ... route dispatch
  }
};
```

## IMPORTANT NOTES
- Use "workflow" in all routes
- D1 binding is VAULT_DB
- Do NOT run D1 migrations — another session handles this
- Keep ULID generation (Crockford base32, monotonic)
- Keep circuit breaker logic (daily $20, monthly $80)
- Keep model stats aggregation on task close
- Keep consensus computation (set-based field diff)
- Keep chooser with both data-driven and rule-based routing
- SSE keepalive every 30s on /sse connections
- The Worker MUST export VaultMcpAgent class for DO binding

## Dependencies (package.json)
- agents (Cloudflare Agents SDK)
- @modelcontextprotocol/sdk
- zod
- wrangler (dev)
- @cloudflare/workers-types (dev)

## Env Interface
```typescript
interface Env {
  VAULT_DB: D1Database;
  TASKS_KV: KVNamespace;
  VAULT_MCP: DurableObjectNamespace;
  VAULT_AUTH_TOKEN: string;
  GITHUB_PAT: string;
  GITHUB_WEBHOOK_SECRET: string;
  EXECUTOR_SECRET: string;
  EXECUTOR_URL?: string;
}
```
