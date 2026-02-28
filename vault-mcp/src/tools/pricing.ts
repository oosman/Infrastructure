import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError } from "../utils";
import { getChooserRecommendation, ruleBasedRoute } from "../logic/chooser";

const MODEL_PRICING: Record<string, { input_per_1m: number; output_per_1m: number }> = {
  "claude-opus-4-20250514": { input_per_1m: 15.0, output_per_1m: 75.0 },
  "claude-sonnet-4-20250514": { input_per_1m: 3.0, output_per_1m: 15.0 },
  "claude-haiku-4-5-20251001": { input_per_1m: 0.80, output_per_1m: 4.0 },
  "gpt-4o": { input_per_1m: 2.50, output_per_1m: 10.0 },
  "o3": { input_per_1m: 10.0, output_per_1m: 40.0 },
  "gemini-2.5-pro": { input_per_1m: 1.25, output_per_1m: 10.0 },
};

export function registerPricingTool(server: McpServer, env: Env) {
  server.tool(
    "pricing",
    "Model pricing and recommendation. Returns pricing table and optional task-based recommendation.",
    {
      task_type: z.string().optional().describe("Task type for recommendation"),
      complexity: z.string().optional().describe("Complexity for recommendation"),
      language: z.string().optional().describe("Language for recommendation"),
      stack: z.string().optional().describe("Stack for recommendation"),
      context_tokens: z.number().optional().describe("Context tokens for recommendation"),
    },
    async (params) => {
      try {
        const result: Record<string, unknown> = { pricing: MODEL_PRICING };

        if (params.task_type && params.complexity) {
          result.recommendation = await getChooserRecommendation(env.VAULT_DB, {
            task_type: params.task_type,
            complexity: params.complexity,
            language: params.language,
            stack: params.stack,
            context_tokens: params.context_tokens,
          });
        }

        return mcpText(result);
      } catch (err) {
        return mcpError(`pricing failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
