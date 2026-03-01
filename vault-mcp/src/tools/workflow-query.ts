import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError, STRUCTURED_FIELDS } from "../utils";
import { getCircuitBreakerState } from "../logic/circuit-breaker";
import { computeConsensus } from "../logic/consensus";
import { getChooserRecommendation } from "../logic/chooser";

// ============================================================
// Query operations
// ============================================================
async function getTaskSummary(db: D1Database, taskId: string) {
  const task = await db.prepare(
    "SELECT id, task_type, complexity, language, stack, status, total_attempts, total_cost_usd, total_latency_ms, created_at, completed_at FROM tasks WHERE id = ?",
  ).bind(taskId).first();

  if (!task) return { error: "Task not found", task_id: taskId };

  const stages = await db.prepare(
    "SELECT stage_name, stage_type, model, cost_usd, latency_ms, created_at FROM stages WHERE task_id = ? ORDER BY created_at",
  ).bind(taskId).all();

  return {
    ...task,
    stages: stages.results ?? [],
  };
}

async function getConsensus(db: D1Database, taskId: string) {
  const stages = await db.prepare(
    "SELECT stage_name, stage_type, output FROM stages WHERE task_id = ? ORDER BY created_at",
  ).bind(taskId).all<{ stage_name: string; stage_type: string; output: string }>();

  const parsed = (stages.results ?? []).map((s) => ({
    stage_name: s.stage_name,
    stage_type: s.stage_type,
    output: typeof s.output === "string" ? JSON.parse(s.output) : s.output,
  }));

  return computeConsensus(taskId, parsed);
}

async function getSessionState(db: D1Database) {
  const [openTasks, recentClosed, cb] = await Promise.all([
    db.prepare("SELECT id, task_type, complexity, status, total_cost_usd, created_at FROM tasks WHERE status IN ('open', 'in_progress') ORDER BY created_at DESC").all(),
    db.prepare("SELECT id, task_type, complexity, status, total_cost_usd, completed_at FROM tasks WHERE status = 'closed' ORDER BY completed_at DESC LIMIT 5").all(),
    getCircuitBreakerState(db),
  ]);

  return {
    open_tasks: openTasks.results ?? [],
    recent_closed: recentClosed.results ?? [],
    circuit_breaker: cb,
  };
}

async function getStats(db: D1Database) {
  const [taskCounts, costByModel, modelPerf, cb, costByDay, costByType, recentTasks, leaderboard] = await Promise.all([
    db.prepare(
      "SELECT status, COUNT(*) as count, SUM(total_cost_usd) as total_cost FROM tasks GROUP BY status",
    ).all(),
    db.prepare(
      "SELECT model, COUNT(*) as count, SUM(cost_usd) as total_cost, AVG(cost_usd) as avg_cost FROM stages GROUP BY model ORDER BY total_cost DESC",
    ).all(),
    db.prepare(
      "SELECT model, task_type, complexity, total_tasks, first_attempt_success_rate, human_correction_rate, avg_cost_usd FROM model_stats ORDER BY total_tasks DESC LIMIT 20",
    ).all(),
    getCircuitBreakerState(db),
    db.prepare(
      "SELECT DATE(created_at) as day, SUM(cost_usd) as total_cost, COUNT(*) as stage_count FROM stages GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 30",
    ).all(),
    db.prepare(
      "SELECT task_type, COUNT(*) as count, SUM(total_cost_usd) as total_cost, AVG(total_cost_usd) as avg_cost FROM tasks GROUP BY task_type ORDER BY total_cost DESC",
    ).all(),
    db.prepare(
      "SELECT id, task_type, complexity, status, total_cost_usd, total_latency_ms, final_model, first_attempt_success, created_at, completed_at FROM tasks ORDER BY created_at DESC LIMIT 25",
    ).all(),
    db.prepare(
      `SELECT model,
              COUNT(*) as total_stages,
              SUM(cost_usd) as total_cost,
              AVG(cost_usd) as avg_cost,
              AVG(latency_ms) as avg_latency_ms,
              MIN(latency_ms) as min_latency_ms,
              MAX(latency_ms) as max_latency_ms
       FROM stages GROUP BY model ORDER BY total_stages DESC`,
    ).all(),
  ]);

  return {
    task_counts: taskCounts.results ?? [],
    cost_by_model: costByModel.results ?? [],
    cost_by_day: costByDay.results ?? [],
    cost_by_task_type: costByType.results ?? [],
    model_performance: modelPerf.results ?? [],
    leaderboard: leaderboard.results ?? [],
    recent_tasks: recentTasks.results ?? [],
    circuit_breaker: cb,
  };
}

