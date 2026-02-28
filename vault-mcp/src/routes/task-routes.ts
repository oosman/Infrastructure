import type { Env } from "../env";
import { json, errorResponse } from "../utils";
import { addTask, listTasks, updateTask, completeTask, retroactiveTask } from "../tools/task";

export async function handleTaskRoutes(
  request: Request,
  env: Env,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /tasks — add task
  if (path === "/tasks" && method === "POST") {
    const body = await request.json() as Record<string, unknown>;
    if (!body.title) return errorResponse("Required: title");
    try {
      const task = await addTask(env.TASKS_KV, {
        title: body.title as string,
        project: body.project as string | undefined,
        source: body.source as string | undefined,
        context: body.context as string | undefined,
      });
      return json(task, 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : String(err));
    }
  }

  // GET /tasks — list tasks
  if (path === "/tasks" && method === "GET") {
    const result = await listTasks(env.TASKS_KV, {
      status: url.searchParams.get("status") ?? "open",
      project: url.searchParams.get("project") ?? undefined,
      format: url.searchParams.get("format") ?? undefined,
    });
    if (typeof result === "string") {
      return new Response(result, {
        headers: { "Content-Type": "text/markdown" },
      });
    }
    return json(result);
  }

  // PUT /tasks/:id — update task
  const idMatch = path.match(/^\/tasks\/([A-Z0-9]{26})$/);
  if (idMatch && method === "PUT") {
    const body = await request.json() as Record<string, unknown>;
    const result = await updateTask(env.TASKS_KV, idMatch[1], {
      title: body.title as string | undefined,
      project: body.project as string | undefined,
      context: body.context as string | undefined,
      occurred_at: body.occurred_at as string | undefined,
    });
    return json(result);
  }

  // POST /tasks/:id/done — complete task
  const doneMatch = path.match(/^\/tasks\/([A-Z0-9]{26})\/done$/);
  if (doneMatch && method === "POST") {
    const result = await completeTask(env.TASKS_KV, doneMatch[1]);
    return json(result);
  }

  // POST /tasks/retroactive — retroactive task
  if (path === "/tasks/retroactive" && method === "POST") {
    const body = await request.json() as Record<string, unknown>;
    if (!body.title) return errorResponse("Required: title");
    const task = await retroactiveTask(env.TASKS_KV, {
      title: body.title as string,
      project: body.project as string | undefined,
      context: body.context as string | undefined,
      occurred_at: body.occurred_at as string | undefined,
    });
    return json(task, 201);
  }

  return errorResponse("Not found", 404);
}
