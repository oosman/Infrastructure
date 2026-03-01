export interface Env {
  VAULT_DB: D1Database;
  TASKS_KV: KVNamespace;
  VAULT_AUTH_TOKEN: string;
  GITHUB_PAT: string;
  GITHUB_WEBHOOK_SECRET: string;
  EXECUTOR_SECRET: string;
  EXECUTOR_URL?: string;
  ANTHROPIC_API_KEY: string;
  // Injected at request time from ExecutionContext
  __waitUntil?: (p: Promise<unknown>) => void;
}

export const CF_ACCOUNT_ID = "3d18a8bf1d47b952ec66dc00b76f38cd";
export const AI_GATEWAY_ID = "infra-gateway";
export const AI_GATEWAY_URL = `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${AI_GATEWAY_ID}`;
