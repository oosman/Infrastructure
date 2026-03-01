import type { Env } from "../env";
import { ulid, now } from "../utils";

interface TranscriptResponse {
  ok: boolean;
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  total_messages: number;
  total_paths: number;
  branch_points: number;
  active_path_length: number;
  extracted_at: string;
  chars: number;
  markdown: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60)
    .replace(/-$/, "");
}

/**
 * Parse turns from transcript markdown.
 * Headers are: ### Human (Turn N) or ### Assistant (Turn N)
 * Also handles ## Human (Turn N) for linear transcripts.
 */
function parseTurns(md: string): Array<{ role: string; turn: number; content: string }> {
  const headerRe = /^#{2,4} (Human|Assistant) \(Turn (\d+)\)$/gm;
  const positions: Array<{ role: string; turn: number; headerEnd: number }> = [];

  let m;
  while ((m = headerRe.exec(md)) !== null) {
    positions.push({
      role: m[1] === "Human" ? "user" : "assistant",
      turn: parseInt(m[2]),
      headerEnd: m.index + m[0].length,
    });
  }

  const turns: Array<{ role: string; turn: number; content: string }> = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].headerEnd;
    // Content runs until the line before the next header (any # heading or ---) or EOF
    let end = md.length;
    if (i + 1 < positions.length) {
      // Find the start of the next header's line
      const nextPos = positions[i + 1].headerEnd;
      const lineStart = md.lastIndexOf("\n", nextPos - (nextPos - md.lastIndexOf("#", nextPos)));
      // Simpler: search backwards from next header for the newline
      const searchFrom = md.lastIndexOf("#", positions[i + 1].headerEnd);
      end = md.lastIndexOf("\n", searchFrom);
      if (end <= start) end = searchFrom;
    }

    const content = md.substring(start, end).trim();
    if (content) {
      turns.push({ role: positions[i].role, turn: positions[i].turn, content });
    }
  }

  return turns;
}

export async function captureTranscript(
  env: Env,
  conversationUuid: string,
): Promise<{
  ok: boolean;
  turns_ingested: number;
  github_path?: string;
  total_messages?: number;
  branch_points?: number;
  error?: string;
}> {
  // 1. Call transcript service
  const resp = await fetch(`${env.TRANSCRIPT_URL}/transcript`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": env.TRANSCRIPT_SECRET,
    },
    body: JSON.stringify({
      conversation_url: `https://claude.ai/chat/${conversationUuid}`,
      timeout: 90,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Transcript service ${resp.status}: ${text.substring(0, 200)}`);
  }

  const data = (await resp.json()) as TranscriptResponse;
  if (!data.ok) {
    throw new Error(data.markdown || "extraction failed");
  }

  // 2. Ingest per-turn entries to D1
  const sessionDate = data.created_at.substring(0, 10);
  const ts = now();
  let inserted = 0;

  const turns = parseTurns(data.markdown);
  for (const { role, turn, content } of turns) {
    // Truncate to 50KB per turn for D1 row size
    const truncated = content.length > 50000 ? content.substring(0, 50000) + "\n[truncated]" : content;
    try {
      await env.VAULT_DB.prepare(
        `INSERT OR IGNORE INTO transcripts
         (id, session_date, role, content, conversation_id, turn_number, is_branch, parent_message_uuid, history_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(ulid(), sessionDate, role, truncated, conversationUuid, turn, 0, null, null, ts)
        .run();
      inserted++;
    } catch {
      // continue on duplicate
    }
  }

  // 3. Push markdown to GitHub
  const slug = slugify(data.name || "untitled");
  const githubPath = `docs/transcripts/${sessionDate}-${slug}.md`;
  let githubOk = false;

  try {
    const getResp = await fetch(
      `https://api.github.com/repos/oosman/Infrastructure/contents/${githubPath}`,
      {
        headers: {
          Authorization: `token ${env.GITHUB_PAT}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "vault-mcp",
        },
      },
    );

    const body: Record<string, unknown> = {
      message: `docs: transcript ${data.name} (${data.total_messages} msgs, ${data.branch_points} branches)`,
      content: btoa(unescape(encodeURIComponent(data.markdown))),
      branch: "main",
    };

    if (getResp.ok) {
      const existing = (await getResp.json()) as { sha: string };
      body.sha = existing.sha;
    }

    const putResp = await fetch(
      `https://api.github.com/repos/oosman/Infrastructure/contents/${githubPath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${env.GITHUB_PAT}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "vault-mcp",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    githubOk = putResp.ok;
    if (!githubOk) {
      const errText = await putResp.text().catch(() => "");
      console.log(`GitHub push failed: ${putResp.status} ${errText.substring(0, 200)}`);
    }
  } catch (err) {
    console.log(`GitHub push error: ${err}`);
  }

  return {
    ok: true,
    turns_ingested: inserted,
    github_path: githubOk ? githubPath : undefined,
    total_messages: data.total_messages,
    branch_points: data.branch_points,
  };
}
