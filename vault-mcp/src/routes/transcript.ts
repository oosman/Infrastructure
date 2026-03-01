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

interface V1Entry {
  session_date: string;
  role: string;
  content: string;
}

interface V2Entry {
  session_date: string;
  conversation_id?: string;
  turn_number?: number;
  parent_message_uuid?: string;
  is_branch?: boolean;
  history_hash?: string;
  history_length?: number;
  user_content?: string;
  assistant_content?: string;
  full_history?: Array<{ role: string; content: string; uuid?: string }>;
  // v1 compat
  role?: string;
  content?: string;
  path?: string;
  created_at?: string;
}

export async function handleTranscriptIngest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await request.json() as { entries?: V2Entry[] };
  if (!body.entries || !Array.isArray(body.entries)) {
    return errorResponse("Required: entries[]");
  }

  let inserted = 0;
  const ts = now();

  for (const entry of body.entries) {
    const convId = entry.conversation_id || null;
    const turnNum = entry.turn_number || null;
    const isBranch = entry.is_branch ? 1 : 0;
    const parentUuid = entry.parent_message_uuid || null;
    const historyHash = entry.history_hash || null;
    const sessionDate = entry.session_date;

    if (!sessionDate) continue;

    // v2 format: split user_content / assistant_content into rows
    if (entry.user_content || entry.assistant_content) {
      if (entry.user_content) {
        inserted += await insertRow(env.VAULT_DB, {
          sessionDate, role: "user", content: entry.user_content,
          convId, turnNum, isBranch, parentUuid, historyHash, ts,
        });
      }
      if (entry.assistant_content) {
        inserted += await insertRow(env.VAULT_DB, {
          sessionDate, role: "assistant", content: entry.assistant_content,
          convId, turnNum, isBranch, parentUuid, historyHash, ts,
        });
      }
      // Store full_history snapshot as _snapshot row
      if (entry.full_history && entry.full_history.length > 0) {
        inserted += await insertRow(env.VAULT_DB, {
          sessionDate, role: "_snapshot", content: JSON.stringify(entry.full_history),
          convId, turnNum, isBranch, parentUuid, historyHash, ts,
        });
      }
    }
    // v1 format: role + content
    else if (entry.role && entry.content) {
      inserted += await insertRow(env.VAULT_DB, {
        sessionDate, role: entry.role, content: entry.content,
        convId, turnNum, isBranch, parentUuid, historyHash, ts,
      });
    }
  }

  return json({ inserted, total: body.entries.length });
}

async function insertRow(db: D1Database, p: {
  sessionDate: string; role: string; content: string;
  convId: string | null; turnNum: number | null;
  isBranch: number; parentUuid: string | null;
  historyHash: string | null; ts: string;
}): Promise<number> {
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO transcripts
       (id, session_date, role, content, conversation_id, turn_number, is_branch, parent_message_uuid, history_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      ulid(), p.sessionDate, p.role, p.content,
      p.convId, p.turnNum, p.isBranch, p.parentUuid, p.historyHash, p.ts,
    ).run();
    return 1;
  } catch {
    return 0;
  }
}
