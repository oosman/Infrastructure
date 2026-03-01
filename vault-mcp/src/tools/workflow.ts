import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { now, mcpText, mcpError } from "../utils";
import { createTask, writeStage } from "../logic/workflow-db";
import { createCheckpoint } from "./checkpoint";

// ============================================================
// D1 operations (local to workflow tool)
// ============================================================
async function writeSpec(db: D1Database, taskId: string, spec: string) {
  const ts = now();
  const result = await db.prepare(
    `UPDATE tasks SET spec = ?, status = 'in_progress', updated_at = ? WHERE id = ?`,
  ).bind(spec, ts, taskId).run();

  if (!result.meta.changes) {
    return { error: "Task not found", task_id: taskId };
  }
  return { task_id: taskId, status: "in_progress", spec_length: spec.length };
}

async function closeTask(db: D1Database, taskId: string, params: {
  final_model?: string;
  first_attempt_success?: boolean;
  human_correction_needed?: boolean;
  quality_score?: number;
  consensus_type?: string;
  consensus_result?: string;
  models_used?: string[];
}) {
  const ts = now();
  const result = await db.prepare(
    `UPDATE tasks SET status = 'closed',
     final_model = ?, first_attempt_success = ?, human_correction_needed = ?,
     quality_score = ?, consensus_type = ?, consensus_result = ?,
     models_used = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(
    params.final_model ?? null,
    params.first_attempt_success ? 1 : 0,
    params.human_correction_needed ? 1 : 0,
    params.quality_score ?? null,
    params.consensus_type ?? null,
    params.consensus_result ?? null,
    params.models_used ? JSON.stringify(params.models_used) : null,
    ts, ts, taskId,
  ).run();

  if (!result.meta.changes) {
    return { error: "Task not found", task_id: taskId };
  }

  // Update model stats
  const task = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(taskId).first<Record<string, unknown>>();
  if (task) {
    await updateModelStats(db, task);
  }

  return { task_id: taskId, status: "closed", completed_at: ts };
}

async function updateModelStats(db: D1Database, task: Record<string, unknown>) {
  const model = task.final_model as string;
  const taskType = task.task_type as string;
  const complexity = task.complexity as string;
  const language = task.language as string;

  if (!model) return;

  const statsId = `${model}:${taskType}:${complexity}`;
  const ts = now();
  const costUsd = (task.total_cost_usd as number) ?? 0;
  const latencyMs = (task.total_latency_ms as number) ?? 0;
  const success = task.first_attempt_success ? 1 : 0;
  const correction = task.human_correction_needed ? 1 : 0;

  // UPSERT with weighted average
  const existing = await db.prepare(
    "SELECT total_tasks, avg_cost_usd, avg_latency_ms, first_attempt_success_rate, human_correction_rate FROM model_stats WHERE id = ?",
  ).bind(statsId).first<{
    total_tasks: number;
    avg_cost_usd: number;
    avg_latency_ms: number;
    first_attempt_success_rate: number;
    human_correction_rate: number;
  }>();

  if (existing) {
    const n = existing.total_tasks;
    const newN = n + 1;
    const newAvgCost = (existing.avg_cost_usd * n + costUsd) / newN;
    const newAvgLatency = (existing.avg_latency_ms * n + latencyMs) / newN;
    const newSuccessRate = (existing.first_attempt_success_rate * n + success) / newN;
    const newCorrectionRate = (existing.human_correction_rate * n + correction) / newN;

    await db.prepare(
      `UPDATE model_stats SET
       total_tasks = ?, successes = successes + ?, failures = failures + ?,
       avg_cost_usd = ?, avg_latency_ms = ?,
       first_attempt_success_rate = ?, human_correction_rate = ?,
       updated_at = ?
       WHERE id = ?`,
    ).bind(
      newN, success, 1 - success,
      newAvgCost, newAvgLatency,
      newSuccessRate, newCorrectionRate,
      ts, statsId,
    ).run();
  } else {
    await db.prepare(
      `INSERT INTO model_stats (id, model, task_type, complexity, language, total_tasks, successes, failures, avg_cost_usd, avg_latency_ms, first_attempt_success_rate, human_correction_rate, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      statsId, model, taskType, complexity, language ?? null,
      success, 1 - success, costUsd, latencyMs,
      success, correction, ts,
    ).run();
  }
}

