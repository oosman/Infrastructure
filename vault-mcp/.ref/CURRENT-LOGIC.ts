// REFERENCE: Current deployed vault-mcp v1 business logic
// This is the extracted, readable version of the deployed bundled Worker code.
// CC agent should port this logic into the new Agents SDK architecture.

// ============================================================
// ULID Generation (keep as-is)
// ============================================================
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let _lastTime = 0;
let _lastRandom = "";

function encodeTime(ms: number): string {
  let str = "";
  let t = ms;
  for (let i = 0; i < 10; i++) {
    str = CROCKFORD[t % 32] + str;
    t = Math.floor(t / 32);
  }
  return str;
}

function encodeRandom(): string {
  let str = "";
  for (let i = 0; i < 16; i++) {
    str += CROCKFORD[Math.floor(Math.random() * 32)];
  }
  return str;
}

function incrementBase32(str: string): string {
  const chars = str.split("");
  for (let i = chars.length - 1; i >= 0; i--) {
    const idx = CROCKFORD.indexOf(chars[i]);
    if (idx < 31) {
      chars[i] = CROCKFORD[idx + 1];
      return chars.join("");
    }
    chars[i] = CROCKFORD[0];
  }
  return chars.join("");
}

function ulid(): string {
  const now = Date.now();
  const time = encodeTime(now);
  if (now === _lastTime) {
    _lastRandom = incrementBase32(_lastRandom);
  } else {
    _lastTime = now;
    _lastRandom = encodeRandom();
  }
  return time + _lastRandom;
}

// ============================================================
// Helpers
// ============================================================
function now(): string { return new Date().toISOString(); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function thisMonth(): string { return new Date().toISOString().slice(0, 7); }

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" }
  });
}

function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ============================================================
// Validation
// ============================================================
const VALID_TASK_TYPES = ["fix", "feature", "test", "refactor", "review", "docs"];
const VALID_COMPLEXITIES = ["trivial", "simple", "moderate", "complex"];

// validateTaskNature: checks task_type, complexity, language, stack (required), domain/scope/is_greenfield/has_tests (optional)
// validateStageWrite: checks stage_name, stage_type (required), model, output.{files_changed,security_surface,test_targets,dependencies_added,breaking_changes,raw}, tokens_input/output, cost_usd, latency_ms

// ============================================================
// Circuit Breaker
// ============================================================
// getCircuitBreakerState(db): reads daily/monthly cost from circuit_breaker table
// - halted if daily >= $20
// - alert at monthly >= $80
// incrementCircuitBreaker(db, costUsd): upserts daily+monthly rows

// ============================================================
// Workflow (Pipeline) Operations — D1
// ============================================================
// createTask(db, params): validates, checks CB, INSERT into tasks, returns task object
// writeSpec(db, taskId, spec): UPDATE tasks SET spec=, status=in_progress
// writeStage(db, taskId, input): INSERT into stages, update task cost/attempts, increment CB
//   - Alert at task cost > $5 (HALT) or > $2 (WARNING)
// getTaskSummary(db, taskId): SELECT task + stages (thin summary)
// closeTask(db, taskId, params): UPDATE status=closed, update model_stats
// updateModelStats(db, task): UPSERT model_stats (weighted averages)
// getProjection(db, taskId, field): merge field arrays across all stages
// getConsensus(db, taskId): compute set-based diff across impl stages
// readStage(db, taskId, stageName): SELECT single stage
// getSessionState(db): open tasks + recent closed + CB state
// getStats(db): task counts, cost by model, model performance, CB state

// ============================================================
// Consensus
// ============================================================
const STRUCTURED_FIELDS = ["files_changed", "security_surface", "test_targets", "dependencies_added", "breaking_changes"];
// computeConsensus(stages): for each field, check if all impl stages agree (set equality)
// Returns { agreed: string[], diverged: { field, values }[] }

// ============================================================
// Chooser / Model Routing
// ============================================================
// Efficiency score: W1*success_rate + W2*normCost + W3*normLatency + W4*(1-correction_rate)
// W1=0.35, W2=0.25, W3=0.15, W4=0.25

// ruleBasedRoute(params): hardcoded rules for model selection based on complexity/task_type/context_tokens
// getChooserRecommendation(db, params): if 50+ tasks exist for type/complexity, use data-driven; else rule-based

// ============================================================
// Human Tasks — KV
// ============================================================
const VALID_SOURCES = ["claude.ai", "cc", "iphone", "auto", "retroactive"];
// addTask(kv, params, waitUntil): validate, create ULID, put to KV, async classify
// listTasks(kv, params): list all task:* keys, filter by status/project, sort by ULID desc
// updateTask(kv, taskId, params): get, merge, put
// completeTask(kv, taskId): set status=done, completed_at=now
// retroactiveTask(kv, params, waitUntil): create as done, source=retroactive
// tasksToMarkdown(tasks): group by project, format as checkbox list

// ============================================================
// GitHub Operations
// ============================================================
// githubFetch(env, path, options): API call with PAT auth, rate limit handling
// readFile(env, params): GET /repos/:owner/:repo/contents/:path, decode base64
// writeFile(env, params): PUT /repos/:owner/:repo/contents/:path, encode base64
// createPR(env, params): POST /repos/:owner/:repo/pulls
// handleGitHubWebhook(request, env): verify HMAC, process push/PR events, store status in KV

// ============================================================
// Checkpoint & Decisions — D1
// ============================================================
// loadCheckpoint(db): SELECT latest from checkpoints table
// createCheckpoint(db, params): build recovery doc from open tasks + decisions, INSERT
// recordDecision(db, params): INSERT into decisions table
// buildRecoveryDoc(data): Mermaid stateDiagram format with emoji markers

// ============================================================
// Transcript Search — D1
// ============================================================
// handleTranscriptSearch: GET /search?q=&session=&limit= → LIKE query on transcripts table
// handleTranscriptIngest: POST /transcripts → bulk INSERT OR IGNORE

// ============================================================
// Execute Proxy
// ============================================================
// handleExecuteProxy: POST /execute → forward to env.EXECUTOR_URL/execute with X-Auth-Token
// normalizeResponse: extract mermaid, metrics from executor response

// ============================================================
// Auth
// ============================================================
// verifyBearerAuth(request, env): constant-time compare Bearer token against VAULT_AUTH_TOKEN
