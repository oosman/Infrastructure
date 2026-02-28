import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError, now } from "../utils";

async function exportData(env: Env) {
  // Export KV tasks
  const kvKeys = await env.TASKS_KV.list({ prefix: "task:" });
  const tasks: Record<string, unknown>[] = [];
  for (const key of kvKeys.keys) {
    const val = await env.TASKS_KV.get(key.name);
    if (val) tasks.push(JSON.parse(val));
  }

  // Export D1 tables
  const [d1Tasks, stages, checkpoints, decisions, modelStats, circuitBreaker] = await Promise.all([
    env.VAULT_DB.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all(),
    env.VAULT_DB.prepare("SELECT * FROM stages ORDER BY created_at DESC").all(),
    env.VAULT_DB.prepare("SELECT * FROM checkpoints ORDER BY created_at DESC LIMIT 10").all(),
    env.VAULT_DB.prepare("SELECT * FROM decisions ORDER BY created_at DESC").all(),
    env.VAULT_DB.prepare("SELECT * FROM model_stats ORDER BY total_tasks DESC").all(),
    env.VAULT_DB.prepare("SELECT * FROM circuit_breaker").all(),
  ]);

  return {
    exported_at: now(),
    kv_tasks: {
      count: tasks.length,
      data: tasks,
    },
    d1: {
      tasks: { count: d1Tasks.results?.length ?? 0, data: d1Tasks.results ?? [] },
      stages: { count: stages.results?.length ?? 0, data: stages.results ?? [] },
      checkpoints: { count: checkpoints.results?.length ?? 0, data: checkpoints.results ?? [] },
      decisions: { count: decisions.results?.length ?? 0, data: decisions.results ?? [] },
      model_stats: { count: modelStats.results?.length ?? 0, data: modelStats.results ?? [] },
      circuit_breaker: { count: circuitBreaker.results?.length ?? 0, data: circuitBreaker.results ?? [] },
    },
  };
}

export function registerBackupTool(server: McpServer, env: Env) {
  server.tool(
    "backup",
    "Export all KV tasks and D1 data as JSON backup.",
    {},
    async () => {
      try {
        return mcpText(await exportData(env));
      } catch (err) {
        return mcpError(`backup failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
