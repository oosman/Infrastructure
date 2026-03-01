import type { Env } from "./env";

// ============================================================
// ULID Generation — Crockford base32, monotonic
// ============================================================
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let _lastTime = 0;
let _lastRandom = "";

function encodeTime(ms: number): string {
  let str = "";
  let t = ms;
  for (let i = 0; i < 10; i++) {
    str = CROCKFORD[t % 32] + str;
    t = Math.floor(t / 32);
  }
  return str;
}

function encodeRandom(): string {
  let str = "";
  for (let i = 0; i < 16; i++) {
    str += CROCKFORD[Math.floor(Math.random() * 32)];
  }
  return str;
}

function incrementBase32(str: string): string {
  const chars = str.split("");
  for (let i = chars.length - 1; i >= 0; i--) {
    const idx = CROCKFORD.indexOf(chars[i]);
    if (idx < 31) {
      chars[i] = CROCKFORD[idx + 1];
      return chars.join("");
    }
    chars[i] = CROCKFORD[0];
  }
  return chars.join("");
}

export function ulid(): string {
  const n = Date.now();
  const time = encodeTime(n);
  if (n === _lastTime) {
    _lastRandom = incrementBase32(_lastRandom);
  } else {
    _lastTime = n;
    _lastRandom = encodeRandom();
  }
  return time + _lastRandom;
}

// ============================================================
// Date helpers
// ============================================================
export function now(): string {
  return new Date().toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ============================================================
// JSON response helpers
// ============================================================
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ============================================================
// MCP tool text response helper
// ============================================================
export function mcpText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
  };
}

export function mcpError(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ============================================================
// Auth
// ============================================================
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < ab.length; i++) {
    result |= ab[i] ^ bb[i];
  }
  return result === 0;
}

export function verifyBearerAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  return constantTimeEqual(token, env.VAULT_AUTH_TOKEN);
}

// ============================================================
// GitHub HMAC verification
// ============================================================
export async function verifyGitHubSignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return constantTimeEqual(`sha256=${hex}`, signature);
}

// ============================================================
// Validation constants
// ============================================================
export const VALID_TASK_TYPES = ["fix", "feature", "test", "refactor", "review", "docs"];
export const VALID_COMPLEXITIES = ["trivial", "simple", "moderate", "complex"];
export const VALID_SOURCES = ["claude.ai", "cc", "iphone", "auto", "retroactive"];
export const STRUCTURED_FIELDS = [
  "files_changed",
  "security_surface",
  "test_targets",
  "dependencies_added",
  "breaking_changes",
] as const;

export const EXECUTOR_DEFAULT_URL = "https://executor.deltaops.dev";
