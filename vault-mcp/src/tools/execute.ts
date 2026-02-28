import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError, EXECUTOR_DEFAULT_URL } from "../utils";
import { getCircuitBreakerState } from "../logic/circuit-breaker";
import { createTask, writeStage } from "../logic/workflow-db";

// ============================================================
// Cost estimation
// ============================================================
function estimateCost(metrics: any, executor?: string): number {
  const input = metrics?.input_tokens ?? 0;
  const output = metrics?.output_tokens ?? 0;
  // Rough per-1M-token rates
  const rates: Record<string, { input: number; output: number }> = {
    claude: { input: 3.0, output: 15.0 },
    codex: { input: 2.5, output: 10.0 },
    gemini: { input: 1.25, output: 5.0 },
  };
  const r = rates[executor ?? "claude"] ?? rates.claude;
  return (input * r.input + output * r.output) / 1_000_000;
}

// ============================================================
// Default model inference
// ============================================================
function inferDefaultModel(executor?: string): string {
  const defaults: Record<string, string> = {
    claude: "claude-sonnet-4-5-20250929",
    codex: "gpt-5.3-codex",
    gemini: "gemini-2.5-pro",
    consensus: "consensus",
  };
  return defaults[executor ?? "claude"] ?? "unknown";
}

// ============================================================
// Executor proxy
// ============================================================
async function proxyToExecutor(env: Env, params: {
  instruction: string;
  executor?: string;
  model?: string;
  repo?: string;
  task_type?: string;
  complexity?: string;
  language?: string;
  stack?: string;
  verbosity?: string;
}) {
  const url = env.EXECUTOR_URL ?? EXECUTOR_DEFAULT_URL;

  const response = await fetch(`${url}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": env.EXECUTOR_SECRET,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text();
    return { error: `Executor returned ${response.status}`, detail: text };
  }

  const result = (await response.json()) as Record<string, unknown>;
  return normalizeExecutorResponse(result);
}

function normalizeExecutorResponse(result: Record<string, unknown>) {
  // Extract mermaid diagrams and metrics if present
  const output: Record<string, unknown> = { ...result };

  if (typeof result.output === "string") {
    const mermaidMatch = (result.output as string).match(/```mermaid\n([\s\S]*?)```/);
    if (mermaidMatch) {
      output.mermaid = mermaidMatch[1].trim();
    }
  }

  return output;
}

// ============================================================
// Tool registration
// ============================================================
export function registerExecuteTool(server: McpServer, env: Env) {
  server.tool(
    "execute",
    "Execute task on remote VM via executor proxy. Supports claude, codex, gemini, and consensus executors.",
    {
      instruction: z.string().describe("Task instruction for the executor"),
      executor: z.enum(["claude", "codex", "gemini", "consensus"]).optional().describe("Which executor to use"),
      model: z.string().optional().describe("Model override"),
      repo: z.string().optional().describe("GitHub repo (owner/name)"),
      task_type: z.string().optional().describe("Task type for routing"),
      complexity: z.string().optional().describe("Task complexity"),
      language: z.string().optional().describe("Primary language"),
      stack: z.string().optional().describe("Tech stack"),
      verbosity: z.string().optional().describe("Output verbosity"),
    },
    async (params) => {
      const startTime = Date.now();

      try {
        // 1. Check circuit breaker
        const cb = await getCircuitBreakerState(env.VAULT_DB);
        if (cb.halted) {
          return mcpError(`CIRCUIT_BREAKER_HALTED: ${cb.message}`);
        }

        // 2. Create workflow task in D1
        const task = await createTask(env.VAULT_DB, {
          task_type: params.task_type ?? "feature",
          complexity: params.complexity ?? "simple",
          language: params.language ?? "typescript",
          stack: params.stack ?? "node",
          description: params.instruction.slice(0, 500),
        });

        if ("error" in task) {
          return mcpError(`Failed to create task: ${task.error}`);
        }

        const taskId = task.id;

        // 3. Proxy to executor (existing logic)
        const result = await proxyToExecutor(env, params);
        const latencyMs = Date.now() - startTime;

        // 4. Check for executor error
        if ("error" in result && typeof result.error === "string") {
          const metrics = result.metrics as Record<string, unknown> | undefined;
          const model = params.model ?? inferDefaultModel(params.executor);

          await writeStage(env.VAULT_DB, taskId, {
            stage_name: `impl-${params.executor ?? "claude"}`,
            stage_type: "error",
            model,
            output: result as Record<string, unknown>,
            tokens_input: (metrics?.input_tokens as number) ?? 0,
            tokens_output: (metrics?.output_tokens as number) ?? 0,
            cost_usd: estimateCost(metrics, params.executor),
            latency_ms: latencyMs,
          });

          return mcpError(JSON.stringify({
            error: result.error,
            error_type: result.error_type ?? "executor_error",
            task_id: taskId,
          }));
        }

        // 5. Log success stage to D1
        const metrics = result.metrics as Record<string, unknown> | undefined;
        const model = params.model ?? inferDefaultModel(params.executor);

        const stageResult = await writeStage(env.VAULT_DB, taskId, {
          stage_name: `impl-${params.executor ?? "claude"}`,
          stage_type: "impl",
          model,
          output: result as Record<string, unknown>,
          tokens_input: (metrics?.input_tokens as number) ?? 0,
          tokens_output: (metrics?.output_tokens as number) ?? 0,
          cost_usd: estimateCost(metrics, params.executor),
          latency_ms: latencyMs,
        });

        // 6. Return task_id + executor result
        return mcpText({
          task_id: taskId,
          mermaid: result.mermaid ?? null,
          metrics: result.metrics ?? null,
          stage: stageResult,
        });
      } catch (err) {
        return mcpError(`execute failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

// Export for REST routes
export { proxyToExecutor };
