import type { Env } from "../env";
import { json, errorResponse, ulid, now, STRUCTURED_FIELDS } from "../utils";
import { getCircuitBreakerState, incrementCircuitBreaker } from "../logic/circuit-breaker";
import { computeConsensus } from "../logic/consensus";
import { getChooserRecommendation } from "../logic/chooser";
import { getTaskSummary, getConsensus, getSessionState, getStats, readStage, getProjection } from "../tools/workflow-query";

export async function handleWorkflowRoutes(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /workflow/init
  if (path === "/workflow/init" && method === "POST") {
    const body = await request.json() as Record<string, unknown>;
    const { task_type, complexity, language, stack, domain, scope, is_greenfield, has_tests, description } = body;

    if (!task_type || !complexity || !language || !stack) {
      return errorResponse("Required: task_type, complexity, language, stack");
    }

    const cb = await getCircuitBreakerState(env.VAULT_DB);
    if (cb.halted) {
      return json({ error: "CIRCUIT_BREAKER_HALTED", message: cb.message }, 429);
    }

    const id = ulid();
    const ts = now();
    await env.VAULT_DB.prepare(
      `INSERT INTO tasks (id, task_type, complexity, language, stack, domain, scope, is_greenfield, has_tests, description, status, total_attempts, total_cost_usd, total_latency_ms, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, 0, 0, ?, ?)`,
    ).bind(
      id, task_type, complexity, language, stack,
      (domain as string) ?? null, (scope as string) ?? null,
      is_greenfield ? 1 : 0, has_tests ? 1 : 0,
      (description as string) ?? null, ts, ts,
    ).run();

    return json({ id, status: "open", task_type, complexity, language, stack, created_at: ts });
  }

  // Match /workflow/:id/* routes
  const idMatch = path.match(/^\/workflow\/([A-Z0-9]{26})\/?(.*)$/);
  if (idMatch) {
    const taskId = idMatch[1];
    const sub = idMatch[2];

    // POST /workflow/:id/spec
    if (sub === "spec" && method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      if (!body.spec) return errorResponse("Required: spec");
      const ts = now();
      await env.VAULT_DB.prepare(
        "UPDATE tasks SET spec = ?, status = 'in_progress', updated_at = ? WHERE id = ?",
      ).bind(body.spec, ts, taskId).run();
      return json({ task_id: taskId, status: "in_progress" });
    }

    // POST /workflow/:id/stage
    if (sub === "stage" && method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      if (!body.stage_name || !body.stage_type) return errorResponse("Required: stage_name, stage_type");
      const stageId = ulid();
      const ts = now();
      const costUsd = (body.cost_usd as number) ?? 0;

      await env.VAULT_DB.prepare(
        `INSERT INTO stages (id, task_id, stage_name, stage_type, model, output, tokens_input, tokens_output, cost_usd, latency_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        stageId, taskId, body.stage_name, body.stage_type,
        (body.model as string) ?? null, JSON.stringify(body.output ?? {}),
        (body.tokens_input as number) ?? 0, (body.tokens_output as number) ?? 0,
        costUsd, (body.latency_ms as number) ?? 0, ts,
      ).run();

      await env.VAULT_DB.prepare(
        "UPDATE tasks SET total_attempts = total_attempts + 1, total_cost_usd = total_cost_usd + ?, total_latency_ms = total_latency_ms + ?, updated_at = ? WHERE id = ?",
      ).bind(costUsd, (body.latency_ms as number) ?? 0, ts, taskId).run();

      if (costUsd > 0) await incrementCircuitBreaker(env.VAULT_DB, costUsd);

      return json({ stage_id: stageId, task_id: taskId });
    }

    // GET /workflow/:id/summary
    if (sub === "summary" && method === "GET") {
      return json(await getTaskSummary(env.VAULT_DB, taskId));
    }

    // POST /workflow/:id/close
    if (sub === "close" && method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      const ts = now();
      await env.VAULT_DB.prepare(
        `UPDATE tasks SET status = 'closed', final_model = ?, first_attempt_success = ?, human_correction_needed = ?,
         quality_score = ?, consensus_type = ?, consensus_result = ?, models_used = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
      ).bind(
        (body.final_model as string) ?? null,
        body.first_attempt_success ? 1 : 0,
        body.human_correction_needed ? 1 : 0,
        (body.quality_score as number) ?? null,
        (body.consensus_type as string) ?? null,
        (body.consensus_result as string) ?? null,
        body.models_used ? JSON.stringify(body.models_used) : null,
        ts, ts, taskId,
      ).run();
      return json({ task_id: taskId, status: "closed", completed_at: ts });
    }

    // GET /workflow/:id/consensus
    if (sub === "consensus" && method === "GET") {
      return json(await getConsensus(env.VAULT_DB, taskId));
    }

    // GET /workflow/:id/stage/:name
    const stageMatch = sub.match(/^stage\/(.+)$/);
    if (stageMatch && method === "GET") {
      return json(await readStage(env.VAULT_DB, taskId, stageMatch[1]));
    }

    // GET /workflow/:id/{projection-fields}
    const projectionField = sub.replace(/-/g, "_");
    if (STRUCTURED_FIELDS.includes(projectionField as typeof STRUCTURED_FIELDS[number]) && method === "GET") {
      return json(await getProjection(env.VAULT_DB, taskId, projectionField));
    }

    return errorResponse("Unknown workflow sub-route", 404);
  }

  // GET /workflow/state/current
  if (path === "/workflow/state/current" && method === "GET") {
    return json(await getSessionState(env.VAULT_DB));
  }

  // GET /workflow/stats
  if (path === "/workflow/stats" && method === "GET") {
    return json(await getStats(env.VAULT_DB));
  }

  // GET /workflow/chooser
  if (path === "/workflow/chooser" && method === "GET") {
    const taskType = url.searchParams.get("task_type");
    const complexity = url.searchParams.get("complexity");
    if (!taskType || !complexity) return errorResponse("Required: task_type, complexity");
    return json(await getChooserRecommendation(env.VAULT_DB, {
      task_type: taskType,
      complexity,
      language: url.searchParams.get("language") ?? undefined,
      stack: url.searchParams.get("stack") ?? undefined,
      context_tokens: url.searchParams.has("context_tokens") ? parseInt(url.searchParams.get("context_tokens")!) : undefined,
    }));
  }

  return errorResponse("Not found", 404);
}
