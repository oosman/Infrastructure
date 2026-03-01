import type { Env } from "../env";
import { AI_GATEWAY_URL } from "../env";

// ============================================================
// Post-execution classification via AI Gateway → Haiku
// Best-effort: failures are logged and swallowed.
// ============================================================

const CLASSIFICATION_SYSTEM_PROMPT = `You are a task classifier. Given a task instruction and its output, classify the task.
Return ONLY valid JSON with these fields:
- task_type: one of "fix", "feature", "test", "refactor", "review", "docs"
- complexity: one of "trivial", "simple", "moderate", "complex"
- language: primary programming language (e.g. "typescript", "python", "bash", "mixed")
- stack: tech stack (e.g. "cloudflare-workers", "node", "react", "infrastructure")
- domain: domain area (e.g. "mcp", "auth", "ci", "database", "api", "devops")

Be concise and precise. Return raw JSON only, no markdown fencing.`;

interface ClassificationResult {
  task_type?: string;
  complexity?: string;
  language?: string;
  stack?: string;
  domain?: string;
}

export async function classifyTask(
  env: Env,
  taskId: string,
  instruction: string,
  executorOutput: unknown,
): Promise<void> {
  try {
    const outputStr =
      typeof executorOutput === "string"
        ? executorOutput
        : JSON.stringify(executorOutput);

    const userContent = [
      `## Instruction (first 500 chars)\n${instruction.slice(0, 500)}`,
      `## Output (first 500 chars)\n${outputStr.slice(0, 500)}`,
    ].join("\n\n");

    const response = await fetch(
      `${AI_GATEWAY_URL}/anthropic/v1/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          // Skip cache — classification content varies per task
          "cf-aig-skip-cache": "true",
          // Tag with task ID for gateway analytics
          "cf-aig-metadata-task_id": taskId,
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          system: CLASSIFICATION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `[classify] Gateway returned ${response.status} for task ${taskId}: ${await response.text()}`,
      );
      return;
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content?.find((b) => b.type === "text")?.text;
    if (!text) {
      console.error(`[classify] No text block in response for task ${taskId}`);
      return;
    }

    // Parse JSON — strip markdown fencing if model includes it despite instructions
    const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
    const result: ClassificationResult = JSON.parse(cleaned);

    // Validate fields before writing
    const validTaskTypes = ["fix", "feature", "test", "refactor", "review", "docs"];
    const validComplexities = ["trivial", "simple", "moderate", "complex"];

    const taskType = validTaskTypes.includes(result.task_type ?? "") ? result.task_type : null;
    const complexity = validComplexities.includes(result.complexity ?? "") ? result.complexity : null;

    // Update D1 task record with classification
    await env.VAULT_DB.prepare(
      `UPDATE tasks
       SET task_type = COALESCE(?, task_type),
           complexity = COALESCE(?, complexity),
           language = COALESCE(?, language),
           stack = COALESCE(?, stack),
           domain = COALESCE(?, domain),
           updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(
        taskType,
        complexity,
        result.language ?? null,
        result.stack ?? null,
        result.domain ?? null,
        taskId,
      )
      .run();

    console.log(
      `[classify] Task ${taskId} classified: type=${taskType} complexity=${complexity} lang=${result.language} stack=${result.stack} domain=${result.domain}`,
    );
  } catch (err) {
    // Best-effort — log and move on
    console.error(
      `[classify] Failed for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
