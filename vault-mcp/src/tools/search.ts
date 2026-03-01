import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError } from "../utils";

async function searchTranscripts(db: D1Database, params: {
  query: string;
  session?: string;
  limit?: number;
}) {
  const limit = Math.min(params.limit ?? 20, 100);
  const likeQuery = `%${params.query}%`;

  let stmt;
  if (params.session) {
    stmt = db.prepare(
      "SELECT id, session_date, role, content, created_at, title FROM transcripts WHERE content LIKE ? AND session_date = ? ORDER BY created_at DESC LIMIT ?",
    ).bind(likeQuery, params.session, limit);
  } else {
    stmt = db.prepare(
      "SELECT id, session_date, role, content, created_at, title FROM transcripts WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
    ).bind(likeQuery, limit);
  }

  const results = await stmt.all();
  return {
    query: params.query,
    count: results.results?.length ?? 0,
    results: results.results ?? [],
  };
}

export function registerSearchTool(server: McpServer, env: Env) {
  server.tool(
    "search",
    "Search conversation transcripts. Returns matching transcript entries ordered by recency.",
    {
      query: z.string().describe("Search query string"),
      session: z.string().optional().describe("Filter by session date (YYYY-MM-DD)"),
      limit: z.number().optional().describe("Max results (default 20, max 100)"),
    },
    async (params) => {
      try {
        return mcpText(await searchTranscripts(env.VAULT_DB, params));
      } catch (err) {
        return mcpError(`search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

// Export for REST routes
export { searchTranscripts };
