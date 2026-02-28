import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError, EXECUTOR_DEFAULT_URL } from "../utils";

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
      try {
        const result = await proxyToExecutor(env, params);
        return mcpText(result);
      } catch (err) {
        return mcpError(`execute failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

// Export for REST routes
export { proxyToExecutor };
