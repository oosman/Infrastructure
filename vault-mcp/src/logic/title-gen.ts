import type { Env } from "../env";

/**
 * Generate a short title from transcript content using Workers AI.
 * Format: "kebab-case-slug" (max 60 chars, no dates).
 * Used for both on-ingest and backfill.
 */
export async function generateTitle(env: Env, content: string): Promise<string | null> {
  try {
    const truncated = content.substring(0, 2000);

    const response = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct" as any,
      {
        messages: [
          {
            role: "system",
            content: `You generate short descriptive titles for conversation transcripts. Rules:
- Output ONLY the title, nothing else
- 3-8 words, lowercase, kebab-case (e.g. "vault-mcp-cors-fix")
- Capture the main topic/action, not meta details
- No dates, no "conversation about", no filler words`,
          },
          {
            role: "user",
            content: `Generate a title for this conversation:\n\n${truncated}`,
          },
        ],
        max_tokens: 30,
        temperature: 0.2,
      } as any,
      {
        gateway: {
          id: "infra-gateway",
          skipCache: true,
        },
      },
    ) as { response?: string };

    const raw = response?.response?.trim();
    if (!raw) return null;

    // Clean: strip quotes, normalize to kebab-case
    const cleaned = raw
      .replace(/^["']|["']$/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 60)
      .replace(/^-|-$/g, "");

    return cleaned || null;
  } catch (err) {
    console.log(`Title generation failed: ${err}`);
    return null;
  }
}

/**
 * Backfill NULL titles for all transcripts grouped by conversation_id or session_date.
 * Uses first user message per group as input.
 */
export async function backfillTitles(env: Env): Promise<{ updated: number; errors: number }> {
  // Find groups with NULL titles
  const groups = await env.VAULT_DB.prepare(`
    SELECT COALESCE(conversation_id, session_date) as grp,
           MIN(id) as first_id
    FROM transcripts
    WHERE title IS NULL AND role = 'user'
    GROUP BY grp
  `).all();

  let updated = 0;
  let errors = 0;

  for (const row of groups.results ?? []) {
    const grp = (row as any).grp;
    const firstId = (row as any).first_id;

    // Get content of first user message
    const msg = await env.VAULT_DB.prepare(
      "SELECT content FROM transcripts WHERE id = ?"
    ).bind(firstId).first<{ content: string }>();

    if (!msg?.content) continue;

    const title = await generateTitle(env, msg.content);
    if (!title) { errors++; continue; }

    // Update all rows in this group
    const result = await env.VAULT_DB.prepare(`
      UPDATE transcripts SET title = ?
      WHERE COALESCE(conversation_id, session_date) = ? AND title IS NULL
    `).bind(title, grp).run();

    updated += result.meta.changes;
  }

  return { updated, errors };
}