async function readStage(db: D1Database, taskId: string, stageName: string) {
  const stage = await db.prepare(
    "SELECT * FROM stages WHERE task_id = ? AND stage_name = ?",
  ).bind(taskId, stageName).first();

  if (!stage) return { error: "Stage not found", task_id: taskId, stage_name: stageName };

  // Parse output JSON
  if (typeof stage.output === "string") {
    try {
      stage.output = JSON.parse(stage.output);
    } catch { /* keep as string */ }
  }
  return stage;
}

async function getProjection(db: D1Database, taskId: string, field: string) {
  const stages = await db.prepare(
    "SELECT stage_name, output FROM stages WHERE task_id = ? ORDER BY created_at",
  ).bind(taskId).all<{ stage_name: string; output: string }>();

  const results: Record<string, unknown[]> = {};
  for (const s of stages.results ?? []) {
    const output = typeof s.output === "string" ? JSON.parse(s.output) : s.output;
    if (output?.[field] && Array.isArray(output[field])) {
      results[s.stage_name] = output[field];
    }
  }

  // Merge all values
  const merged = [...new Set(Object.values(results).flat())];
  return { task_id: taskId, field, by_stage: results, merged };
}

// ============================================================
// Tool registration
// ============================================================
export function registerWorkflowQueryTool(server: McpServer, env: Env) {
  server.tool(
    "workflow_query",
    "Query workflow data. Queries: summary (task status), consensus (impl diff), state (session recovery), stats (dashboard), chooser (model recommendation), stage_read (single stage).",
    {
      query: z.enum(["summary", "consensus", "state", "stats", "chooser", "stage_read"]).describe("Query type"),
      task_id: z.string().optional().describe("Task ULID (summary/consensus/stage_read)"),
      stage_name: z.string().optional().describe("Stage name (stage_read)"),
      // chooser params
      task_type: z.string().optional().describe("Task type (chooser)"),
      complexity: z.string().optional().describe("Complexity (chooser)"),
      language: z.string().optional().describe("Language (chooser)"),
      stack: z.string().optional().describe("Stack (chooser)"),
      context_tokens: z.number().optional().describe("Context tokens (chooser)"),
      // projection
      field: z.string().optional().describe("Structured field name for projection"),
    },
    async (params) => {
      try {
        switch (params.query) {
          case "summary": {
            if (!params.task_id) return mcpError("summary requires: task_id");
            return mcpText(await getTaskSummary(env.VAULT_DB, params.task_id));
          }
          case "consensus": {
            if (!params.task_id) return mcpError("consensus requires: task_id");
            return mcpText(await getConsensus(env.VAULT_DB, params.task_id));
          }
          case "state": {
            return mcpText(await getSessionState(env.VAULT_DB));
          }
          case "stats": {
            return mcpText(await getStats(env.VAULT_DB));
          }
          case "chooser": {
            if (!params.task_type || !params.complexity) {
              return mcpError("chooser requires: task_type, complexity");
            }
            return mcpText(await getChooserRecommendation(env.VAULT_DB, {
              task_type: params.task_type,
              complexity: params.complexity,
              language: params.language,
              stack: params.stack,
              context_tokens: params.context_tokens,
            }));
          }
          case "stage_read": {
            if (!params.task_id || !params.stage_name) {
              return mcpError("stage_read requires: task_id, stage_name");
            }
            return mcpText(await readStage(env.VAULT_DB, params.task_id, params.stage_name));
          }
        }
      } catch (err) {
        return mcpError(`workflow_query.${params.query} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

// Export for REST routes
export { getTaskSummary, getConsensus, getSessionState, getStats, readStage, getProjection };
