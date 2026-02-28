import type { Env } from "../env";
import { json, errorResponse, EXECUTOR_DEFAULT_URL } from "../utils";

export async function handleExecuteProxy(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const body = await request.json();
  const url = env.EXECUTOR_URL ?? EXECUTOR_DEFAULT_URL;

  try {
    const response = await fetch(`${url}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": env.EXECUTOR_SECRET,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return errorResponse(`Executor returned ${response.status}: ${text}`, response.status);
    }

    const result = await response.json();
    return json(result);
  } catch (err) {
    return errorResponse(`Executor unreachable: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
}
