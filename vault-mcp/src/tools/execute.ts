import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError, EXECUTOR_DEFAULT_URL } from "../utils";
import { getCircuitBreakerState } from "../logic/circuit-breaker";
import { createTask, writeStage } from "../logic/workflow-db";
import { shouldEscalate, getNextRung, MODEL_LADDER, MAX_ATTEMPTS, MAX_TOTAL_ATTEMPTS } from "../logic/escalation";
import { classifyTask } from "../logic/classify";

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
    gemini: { input: 2.0, output: 12.0 },
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
    gemini: "gemini-3.1-pro-preview",
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
  task_id?: string;
  max_attempts?: number;
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
      max_attempts: z.number().optional().describe("Max sequential attempts before consensus (default 3)"),
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

        // 3. Escalation retry loop
        const maxAttempts = params.max_attempts ?? MAX_ATTEMPTS;
        let currentExecutor: string = params.executor ?? "claude";
        let currentModel: string = params.model ?? inferDefaultModel(currentExecutor);
        const attempts: Array<{ executor: string; model: string; stage_type: string; error?: string; latency_ms: number }> = [];

        for (let attempt = 1; attempt <= MAX_TOTAL_ATTEMPTS; attempt++) {
          // Re-check circuit breaker before retry attempts
          if (attempt > 1) {
            const cb2 = await getCircuitBreakerState(env.VAULT_DB);
            if (cb2.halted) {
              return mcpError(JSON.stringify({
                error: "CIRCUIT_BREAKER_HALTED",
                task_id: taskId,
                attempts,
              }));
            }
          }

          const attemptStart = Date.now();
          const result = await proxyToExecutor(env, {
            ...params,
            repo: params.repo ?? "oosman/infrastructure",
            executor: currentExecutor,
            model: currentModel,
            task_id: taskId,
          });
          const attemptLatency = Date.now() - attemptStart;

          if ("error" in result && typeof result.error === "string") {
            // Log error stage
            const metrics = result.metrics as Record<string, unknown> | undefined;
            const errorType = (result.error_type as string) ?? "unknown";

            await writeStage(env.VAULT_DB, taskId, {
              stage_name: `impl-${currentExecutor}-attempt-${attempt}`,
              stage_type: "error",
              model: currentModel,
              output: result as Record<string, unknown>,
              tokens_input: (metrics?.input_tokens as number) ?? 0,
              tokens_output: (metrics?.output_tokens as number) ?? 0,
              cost_usd: estimateCost(metrics, currentExecutor),
              latency_ms: attemptLatency,
            });

            attempts.push({ executor: currentExecutor, model: currentModel, stage_type: "error", error: errorType, latency_ms: attemptLatency });

            // Should we escalate?
            if (!shouldEscalate(errorType)) {
              return mcpError(JSON.stringify({
                error: result.error,
                error_type: errorType,
                task_id: taskId,
                attempts,
                escalation: "not_escalatable",
              }));
            }

            // Have we exhausted sequential attempts?
            if (attempt >= maxAttempts) {
              // Try consensus if not already
              if (currentExecutor !== "consensus") {
                const consensusRung = MODEL_LADDER.find(r => r.executor === "consensus");
                if (consensusRung) {
                  currentExecutor = "consensus";
                  currentModel = "consensus";
                  continue;
                }
              }

              // All options exhausted → flag for human
              return mcpError(JSON.stringify({
                error: "ESCALATION_EXHAUSTED",
                task_id: taskId,
                attempts,
                escalation: "human_required",
                message: `Failed after ${attempt} attempts. Flagging for human review.`,
              }));
            }

            // Get next rung in ladder
            const nextRung = getNextRung(currentExecutor, currentModel);
            if (!nextRung) {
              return mcpError(JSON.stringify({
                error: "ESCALATION_EXHAUSTED",
                task_id: taskId,
                attempts,
                escalation: "ladder_exhausted",
              }));
            }

            currentExecutor = nextRung.executor;
            currentModel = nextRung.model;
            continue;
          }

          // SUCCESS — log stage and return
          const metrics = result.metrics as Record<string, unknown> | undefined;
          const stageResult = await writeStage(env.VAULT_DB, taskId, {
            stage_name: `impl-${currentExecutor}-attempt-${attempt}`,
            stage_type: "impl",
            model: currentModel,
            output: result as Record<string, unknown>,
            tokens_input: (metrics?.input_tokens as number) ?? 0,
            tokens_output: (metrics?.output_tokens as number) ?? 0,
            cost_usd: estimateCost(metrics, currentExecutor),
            latency_ms: attemptLatency,
          });

          attempts.push({ executor: currentExecutor, model: currentModel, stage_type: "impl", latency_ms: attemptLatency });

          // Fire-and-forget classification via AI Gateway (Haiku)
          if (env.__waitUntil) {
            env.__waitUntil(classifyTask(env, taskId, params.instruction, result));
          }

          return mcpText({
            task_id: taskId,
            mermaid: result.mermaid ?? null,
            metrics: result.metrics ?? null,
            stage: stageResult,
            attempts,
            escalated: attempt > 1,
          });
        }

        // Safety fallback — should never reach here
        return mcpError(JSON.stringify({
          error: "MAX_ATTEMPTS_EXCEEDED",
          task_id: taskId,
          attempts,
        }));
      } catch (err) {
        return mcpError(`execute failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

// Export for REST routes
export { proxyToExecutor };
