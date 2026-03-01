import { ulid, now } from "../utils";

/** djb2 string hash — fast, non-crypto */
function hashParams(params: Record<string, unknown>): string {
  const str = JSON.stringify(params);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(36);
}

/** Fire-and-forget tool call log to D1. Never throws. */
export function logToolCall(
  db: D1Database,
  toolName: string,
  action?: string,
  params?: Record<string, unknown>,
): Promise<void> {
  return db
    .prepare(
      "INSERT INTO tool_calls (id, tool_name, action, params_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(ulid(), toolName, action ?? null, params ? hashParams(params) : null, now())
    .run()
    .then(() => {})
    .catch(() => {});
}
