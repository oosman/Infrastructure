import type { Env } from "../env";
import { json, errorResponse, now, verifyGitHubSignature } from "../utils";

export async function handleGitHubWebhook(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // GET /github/status
  if (url.pathname === "/github/status" && request.method === "GET") {
    const status = await env.TASKS_KV.get("github:webhook:status");
    return json(status ? JSON.parse(status) : { message: "No webhook events received" });
  }

  // POST /github/webhook
  if (url.pathname === "/github/webhook" && request.method === "POST") {
    const body = await request.text();
    const signature = request.headers.get("X-Hub-Signature-256");

    const valid = await verifyGitHubSignature(body, signature, env.GITHUB_WEBHOOK_SECRET);
    if (!valid) {
      return errorResponse("Invalid signature", 401);
    }

    const event = request.headers.get("X-GitHub-Event");
    const payload = JSON.parse(body);

    // Store last webhook status
    await env.TASKS_KV.put("github:webhook:status", JSON.stringify({
      last_event: event,
      last_received: now(),
      repository: payload.repository?.full_name,
    }));

    // Process events
    switch (event) {
      case "push": {
        const commits = payload.commits?.length ?? 0;
        const branch = payload.ref?.replace("refs/heads/", "");
        await env.TASKS_KV.put(`github:push:${now()}`, JSON.stringify({
          repository: payload.repository?.full_name,
          branch,
          commits,
          pusher: payload.pusher?.name,
          timestamp: now(),
        }));
        return json({ received: true, event, commits, branch });
      }
      case "pull_request": {
        const action = payload.action;
        const pr = payload.pull_request;
        await env.TASKS_KV.put(`github:pr:${pr?.number}`, JSON.stringify({
          repository: payload.repository?.full_name,
          number: pr?.number,
          action,
          title: pr?.title,
          state: pr?.state,
          timestamp: now(),
        }));
        return json({ received: true, event, action, number: pr?.number });
      }
      default:
        return json({ received: true, event, action: "ignored" });
    }
  }

  return errorResponse("Not found", 404);
}