// ============================================================
// Tool registration
// ============================================================
export function registerWorkflowTool(server: McpServer, env: Env) {
  server.tool(
    "workflow",
    "Workflow lifecycle management. Actions: init (create task), spec (write specification), write (write stage output), close (finalize task).",
    {
      action: z.enum(["init", "spec", "write", "close"]).describe("Lifecycle action"),
      task_id: z.string().optional().describe("Task ULID (required for spec/write/close)"),
      // init params
      task_type: z.enum(["fix", "feature", "test", "refactor", "review", "docs"]).optional().describe("Task type (init)"),
      complexity: z.enum(["trivial", "simple", "moderate", "complex"]).optional().describe("Complexity (init)"),
      language: z.string().optional().describe("Primary language (init)"),
      stack: z.string().optional().describe("Tech stack (init)"),
      domain: z.string().optional().describe("Domain area (init)"),
      scope: z.string().optional().describe("Scope description (init)"),
      is_greenfield: z.boolean().optional().describe("Is greenfield project (init)"),
      has_tests: z.boolean().optional().describe("Has existing tests (init)"),
      description: z.string().optional().describe("Task description (init)"),
      // spec params
      spec: z.string().optional().describe("Specification text (spec)"),
      // write params
      stage_name: z.string().optional().describe("Stage name (write)"),
      stage_type: z.string().optional().describe("Stage type: impl, review, test (write)"),
      model: z.string().optional().describe("Model used (write)"),
      output: z.record(z.unknown()).optional().describe("Stage output with structured fields (write)"),
      tokens_input: z.number().optional().describe("Input tokens (write)"),
      tokens_output: z.number().optional().describe("Output tokens (write)"),
      cost_usd: z.number().optional().describe("Cost in USD (write)"),
      latency_ms: z.number().optional().describe("Latency in ms (write)"),
      // close params
      final_model: z.string().optional().describe("Final model used (close)"),
      first_attempt_success: z.boolean().optional().describe("First attempt succeeded (close)"),
      human_correction_needed: z.boolean().optional().describe("Human correction needed (close)"),
      quality_score: z.number().optional().describe("Quality score 0-1 (close)"),
      consensus_type: z.string().optional().describe("Consensus type (close)"),
      consensus_result: z.string().optional().describe("Consensus result (close)"),
      models_used: z.array(z.string()).optional().describe("Models used (close)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "init": {
            if (!params.task_type || !params.complexity || !params.language || !params.stack) {
              return mcpError("init requires: task_type, complexity, language, stack");
            }
            const result = await createTask(env.VAULT_DB, {
              task_type: params.task_type,
              complexity: params.complexity,
              language: params.language,
              stack: params.stack,
              domain: params.domain,
              scope: params.scope,
              is_greenfield: params.is_greenfield,
              has_tests: params.has_tests,
              description: params.description,
            });
            return mcpText(result);
          }
          case "spec": {
            if (!params.task_id || !params.spec) {
              return mcpError("spec requires: task_id, spec");
            }
            return mcpText(await writeSpec(env.VAULT_DB, params.task_id, params.spec));
          }
          case "write": {
            if (!params.task_id || !params.stage_name || !params.stage_type) {
              return mcpError("write requires: task_id, stage_name, stage_type");
            }
            return mcpText(await writeStage(env.VAULT_DB, params.task_id, {
              stage_name: params.stage_name,
              stage_type: params.stage_type,
              model: params.model,
              output: params.output as Record<string, unknown>,
              tokens_input: params.tokens_input,
              tokens_output: params.tokens_output,
              cost_usd: params.cost_usd,
              latency_ms: params.latency_ms,
            }));
          }
          case "close": {
            if (!params.task_id) {
              return mcpError("close requires: task_id");
            }
            const closeResult = await closeTask(env.VAULT_DB, params.task_id, {
              final_model: params.final_model,
              first_attempt_success: params.first_attempt_success,
              human_correction_needed: params.human_correction_needed,
              quality_score: params.quality_score,
              consensus_type: params.consensus_type,
              consensus_result: params.consensus_result,
              models_used: params.models_used,
            });
            // Auto-checkpoint on successful close
            if (!closeResult.error) {
              await createCheckpoint(env.VAULT_DB, {
                objective: `Workflow closed: ${params.task_id}`,
                recent_actions: ["workflow close completed"],
              }).catch(() => {}); // fire-and-forget, don't fail the close
            }
            return mcpText(closeResult);
          }
        }
      } catch (err) {
        return mcpError(`workflow.${params.action} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
