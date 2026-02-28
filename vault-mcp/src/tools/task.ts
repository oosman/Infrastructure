import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Env } from "../env";
import { ulid, now, mcpText, mcpError, VALID_SOURCES } from "../utils";

// ============================================================
// KV task operations
// ============================================================
interface HumanTask {
  id: string;
  title: string;
  project: string;
  status: "open" | "done";
  source: string;
  context?: string;
  occurred_at?: string;
  created_at: string;
  completed_at?: string;
}

async function addTask(kv: KVNamespace, params: {
  title: string;
  project?: string;
  source?: string;
  context?: string;
}): Promise<HumanTask> {
  const source = params.source ?? "auto";
  if (source === "auto" && !params.context) {
    throw new Error("context required when source=auto");
  }

  const id = ulid();
  const task: HumanTask = {
    id,
    title: params.title,
    project: params.project ?? "inbox",
    status: "open",
    source,
    context: params.context,
    created_at: now(),
  };

  await kv.put(`task:${id}`, JSON.stringify(task));
  return task;
}

async function listTasks(kv: KVNamespace, params: {
  status?: string;
  project?: string;
  format?: string;
}): Promise<HumanTask[] | string> {
  const keys = await kv.list({ prefix: "task:" });
  const tasks: HumanTask[] = [];

  for (const key of keys.keys) {
    const val = await kv.get(key.name);
    if (!val) continue;
    const task: HumanTask = JSON.parse(val);

    if (params.status && task.status !== params.status) continue;
    if (params.project && task.project !== params.project) continue;

    tasks.push(task);
  }

  // Sort by ID (ULID = time-ordered) descending
  tasks.sort((a, b) => b.id.localeCompare(a.id));

  if (params.format === "md") {
    return tasksToMarkdown(tasks);
  }
  return tasks;
}

async function updateTask(kv: KVNamespace, taskId: string, params: {
  title?: string;
  project?: string;
  context?: string;
  occurred_at?: string;
}) {
  const val = await kv.get(`task:${taskId}`);
  if (!val) return { error: "Task not found", id: taskId };

  const task: HumanTask = JSON.parse(val);
  if (params.title) task.title = params.title;
  if (params.project) task.project = params.project;
  if (params.context) task.context = params.context;
  if (params.occurred_at) task.occurred_at = params.occurred_at;

  await kv.put(`task:${taskId}`, JSON.stringify(task));
  return task;
}

async function completeTask(kv: KVNamespace, taskId: string) {
  const val = await kv.get(`task:${taskId}`);
  if (!val) return { error: "Task not found", id: taskId };

  const task: HumanTask = JSON.parse(val);
  task.status = "done";
  task.completed_at = now();

  await kv.put(`task:${taskId}`, JSON.stringify(task));
  return task;
}

async function retroactiveTask(kv: KVNamespace, params: {
  title: string;
  project?: string;
  context?: string;
  occurred_at?: string;
}): Promise<HumanTask> {
  const id = ulid();
  const task: HumanTask = {
    id,
    title: params.title,
    project: params.project ?? "inbox",
    status: "done",
    source: "retroactive",
    context: params.context,
    occurred_at: params.occurred_at,
    created_at: now(),
    completed_at: now(),
  };

  await kv.put(`task:${id}`, JSON.stringify(task));
  return task;
}

function tasksToMarkdown(tasks: HumanTask[]): string {
  if (tasks.length === 0) return "No tasks found.";

  // Group by project
  const byProject: Record<string, HumanTask[]> = {};
  for (const t of tasks) {
    const proj = t.project ?? "inbox";
    if (!byProject[proj]) byProject[proj] = [];
    byProject[proj].push(t);
  }

  const lines: string[] = [];
  for (const [project, projectTasks] of Object.entries(byProject).sort()) {
    lines.push(`## ${project}`);
    for (const t of projectTasks) {
      const check = t.status === "done" ? "x" : " ";
      const ctx = t.context ? ` — ${t.context}` : "";
      lines.push(`- [${check}] ${t.title}${ctx} \`${t.id}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================
// Tool registration
// ============================================================
export function registerTaskTool(server: McpServer, env: Env) {
  server.tool(
    "task",
    "Human task management (KV-backed). Actions: add (create), update (edit), done (complete), retro (record past work), list (filter/query).",
    {
      action: z.enum(["add", "update", "done", "retro", "list"]).describe("Task action"),
      id: z.string().optional().describe("Task ID (update/done)"),
      title: z.string().optional().describe("Task title (add/retro)"),
      project: z.string().optional().describe("Project name (add/update/retro/list)"),
      source: z.string().optional().describe("Source: claude.ai, cc, iphone, auto (add)"),
      context: z.string().optional().describe("Context (add/update/retro)"),
      occurred_at: z.string().optional().describe("When it occurred (update/retro)"),
      status: z.string().optional().describe("Filter status: open/done (list)"),
      format: z.string().optional().describe("Output format: json/md (list)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "add": {
            if (!params.title) return mcpError("add requires: title");
            return mcpText(await addTask(env.TASKS_KV, {
              title: params.title,
              project: params.project,
              source: params.source,
              context: params.context,
            }));
          }
          case "update": {
            if (!params.id) return mcpError("update requires: id");
            return mcpText(await updateTask(env.TASKS_KV, params.id, {
              title: params.title,
              project: params.project,
              context: params.context,
              occurred_at: params.occurred_at,
            }));
          }
          case "done": {
            if (!params.id) return mcpError("done requires: id");
            return mcpText(await completeTask(env.TASKS_KV, params.id));
          }
          case "retro": {
            if (!params.title) return mcpError("retro requires: title");
            return mcpText(await retroactiveTask(env.TASKS_KV, {
              title: params.title,
              project: params.project,
              context: params.context,
              occurred_at: params.occurred_at,
            }));
          }
          case "list": {
            const result = await listTasks(env.TASKS_KV, {
              status: params.status ?? "open",
              project: params.project,
              format: params.format,
            });
            return mcpText(result);
          }
        }
      } catch (err) {
        return mcpError(`task.${params.action} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}

// Export for REST routes
export { addTask, listTasks, updateTask, completeTask, retroactiveTask };
