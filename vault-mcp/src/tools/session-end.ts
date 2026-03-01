import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { ulid, now, mcpText, mcpError } from "../utils";
import { createCheckpoint } from "./checkpoint";
import { captureTranscript } from "../routes/transcript-capture";

/**
 * session_end — compound tool replacing /done protocol.
 * One call does: checkpoint save + transcript capture (optional).
 * No mac-mcp dependency. Git/completion.md updates are NOT this tool's job —
 * if needed, Claude calls mac-mcp separately (cloud-first principle).
 */
export function registerSessionEndTool(server: McpServer, env: Env) {
  server.tool(
    "session_end",
    "End a session. Saves checkpoint with session state, optionally captures transcript. Returns confirmation. Use when user says /done, 'session end', or wants to wrap up.",
    {
      objective: z.string().describe("Session title/objective (for checkpoint and transcript matching)"),
      recent_actions: z.array(z.string()).describe("3-5 key things completed this session"),
      blockers: z.array(z.string()).optional().describe("Unresolved issues for next session"),
      capture_transcript: z.boolean().optional().describe("Whether to trigger transcript capture (default: true)"),
    },
    async (params) => {
      try {
        const results: Record<string, unknown> = {};

        // 1. Save checkpoint
        const checkpoint = await createCheckpoint(env.VAULT_DB, {
          objective: params.objective,
          recent_actions: params.recent_actions,
          blockers: params.blockers ?? [],
        });
        results.checkpoint_saved = true;
        results.checkpoint_id = checkpoint.id;
        results.checkpoint_created_at = checkpoint.created_at;

        // 2. Transcript capture (optional, default true)
        if (params.capture_transcript !== false) {
          try {
            const capture = await captureTranscript(env, {
              title: params.objective,
            });
            results.transcript_captured = true;
            results.transcript_result = capture;
          } catch (err) {
            // Non-fatal — checkpoint is the critical artifact
            results.transcript_captured = false;
            results.transcript_error = err instanceof Error ? err.message : String(err);
          }
        } else {
          results.transcript_captured = false;
          results.transcript_skipped = true;
        }

        // 3. Session metadata
        results.session_ended_at = now();

        return mcpText(results);
      } catch (err) {
        return mcpError(`session_end failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
