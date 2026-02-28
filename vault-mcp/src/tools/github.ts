import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { mcpText, mcpError } from "../utils";

// ============================================================
// GitHub API helpers
// ============================================================
async function githubFetch(
  env: Env,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const resp = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vault-mcp/2.0",
      ...(options.headers as Record<string, string> ?? {}),
    },
  });

  // Rate limit handling
  const remaining = resp.headers.get("X-RateLimit-Remaining");
  if (remaining && parseInt(remaining) < 10) {
    const reset = resp.headers.get("X-RateLimit-Reset");
    console.warn(`GitHub rate limit low: ${remaining} remaining, resets at ${reset}`);
  }

  return resp;
}

async function readFile(env: Env, params: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}) {
  const query = params.ref ? `?ref=${encodeURIComponent(params.ref)}` : "";
  const resp = await githubFetch(env, `/repos/${params.owner}/${params.repo}/contents/${params.path}${query}`);

  if (!resp.ok) {
    return { error: `GitHub ${resp.status}`, path: params.path };
  }

  const data = await resp.json() as Record<string, unknown>;
  if (data.encoding === "base64" && typeof data.content === "string") {
    const content = atob((data.content as string).replace(/\n/g, ""));
    return { path: params.path, sha: data.sha, content, size: data.size };
  }

  return data;
}

async function writeFile(env: Env, params: {
  owner: string;
  repo: string;
  path: string;
  content: string;
  message: string;
  sha?: string;
  branch?: string;
}) {
  const body: Record<string, unknown> = {
    message: params.message,
    content: btoa(params.content),
  };
  if (params.sha) body.sha = params.sha;
  if (params.branch) body.branch = params.branch;

  const resp = await githubFetch(env, `/repos/${params.owner}/${params.repo}/contents/${params.path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errData = await resp.text();
    return { error: `GitHub ${resp.status}`, detail: errData };
  }

  const data = await resp.json() as Record<string, unknown>;
  return { path: params.path, sha: (data.content as Record<string, unknown>)?.sha, committed: true };
}

async function createPR(env: Env, params: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  head: string;
  base?: string;
}) {
  const resp = await githubFetch(env, `/repos/${params.owner}/${params.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: params.title,
      body: params.body ?? "",
      head: params.head,
      base: params.base ?? "main",
    }),
  });

  if (!resp.ok) {
    const errData = await resp.text();
    return { error: `GitHub ${resp.status}`, detail: errData };
  }

  const data = await resp.json() as Record<string, unknown>;
  return { number: data.number, url: data.html_url, state: data.state };
}

// ============================================================
// Tool registration
// ============================================================
export function registerGithubTool(server: McpServer, env: Env) {
  server.tool(
    "github",
    "GitHub operations. Actions: read (file content), write (create/update file), pr (create pull request).",
    {
      action: z.enum(["read", "write", "pr"]).describe("GitHub action"),
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      path: z.string().optional().describe("File path (read/write)"),
      ref: z.string().optional().describe("Git ref (read)"),
      content: z.string().optional().describe("File content (write)"),
      message: z.string().optional().describe("Commit message (write)"),
      sha: z.string().optional().describe("Current file SHA (write/update)"),
      branch: z.string().optional().describe("Target branch (write)"),
      title: z.string().optional().describe("PR title (pr)"),
      body: z.string().optional().describe("PR body (pr)"),
      head: z.string().optional().describe("Head branch (pr)"),
      base: z.string().optional().describe("Base branch (pr)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "read": {
            if (!params.path) return mcpError("read requires: owner, repo, path");
            return mcpText(await readFile(env, {
              owner: params.owner,
              repo: params.repo,
              path: params.path,
              ref: params.ref,
            }));
          }
          case "write": {
            if (!params.path || !params.content || !params.message) {
              return mcpError("write requires: owner, repo, path, content, message");
            }
            return mcpText(await writeFile(env, {
              owner: params.owner,
              repo: params.repo,
              path: params.path,
              content: params.content,
              message: params.message,
              sha: params.sha,
              branch: params.branch,
            }));
          }
          case "pr": {
            if (!params.title || !params.head) {
              return mcpError("pr requires: owner, repo, title, head");
            }
            return mcpText(await createPR(env, {
              owner: params.owner,
              repo: params.repo,
              title: params.title,
              body: params.body,
              head: params.head,
              base: params.base,
            }));
          }
        }
      } catch (err) {
        return mcpError(`github.${params.action} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

// Export for routes
export { githubFetch, readFile, writeFile, createPR };
