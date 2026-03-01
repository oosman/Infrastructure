import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { now, mcpText, mcpError } from "../utils";

/**
 * session_start — compound tool replacing /bismillah protocol.
 * One call does: canary health check + checkpoint load + recent tasks + orientation payload.
 * No mac-mcp dependency. Works from any Claude.ai session, phone, etc.
 */
export function registerSessionStartTool(server: McpServer, env: Env) {
  server.tool(
    "session_start",
    "Initialize a session. Performs canary health check, loads latest checkpoint, gathers recent tasks and decisions. Returns everything needed to orient in one call. Use when user says /bismillah, 'session start', or begins a new working session.",
    {
      project: z.string().optional().describe("Project name filter (optional)"),
    },
    async (params) => {
      try {
        const db = env.VAULT_DB;
        const results: Record<string, unknown> = {};

        // 1. Canary: D1 health
        const canary = await db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'open'").first();
        results.vault_healthy = true;
        results.open_tasks_count = canary?.count ?? 0;

        // 2. Checkpoint load
        const checkpoint = await db.prepare(
          "SELECT id, content, trigger_signals, created_at FROM checkpoints ORDER BY created_at DESC LIMIT 1"
        ).first();
        if (checkpoint) {
          results.checkpoint = {
            id: checkpoint.id,
            content: checkpoint.content,
            created_at: checkpoint.created_at,
            signals: checkpoint.trigger_signals,
          };
        } else {
          results.checkpoint = null;
        }

        // 3. Recent open tasks (last 10)
        const tasks = await db.prepare(
          "SELECT id, title, project, status, context FROM tasks WHERE status = 'open' ORDER BY created_at DESC LIMIT 10"
        ).all();
        results.recent_tasks = tasks.results ?? [];

        // 4. Recent decisions (last 5)
        const decisions = await db.prepare(
          "SELECT decision, rationale, created_at FROM decisions ORDER BY created_at DESC LIMIT 5"
        ).all();
        results.recent_decisions = decisions.results ?? [];

        // 5. Workflow stats summary
        const stats = await db.prepare(
          "SELECT COUNT(*) as total, SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM tasks"
        ).first();
        results.task_stats = stats;

        // 6. Timestamp
        results.session_started_at = now();

        return mcpText(results);
      } catch (err) {
        return mcpError(`session_start failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
