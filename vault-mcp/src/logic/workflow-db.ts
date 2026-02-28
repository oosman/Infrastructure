import { ulid, now } from "../utils";
import { getCircuitBreakerState, incrementCircuitBreaker } from "./circuit-breaker";

export async function createTask(db: D1Database, params: {
  task_type: string;
  complexity: string;
  language: string;
  stack: string;
  domain?: string;
  scope?: string;
  is_greenfield?: boolean;
  has_tests?: boolean;
  description?: string;
}) {
  // Check circuit breaker
  const cb = await getCircuitBreakerState(db);
  if (cb.halted) {
    return { error: "CIRCUIT_BREAKER_HALTED", message: cb.message };
  }

  const id = ulid();
  const ts = now();
  await db.prepare(
    `INSERT INTO tasks (id, task_type, complexity, language, stack, domain, scope, is_greenfield, has_tests, description, status, total_attempts, total_cost_usd, total_latency_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, 0, 0, ?, ?)`,
  ).bind(
    id, params.task_type, params.complexity, params.language, params.stack,
    params.domain ?? null, params.scope ?? null, params.is_greenfield ? 1 : 0,
    params.has_tests ? 1 : 0, params.description ?? null, ts, ts,
  ).run();

  return {
    id,
    status: "open",
    task_type: params.task_type,
    complexity: params.complexity,
    language: params.language,
    stack: params.stack,
    created_at: ts,
    circuit_breaker: cb.alert ? { alert: true, message: cb.message } : undefined,
  };
}

export async function writeStage(db: D1Database, taskId: string, params: {
  stage_name: string;
  stage_type: string;
  model?: string;
  output?: Record<string, unknown>;
  tokens_input?: number;
  tokens_output?: number;
  cost_usd?: number;
  latency_ms?: number;
}) {
  const id = ulid();
  const ts = now();
  const costUsd = params.cost_usd ?? 0;

  await db.prepare(
    `INSERT INTO stages (id, task_id, stage_name, stage_type, model, output, tokens_input, tokens_output, cost_usd, latency_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, taskId, params.stage_name, params.stage_type,
    params.model ?? null, JSON.stringify(params.output ?? {}),
    params.tokens_input ?? 0, params.tokens_output ?? 0,
    costUsd, params.latency_ms ?? 0, ts,
  ).run();

  // Update task totals
  await db.prepare(
    `UPDATE tasks SET total_attempts = total_attempts + 1,
     total_cost_usd = total_cost_usd + ?,
     total_latency_ms = total_latency_ms + ?,
     updated_at = ?
     WHERE id = ?`,
  ).bind(costUsd, params.latency_ms ?? 0, ts, taskId).run();

  // Increment circuit breaker
  if (costUsd > 0) {
    await incrementCircuitBreaker(db, costUsd);
  }

  // Task-level cost alerts
  const task = await db.prepare("SELECT total_cost_usd FROM tasks WHERE id = ?").bind(taskId).first<{ total_cost_usd: number }>();
  const totalCost = task?.total_cost_usd ?? 0;
  let costAlert: string | undefined;
  if (totalCost > 5) {
    costAlert = `HALT: Task cost $${totalCost.toFixed(2)} exceeds $5 limit`;
  } else if (totalCost > 2) {
    costAlert = `WARNING: Task cost $${totalCost.toFixed(2)} approaching $5 limit`;
  }

  return {
    stage_id: id,
    task_id: taskId,
    stage_name: params.stage_name,
    cost_usd: costUsd,
    task_total_cost_usd: totalCost,
    cost_alert: costAlert,
  };
}
