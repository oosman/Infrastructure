import { createMcpHandler } from "agents/mcp";
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

function createServer(env: Env): McpServer {
  const server = new McpServer({ name: "vault-mcp", version: "2.0.0" });
  registerWorkflowTool(server, env);
  registerWorkflowQueryTool(server, env);
  registerTaskTool(server, env);
  registerExecuteTool(server, env);
  registerGithubTool(server, env);
  registerCheckpointTool(server, env);
  registerSearchTool(server, env);
  registerPricingTool(server, env);
  registerHealthTool(server, env);
  registerBackupTool(server, env);
  return server;
}

function verifyPathAuth(pathname: string, env: Env): { authenticated: boolean; stripped: string } {
  const token = env.VAULT_AUTH_TOKEN;
  const prefix = `/${token}/`;
  if (pathname.startsWith(prefix)) {
    return { authenticated: true, stripped: "/" + pathname.slice(prefix.length) };
  }
  if (pathname === `/${token}`) {
    return { authenticated: true, stripped: "/" };
  }
  return { authenticated: false, stripped: pathname };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health — no auth
    if (pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", version: "2.0.0", timestamp: now() });
    }

    // SSE deprecated
    if (pathname === "/sse") {
      return json({ error: "SSE deprecated in v2. Use /mcp (Streamable HTTP)." }, 410);
    }

    // GitHub webhook — own HMAC auth
    if (pathname.startsWith("/github/")) {
      return handleGitHubWebhook(request, env);
    }

    // --- Dual auth ---
    const pathAuth = verifyPathAuth(pathname, env);
    const bearerAuth = verifyBearerAuth(request, env);
    const authenticated = pathAuth.authenticated || bearerAuth;
    if (pathAuth.authenticated) pathname = pathAuth.stripped;

    // MCP — stateless Streamable HTTP
    if (pathname === "/mcp") {
      if (!authenticated) return errorResponse("Unauthorized", 401);

      // GET: 204 (no long-lived SSE in Workers)
      if (request.method === "GET") {
        return new Response(null, { status: 204 });
      }

      // DELETE: 204 (session close ack)
      if (request.method === "DELETE") {
        return new Response(null, { status: 204 });
      }

      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET, POST, DELETE" },
        });
      }

      // createMcpHandler requires Accept to include BOTH application/json AND
      // text/event-stream. Claude.ai may not send both. Force-fix the header
      // (same pattern as mac-mcp server.js).
      const mcpUrl = new URL(request.url);
      mcpUrl.pathname = "/mcp";
      const headers = new Headers(request.headers);
      headers.set("Accept", "application/json, text/event-stream");

      const mcpRequest = new Request(mcpUrl.toString(), {
        method: "POST",
        headers,
        body: request.body,
      });

      const server = createServer(env);
      const handler = createMcpHandler(server as any);
      return handler(mcpRequest, env, ctx);
    }

    // === All remaining routes require auth ===
    if (!authenticated) return errorResponse("Unauthorized", 401);

    const waitUntil = (p: Promise<any>) => ctx.waitUntil(p);

    const restRequest = pathAuth.authenticated
      ? new Request(new URL(pathname + url.search, url.origin).toString(), request)
      : request;

    if (pathname.startsWith("/workflow")) {
      const res = await handleWorkflowRoutes(restRequest, env);
      if (res) return res;
    }

    if (pathname.startsWith("/tasks")) {
      const res = await handleTaskRoutes(restRequest, env, waitUntil);
      if (res) return res;
    }

    if (pathname === "/search" && request.method === "GET") {
      return handleTranscriptSearch(restRequest, env);
    }
    if (pathname === "/transcripts" && request.method === "POST") {
      return handleTranscriptIngest(request, env);
    }
    if (pathname === "/execute" && request.method === "POST") {
      return handleExecuteProxy(request, env);
    }

    return errorResponse("Not found", 404);
  },
};
