export interface Env {
  VAULT_DB: D1Database;
  TASKS_KV: KVNamespace;
  VAULT_MCP: DurableObjectNamespace;
  VAULT_AUTH_TOKEN: string;
  GITHUB_PAT: string;
  GITHUB_WEBHOOK_SECRET: string;
  EXECUTOR_SECRET: string;
  EXECUTOR_URL?: string;
}
