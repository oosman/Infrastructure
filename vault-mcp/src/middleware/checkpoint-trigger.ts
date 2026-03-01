import { createCheckpoint } from "../tools/checkpoint";

interface CheckpointResult {
  triggered: boolean;
  weight: number;
}

/**
 * Evaluate weighted signals from tool_calls and decisions tables.
 * Fire auto-checkpoint when cumulative weight > 1.0.
 *
 * Signals (PR creation excluded — handled in github.ts):
 *   decision_density  3+ decides in 5 min   → 0.5
 *   github_write      any github write       → 0.3
 *   tool_calls        15+ since checkpoint   → 0.6
 *   time_gap          10+ min between calls  → 0.4
 *   multi_repo        3+ distinct gh hashes  → 0.3
 */
export async function maybeAutoCheckpoint(db: D1Database): Promise<CheckpointResult> {
  try {
    // Anchor: timestamp of last checkpoint (or epoch if none)
    const last = await db
      .prepare("SELECT created_at FROM checkpoints ORDER BY created_at DESC LIMIT 1")
      .first<{ created_at: string }>();
    const since = last?.created_at ?? "1970-01-01T00:00:00.000Z";

    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();

    // All signal queries in parallel — uses indexed columns only
    const [toolCallCount, decisionCount, ghWriteCount, ghDistinct, recentPair] =
      await Promise.all([
        db.prepare("SELECT COUNT(*) as cnt FROM tool_calls WHERE created_at > ?")
          .bind(since)
          .first<{ cnt: number }>(),

        db.prepare("SELECT COUNT(*) as cnt FROM decisions WHERE created_at > ?")
          .bind(fiveMinAgo)
          .first<{ cnt: number }>(),

        db.prepare(
          "SELECT COUNT(*) as cnt FROM tool_calls WHERE tool_name = 'github' AND action = 'write' AND created_at > ?",
        )
          .bind(since)
          .first<{ cnt: number }>(),

        db.prepare(
          "SELECT COUNT(DISTINCT params_hash) as cnt FROM tool_calls WHERE tool_name = 'github' AND created_at > ?",
        )
          .bind(since)
          .first<{ cnt: number }>(),

        db.prepare("SELECT created_at FROM tool_calls ORDER BY created_at DESC LIMIT 2")
          .all<{ created_at: string }>(),
      ]);

    let weight = 0;
    const signals: string[] = [];

    const total = toolCallCount?.cnt ?? 0;
    const decides = decisionCount?.cnt ?? 0;
    const writes = ghWriteCount?.cnt ?? 0;
    const distinctGh = ghDistinct?.cnt ?? 0;

    // Decision density: 3+ architectural decisions in 5-minute window
    if (decides >= 3) {
      weight += 0.5;
      signals.push(`decision_density(${decides})`);
    }

    // PR creation: SKIP — already auto-checkpointed in github.ts

    // GitHub file write: state likely changed
    if (writes > 0) {
      weight += 0.3;
      signals.push(`github_write(${writes})`);
    }

    // Tool call volume: time-based fallback
    if (total >= 15) {
      weight += 0.6;
      signals.push(`tool_calls(${total})`);
    }

    // Time gap: 10+ minutes between consecutive calls → possible topic shift
    const pairs = recentPair?.results;
    if (pairs && pairs.length === 2) {
      const gapMs =
        new Date(pairs[0].created_at).getTime() -
        new Date(pairs[1].created_at).getTime();
      if (gapMs >= 10 * 60_000) {
        weight += 0.4;
        signals.push(`time_gap(${Math.round(gapMs / 60_000)}min)`);
      }
    }

    // Multi-repo proxy: 3+ distinct github param hashes since checkpoint
    if (distinctGh >= 3) {
      weight += 0.3;
      signals.push(`multi_repo(${distinctGh})`);
    }

    if (weight <= 1.0) {
      return { triggered: false, weight };
    }

    // Derive recent_actions from tool call history for the checkpoint doc
    const recent = await db
      .prepare(
        "SELECT tool_name, action FROM tool_calls WHERE created_at > ? ORDER BY created_at DESC LIMIT 10",
      )
      .bind(since)
      .all<{ tool_name: string; action: string | null }>();

    const actions = (recent.results ?? []).map((r) =>
      r.action ? `${r.tool_name}.${r.action}` : r.tool_name,
    );

    await createCheckpoint(db, {
      objective: `Auto-checkpoint (weight: ${weight.toFixed(1)}, signals: ${signals.join(", ")})`,
      recent_actions: actions,
      weight,
    });

    return { triggered: true, weight };
  } catch {
    // Fire-and-forget: swallow all errors
    return { triggered: false, weight: 0 };
  }
}
