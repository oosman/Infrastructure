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
// Worker fetch handler — routes to DO or REST
// ============================================================
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

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
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", version: "2.0.0", timestamp: now() });
    }

    // SSE deprecated — Agents SDK uses Streamable HTTP (WebSocket)
    if (url.pathname === "/sse") {
      return json({
        error: "SSE transport deprecated in v2. Use /mcp with Streamable HTTP (WebSocket).",
        docs: "https://modelcontextprotocol.io/docs/concepts/transports#streamable-http"
      }, 410);
    }

    // GitHub webhook — own HMAC auth
    if (url.pathname.startsWith("/github/")) {
      return handleGitHubWebhook(request, env);
    }

    // MCP transport — Bearer auth + route to Durable Object
    if (url.pathname === "/mcp") {
      if (!verifyBearerAuth(request, env)) {
        return errorResponse("Unauthorized", 401);
      }

      // Route to VaultMcpAgent Durable Object via Agents SDK
      return (VaultMcpAgent as any).serve("/mcp").fetch(request, env, ctx);
    }

    // === All remaining routes require Bearer auth ===
    if (!verifyBearerAuth(request, env)) {
      return errorResponse("Unauthorized", 401);
    }

    const waitUntil = (p: Promise<any>) => ctx.waitUntil(p);

    // REST: Workflow routes
    if (url.pathname.startsWith("/workflow")) {
      const res = await handleWorkflowRoutes(request, env);
      if (res) return res;
    }

    // REST: Task routes
    if (url.pathname.startsWith("/tasks")) {
      const res = await handleTaskRoutes(request, env, url.pathname, waitUntil);
      if (res) return res;
    }

    // REST: Transcript search & ingest
    if (url.pathname === "/search" && request.method === "GET") {
      return handleTranscriptSearch(request, env);
    }
    if (url.pathname === "/transcripts" && request.method === "POST") {
      return handleTranscriptIngest(request, env);
    }

    // REST: Execute proxy
    if (url.pathname === "/execute" && request.method === "POST") {
      return handleExecuteProxy(request, env);
    }

    return errorResponse("Not found", 404);
  },
};
