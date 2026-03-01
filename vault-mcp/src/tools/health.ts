import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError, now, EXECUTOR_DEFAULT_URL } from "../utils";

export async function checkHealth(env: Env) {
  const checks: Record<string, unknown> = {
    status: "ok",
    version: "2.0.0",
    timestamp: now(),
  };

  // D1 connectivity
  try {
    await env.VAULT_DB.prepare("SELECT 1").first();
    checks.d1 = "connected";
  } catch (err) {
    checks.d1 = `error: ${err instanceof Error ? err.message : String(err)}`;
    checks.status = "degraded";
  }

  // KV connectivity
  try {
    await env.TASKS_KV.list({ prefix: "health:", limit: 1 });
    checks.kv = "connected";
  } catch (err) {
    checks.kv = `error: ${err instanceof Error ? err.message : String(err)}`;
    checks.status = "degraded";
  }

  // Executor reachability
  try {
    const url = env.EXECUTOR_URL ?? EXECUTOR_DEFAULT_URL;
    const resp = await fetch(`${url}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    checks.executor = resp.ok ? "reachable" : `status ${resp.status}`;
  } catch (err) {
    checks.executor = `unreachable: ${err instanceof Error ? err.message : String(err)}`;
  }

  return checks;
}

export function registerHealthTool(server: McpServer, env: Env) {
  server.tool(
    "health",
    "System health status. Checks D1, KV, and executor connectivity.",
    {},
    async () => {
      try {
        return mcpText(await checkHealth(env));
      } catch (err) {
        return mcpError(`health check failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
