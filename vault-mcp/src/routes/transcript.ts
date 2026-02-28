import type { Env } from "../env";
import { json, errorResponse, ulid, now } from "../utils";
import { searchTranscripts } from "../tools/search";

export async function handleTranscriptSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  if (!query) return errorResponse("Required: q (query parameter)");

  const result = await searchTranscripts(env.VAULT_DB, {
    query,
    session: url.searchParams.get("session") ?? undefined,
    limit: url.searchParams.has("limit") ? parseInt(url.searchParams.get("limit")!) : undefined,
  });

  return json(result);
}

export async function handleTranscriptIngest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await request.json() as {
    entries?: Array<{ session_date: string; role: string; content: string }>;
  };

  if (!body.entries || !Array.isArray(body.entries)) {
    return errorResponse("Required: entries[] with session_date, role, content");
  }

  let inserted = 0;
  for (const entry of body.entries) {
    if (!entry.session_date || !entry.role || !entry.content) continue;
    const id = ulid();
    try {
      await env.VAULT_DB.prepare(
        "INSERT OR IGNORE INTO transcripts (id, session_date, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(id, entry.session_date, entry.role, entry.content, now()).run();
      inserted++;
    } catch {
      // Skip duplicates
    }
  }

  return json({ inserted, total: body.entries.length });
}
