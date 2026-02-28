import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Env } from "./env";
import { json, errorResponse, verifyBearerAuth, now } from "./utils";

// Tool registrations
import { registerWorkflowTool } from "./tools/workflow";
import { registerWorkflowQueryTool } from "./tools/workflow-query";
import { registerTaskTool } from "./tools/task";
import { registerExecuteTool } from "./tools/execute";
import { registerGithubTool } from "./tools/github";
import { registerCheckpointTool } from "./tools/checkpoint";
import { registerSearchTool } from "./tools/search";
import { registerPricingTool } from "./tools/pricing";
import { registerHealthTool } from "./tools/health";
import { registerBackupTool } from "./tools/backup";

// Route handlers
import { handleWorkflowRoutes } from "./routes/workflow-routes";
import { handleTaskRoutes } from "./routes/task-routes";
import { handleGitHubWebhook } from "./routes/github-webhook";
import { handleTranscriptSearch, handleTranscriptIngest } from "./routes/transcript";
import { handleExecuteProxy } from "./routes/execute-proxy";

// ============================================================
// VaultMcpAgent — Durable Object with MCP server
// ============================================================
export class VaultMcpAgent extends McpAgent<Env, {}, {}> {
  server = new McpServer({ name: "vault-mcp", version: "2.0.0" });

  async init() {
    registerWorkflowTool(this.server, this.env);
    registerWorkflowQueryTool(this.server, this.env);
    registerTaskTool(this.server, this.env);
    registerExecuteTool(this.server, this.env);
    registerGithubTool(this.server, this.env);
    registerCheckpointTool(this.server, this.env);
    registerSearchTool(this.server, this.env);
    registerPricingTool(this.server, this.env);
    registerHealthTool(this.server, this.env);
    registerBackupTool(this.server, this.env);
  }
}

// ============================================================
// Auth helpers
// ============================================================

// Check if path starts with /<token>/ (secret path segment for Claude.ai)
function verifyPathAuth(pathname: string, env: Env): { authenticated: boolean; stripped: string } {
  const token = env.VAULT_AUTH_TOKEN;
  const prefix = `/${token}/`;
  if (pathname.startsWith(prefix)) {
    return { authenticated: true, stripped: "/" + pathname.slice(prefix.length) };
  }
  // Also handle /<token> with no trailing path
  if (pathname === `/${token}`) {
    return { authenticated: true, stripped: "/" };
  }
  return { authenticated: false, stripped: pathname };
}

// ============================================================
// Worker fetch handler — routes to DO or REST
// ============================================================
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, Upgrade",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health — no auth required
    if (pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", version: "2.0.0", timestamp: now() });
    }

    // SSE deprecated
    if (pathname === "/sse") {
      return json({
        error: "SSE transport deprecated in v2. Use /mcp with Streamable HTTP (WebSocket).",
        docs: "https://modelcontextprotocol.io/docs/concepts/transports#streamable-http"
      }, 410);
    }

    // GitHub webhook — own HMAC auth
    if (pathname.startsWith("/github/")) {
      return handleGitHubWebhook(request, env);
    }

    // --- Dual auth: secret path segment (Claude.ai) OR Bearer token (scripts/CC) ---
    const pathAuth = verifyPathAuth(pathname, env);
    const bearerAuth = verifyBearerAuth(request, env);
    const authenticated = pathAuth.authenticated || bearerAuth;

    // If path auth matched, use the stripped path for routing
    if (pathAuth.authenticated) {
      pathname = pathAuth.stripped;
    }

    // MCP transport — route to Durable Object
    if (pathname === "/mcp") {
      if (!authenticated) {
        return errorResponse("Unauthorized", 401);
      }

      // Rewrite URL to /mcp so the Agents SDK sees the right path
      const mcpUrl = new URL(request.url);
      mcpUrl.pathname = "/mcp";
      const mcpRequest = new Request(mcpUrl.toString(), request);

      return (VaultMcpAgent as any).serve("/mcp").fetch(mcpRequest, env, ctx);
    }

    // === All remaining routes require auth ===
    if (!authenticated) {
      return errorResponse("Unauthorized", 401);
    }

    const waitUntil = (p: Promise<any>) => ctx.waitUntil(p);

    // REST: Workflow routes
    if (pathname.startsWith("/workflow")) {
      // Rewrite request URL if path-auth stripped the token
      const restRequest = pathAuth.authenticated
        ? new Request(new URL(pathname + url.search, url.origin).toString(), request)
        : request;
      const res = await handleWorkflowRoutes(restRequest, env);
      if (res) return res;
    }

    // REST: Task routes
    if (pathname.startsWith("/tasks")) {
      const restRequest = pathAuth.authenticated
        ? new Request(new URL(pathname + url.search, url.origin).toString(), request)
        : request;
      const res = await handleTaskRoutes(restRequest, env, pathname, waitUntil);
      if (res) return res;
    }

    // REST: Transcript search & ingest
    if (pathname === "/search" && request.method === "GET") {
      const restRequest = pathAuth.authenticated
        ? new Request(new URL(pathname + url.search, url.origin).toString(), request)
        : request;
      return handleTranscriptSearch(restRequest, env);
    }
    if (pathname === "/transcripts" && request.method === "POST") {
      return handleTranscriptIngest(request, env);
    }

    // REST: Execute proxy
    if (pathname === "/execute" && request.method === "POST") {
      return handleExecuteProxy(request, env);
    }

    return errorResponse("Not found", 404);
  },
};
