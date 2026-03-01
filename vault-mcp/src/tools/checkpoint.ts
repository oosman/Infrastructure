import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { ulid, now, mcpText, mcpError } from "../utils";
import { captureTranscript } from "../routes/transcript-capture";

// ============================================================
// Checkpoint & Decisions — D1
// ============================================================
async function loadCheckpoint(db: D1Database) {
  const checkpoint = await db.prepare(
    "SELECT id, content, trigger_signals, cumulative_weight, created_at FROM checkpoints ORDER BY created_at DESC LIMIT 1",
  ).first();

  if (!checkpoint) return { message: "No checkpoints found" };
  return checkpoint;
}

export async function createCheckpoint(db: D1Database, params: {
  objective?: string;
  blockers?: string[];
  recent_actions?: string[];
  weight?: number;
}) {
  // Build recovery document from current state
  const [openTasks, decisions] = await Promise.all([
    db.prepare("SELECT id, task_type, complexity, status, total_cost_usd FROM tasks WHERE status IN ('open', 'in_progress') ORDER BY created_at DESC").all(),
    db.prepare("SELECT id, decision, rationale, task_id, created_at FROM decisions ORDER BY created_at DESC LIMIT 10").all(),
  ]);

  const doc = buildRecoveryDoc({
    objective: params.objective,
    blockers: params.blockers ?? [],
    recent_actions: params.recent_actions ?? [],
    open_tasks: (openTasks.results ?? []) as Record<string, unknown>[],
    decisions: (decisions.results ?? []) as Record<string, unknown>[],
  });

  const id = ulid();
  const ts = now();
  await db.prepare(
    "INSERT INTO checkpoints (id, content, trigger_signals, cumulative_weight, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, doc, JSON.stringify(params), params.weight ?? 1, ts).run();

  return { id, created_at: ts, content_length: doc.length };
}

async function recordDecision(db: D1Database, params: {
  decision: string;
  rationale: string;
  task_id?: string;
}) {
  const id = ulid();
  const ts = now();
  await db.prepare(
    "INSERT INTO decisions (id, decision, rationale, task_id, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, params.decision, params.rationale, params.task_id ?? null, ts).run();

  return { id, decision: params.decision, created_at: ts };
}

function buildRecoveryDoc(data: {
  objective?: string;
  blockers: string[];
  recent_actions: string[];
  open_tasks: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
}): string {
  const lines: string[] = [
    "# Recovery Checkpoint",
    "",
    `Generated: ${now()}`,
    "",
  ];

  if (data.objective) {
    lines.push(`## Objective`, data.objective, "");
  }

  if (data.open_tasks.length > 0) {
    lines.push("## Open Tasks");
    lines.push("```mermaid");
    lines.push("stateDiagram-v2");
    for (const t of data.open_tasks) {
      const emoji = t.status === "in_progress" ? "🔄" : "📋";
      lines.push(`    ${t.id} : ${emoji} ${t.task_type} (${t.complexity}) $${((t.total_cost_usd as number) ?? 0).toFixed(2)}`);
    }
    lines.push("```");
    lines.push("");
  }

  if (data.blockers.length > 0) {
    lines.push("## Blockers");
    for (const b of data.blockers) {
      lines.push(`- ⛔ ${b}`);
    }
    lines.push("");
  }

  if (data.recent_actions.length > 0) {
    lines.push("## Recent Actions");
    for (const a of data.recent_actions) {
      lines.push(`- ✅ ${a}`);
    }
    lines.push("");
  }

  if (data.decisions.length > 0) {
    lines.push("## Recent Decisions");
    for (const d of data.decisions) {
      lines.push(`- **${d.decision}**: ${d.rationale}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================
// Tool registration
// ============================================================
export function registerCheckpointTool(server: McpServer, env: Env) {
  server.tool(
    "checkpoint",
    "Session recovery checkpoints. Actions: load (latest checkpoint), save (create checkpoint), decide (record architectural decision), ingest (capture transcript from conversation UUID).",
    {
      action: z.enum(["load", "save", "decide", "ingest"]).describe("Checkpoint action"),
      objective: z.string().optional().describe("Current objective (save)"),
      blockers: z.array(z.string()).optional().describe("Current blockers (save)"),
      recent_actions: z.array(z.string()).optional().describe("Recent completed actions (save)"),
      decision: z.string().optional().describe("Decision text (decide)"),
      rationale: z.string().optional().describe("Decision rationale (decide)"),
      task_id: z.string().optional().describe("Related task ID (decide)"),
      conversation_uuid: z.string().optional().describe("Claude.ai conversation UUID (ingest)"),
      title: z.string().optional().describe("Conversation title for fuzzy match (ingest, alternative to UUID)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "load":
            return mcpText(await loadCheckpoint(env.VAULT_DB));
          case "save":
            return mcpText(await createCheckpoint(env.VAULT_DB, {
              objective: params.objective,
              blockers: params.blockers,
              recent_actions: params.recent_actions,
            }));
case "ingest": {
            if (!params.conversation_uuid && !params.title) {
              return mcpError("ingest requires: conversation_uuid or title");
            }
            const captureResult = await captureTranscript(env, {
              conversationUuid: params.conversation_uuid,
              title: params.title,
            });
            return mcpText(captureResult);
          }
          case "decide": {
            if (!params.decision || !params.rationale) {
              return mcpError("decide requires: decision, rationale");
            }
            return mcpText(await recordDecision(env.VAULT_DB, {
              decision: params.decision,
              rationale: params.rationale,
              task_id: params.task_id,
            }));
          }
        }
      } catch (err) {
        return mcpError(`checkpoint.${params.action} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
