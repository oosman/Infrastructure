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
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health — no auth required
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", version: "2.0.0", timestamp: now() });
    }

    // GitHub webhook — own HMAC auth
    if (url.pathname.startsWith("/github/")) {
      return handleGitHubWebhook(request, env);
    }

    // MCP transport — Bearer auth + route to DO
    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      if (!verifyBearerAuth(request, env)) {
        return errorResponse("Unauthorized", 401);
      }

      // Route to VaultMcpAgent Durable Object
      // Try the Agents SDK serve() pattern first
      try {
        return (VaultMcpAgent as any).serve("/mcp").fetch(request, env, ctx);
      } catch {
        // Fallback: manual DO routing
        const id = env.VAULT_MCP.idFromName("singleton");
        const stub = env.VAULT_MCP.get(id);
        return stub.fetch(request);
      }
    }

    // REST API — Bearer auth required for everything below
    if (!verifyBearerAuth(request, env)) {
      return errorResponse("Unauthorized", 401);
    }

    const waitUntil = (p: Promise<unknown>) => ctx.waitUntil(p);

    // Route dispatch
    if (url.pathname.startsWith("/workflow")) {
      return handleWorkflowRoutes(request, env);
    }

    if (url.pathname.startsWith("/tasks")) {
      return handleTaskRoutes(request, env, waitUntil);
    }

    if (url.pathname === "/search") {
      return handleTranscriptSearch(request, env);
    }

    if (url.pathname === "/transcripts") {
      return handleTranscriptIngest(request, env);
    }

    if (url.pathname === "/execute") {
      return handleExecuteProxy(request, env);
    }

    return errorResponse("Not found", 404);
  },
};
