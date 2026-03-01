# Infrastructure Completion Ledger

> **Purpose:** Single source of truth for what's done. Every session reads this on start, updates it on finish.  
> **Rule:** If it's not in this file, it didn't happen. If a session completes work, it adds entries here before ending.

## Phase 0 — KB Bootstrap ✅

| Item | Status | Commit | Date |
|------|--------|--------|------|
| CLAUDE.md with v2 architecture, 63 lines | ✅ | b30c1e1 | 2026-02-28 |
| AGENTS.md → CLAUDE.md symlink | ✅ | e2f453f | 2026-02-28 |
| ADRs 0001-0030 (all plan decisions captured) | ✅ | 782973e + 92411fe | 2026-02-28 |
| Slash commands (15) | ✅ | 428c1f0 | 2026-02-28 |
| Skills (7) | ✅ | 428c1f0 | 2026-02-28 |
| kb-writer agent | ✅ | 428c1f0 | 2026-02-28 |
| Compaction hooks in settings.json (3) | ✅ | 428c1f0 | 2026-02-28 |
| Symlinks ~/.claude/* → dotfiles (8/8) | ✅ | bootstrap | 2026-02-28 |
| Resume context comments on all docs (39/39) | ✅ | 782973e | 2026-02-28 |
| Zensical + GitHub Pages live | ✅ | e2f453f | 2026-02-28 |
| mkdocs.yml nav complete (43 entries) | ✅ | 782973e | 2026-02-28 |
| docs: workflow, testing, ci-workflow, intent-validation, memory-layer | ✅ | 782973e | 2026-02-28 |
| docs: architecture, cloudflare, vault-mcp, local-mcp, setup, risks, git-conventions, task-routing | ✅ | various | 2026-02-28 |
| Stale refs purged (pipeline/deltaforce/mobile) | ✅ | c6784cf | 2026-02-28 |
| McpAgent/DO refs updated to Streamable HTTP | ✅ | 0431001 | 2026-02-28 |

## Phase 1 — Emergency Security ✅

| Item | Status | Commit/Detail | Date |
|------|--------|---------------|------|
| mac-mcp secret path auth (closes P0 RCE) | ✅ | 41a99e2 (local-mcp) | 2026-02-28 |
| mac-mcp returns 401 without auth | ✅ | verified curl | 2026-02-28 |
| VM SSH accessible (`ssh vm` works) | ✅ | lightsail-infra.pem | 2026-02-28 |
| Backup SSH: VM → Mac via CF Tunnel (`ssh mac`) | ✅ | ssh-mac.deltaops.dev | 2026-02-28 |
| Executor revived, healthy on :8080 | ✅ | systemd enabled | 2026-02-28 |
| D1 migrations: 8 tables created | ✅ | API direct (no wrangler) | 2026-02-28 |
| D1 renamed: pipeline-db → vault-db | ✅ | 5a0c53ff-963c-48f9-b68d-f13536104aa1 | 2026-02-28 |
| Tunnel config fixed (no http2Origin) | ✅ | cb04c0b | 2026-02-28 |
| Secrets in Keychain (4/4) | ✅ | CF_API_TOKEN, VAULT_AUTH_TOKEN, MAC_MCP_AUTH_TOKEN, EXECUTOR_SECRET | 2026-02-28 |
| .zshrc auto-exports secrets for CC | ✅ | dotfiles | 2026-02-28 |
| minio unloaded | ✅ | | 2026-02-28 |
| Credential files chmod 600 | ✅ | lightsail-infra.pem | 2026-02-28 |
| Executor returns 401 without auth | ✅ | x-auth-token | 2026-02-28 |
| Tunnels running HTTP/2 (Mac) / QUIC (VM) | ✅ | verified | 2026-02-28 |
| AWS CLI working | ✅ | oosman-cli IAM user | 2026-02-28 |
| Old bare /mcp Mac connector deleted | ✅ | Claude.ai UI | 2026-02-28 |

### Phase 1 — NOT Done (acknowledged, deferred)
| Item | Status | Reason |
|------|--------|--------|
| CF Access service tokens | ❌ Skipped | Claude.ai can't send custom headers. Secret path + Bearer is the auth model. |
| WAF IP allowlist | ❌ Not configured | Deferred — nice-to-have, not blocking |
| Browser Integrity / Bot Fight Mode disabled | ✅ | Done per Osama confirmation |

## Phase 2 — SSE Reliability & Mac Hardening ✅

| Item | Status | Detail | Date |
|------|--------|--------|------|
| SSE keepalive 30s on mac-mcp | ✅ | streaming responses | 2026-02-28 |
| Mac sleep prevention | ✅ | pmset, processes holding | 2026-02-28 |
| Log rotation (Mac) | ✅ | cron every 6 hours | 2026-02-28 |
| WiFi change watchdog | ✅ | com.osman.mcp-watchdog running | 2026-02-28 |
| Tunnel health alerts | ✅ | CF dashboard configured | 2026-02-28 |
| Passwordless sudo | ✅ | /etc/sudoers.d/claude-full | 2026-02-28 |

## Phase 3 — vault-mcp v2 ✅

| Item | Status | Detail | Date |
|------|--------|--------|------|
| McpAgent DO deployed | ✅ then removed | Dropped DO — stateless Worker | 2026-02-28 |
| Streamable HTTP transport | ✅ | WebStandardStreamableHTTPServerTransport | 2026-02-28 |
| 10 consolidated tools registered | ✅ | workflow, workflow_query, task, execute, github, checkpoint, search, pricing, health, backup | 2026-02-28 |
| D1 bound (vault-db) | ✅ | 8 tables | 2026-02-28 |
| KV bound (TASKS_KV) | ✅ | 0e01cc2910764d66a3cf8910f8e25eff | 2026-02-28 |
| Worker secrets set | ✅ | VAULT_AUTH_TOKEN, EXECUTOR_SECRET, GITHUB_PAT, GITHUB_WEBHOOK_SECRET | 2026-02-28 |
| Wrangler OAuth stored | ✅ | ~/.wrangler/config/default.toml | 2026-02-28 |
| REST API works with Bearer | ✅ | /health (no auth), /tasks + /mcp (Bearer required) | 2026-02-28 |
| vault-mcp connected in Claude.ai | ✅ | Via MCP Portal (mcp-test.deltaops.dev), 24 tools | 2026-02-28 |

### Phase 3 — NOT Done
| Item | Status | Reason |
|------|--------|--------|
| /sse backward compat endpoint | ❌ | Returns 410 (deprecated). Plan said keep for compat — decided not worth it. |
| 10 tools validated from Claude.ai MCP | ✅ | Validated via Portal (ADR-0030) |

## Phase 4 — Executor Hardening ✅

| Item | Status | Detail | Date |
|------|--------|--------|------|
| Dedicated executor user (nologin) | ✅ | system account | 2026-02-28 |
| ProtectSystem=strict, ProtectHome=read-only | ✅ | systemd hardened | 2026-02-28 |
| PrivateTmp, NoNewPrivileges | ✅ | systemd | 2026-02-28 |
| MemoryMax=512M, MemoryHigh=384M | ✅ | systemd | 2026-02-28 |
| CPUQuota=80% | ✅ | systemd | 2026-02-28 |
| Tunnel hardened (quic, retries, grace, keepalive) | ✅ | a118767b | 2026-02-28 |
| Journald limits (200M, 14-day) | ✅ | | 2026-02-28 |
| Logrotate (daily, 14 rotations) | ✅ | | 2026-02-28 |
| Worktree isolation in executor code | ✅ | built-in | 2026-02-28 |
| Orphan worktree cleanup cron | ✅ | every 4 hours | 2026-02-28 |
| gh CLI on VM | ✅ | v2.87.3 | 2026-02-28 |
| CLIs on VM: claude, codex, gemini | ✅ | 2.1.63, 0.104.0, 0.29.7 | 2026-02-28 |
| Claude CLI on VM (Max OAuth) | ✅ | v2.1.63 | 2026-02-28 |
| Executor tunnel: pipeline-executor → executor | ✅ | a118767b | 2026-02-28 |
| Legacy naming purged on VM | ✅ | ~/pipeline→~/executor, systemd cleaned | 2026-02-28 |
| EXECUTOR_SECRET in Keychain | ✅ | | 2026-02-28 |
| local-mcp pushed to GitHub (private) | ✅ | oosman/local-mcp | 2026-02-28 |
| VM SSH key renamed: lightsail-infra.pem | ✅ | | 2026-02-28 |
| Decision: stay with tunnel (no Caddy) | ✅ | ADR-0027 | 2026-02-28 |

## Phase 5 — Orchestration Wiring ✅

| Item | Status | Detail | Date |
|------|--------|--------|------|
| 5.1 execute.ts → D1 workflow lifecycle | ✅ | createTask + writeStage in workflow-db.ts, cost estimation, task_id passthrough | 2026-02-28 |
| 5.2 End-to-end validation | ✅ | MCP tools/call → vault-mcp → executor → Claude CLI → D1 (task+stage+circuit_breaker) | 2026-02-28 |
| 5.3 Circuit breaker verification | ✅ | daily + monthly cost accumulation in circuit_breaker table confirmed | 2026-02-28 |
| 5.4 Mermaid compression passthrough | ✅ | mermaid field returned in MCP response, graph LR format | 2026-02-28 |
| 5.5 Stale DO cleanup | ✅ | env.ts clean, wrangler.toml migration history preserved (required by CF) | 2026-02-28 |
| 5.6 Escalation protocol | ✅ | DeepSeek→Flash→Pro→Codex→Sonnet→Opus→Consensus→Human. Retry on task-quality failures, skip infra errors. Max 3+consensus+human. 83a118a | 2026-02-28 |

### Key Commits
- 35f801d: Wire execute.ts into workflow lifecycle (createTask, writeStage, cost estimation)
- f85b71d: Fix task_id passthrough from D1 to executor proxy

### Bugs Fixed During Phase 5
- Claude CLI --strict-mcp-config causes silent exit with no API call (CLI bug, workaround: removed flag)
- Executor entrypoint.js: duplicate codex case with misplaced return statement
- Executor entrypoint.js: gemini args malformed (--output-format missing value)
- execute.ts: task_id not forwarded to executor (400 validation error)

### Files Created/Modified
- vault-mcp/src/logic/workflow-db.ts (new) — createTask + writeStage exports
- vault-mcp/src/tools/execute.ts — D1 lifecycle wiring, cost estimation, model inference
- executor/src/entrypoint.js — removed --strict-mcp-config, fixed gemini args, removed duplicate case

## Phase 6 — Portal Spike ✅

| Item | Status | Detail | Date |
|------|--------|--------|------|
| Global API Key stored in Keychain | ✅ | CF_GLOBAL_API_KEY, CF_EMAIL | 2026-02-28 |
| vault-mcp auth relaxed for portal sync | ✅ | initialize + tools/list bypass Bearer | 2026-02-28 |
| MCP servers created (dashboard) | ✅ | vault-mcp + mac-mcp, both status=ready | 2026-02-28 |
| Portal created (dashboard) | ✅ | Infrastructure (id=infra) at mcp-test.deltaops.dev | 2026-02-28 |
| Managed OAuth + DCR configured | ✅ | Claude.ai redirect URIs set | 2026-02-28 |
| Server-level Access policies | ✅ | Both servers have Allow policy (dashboard-created) | 2026-02-28 |
| Portal connected in Claude.ai | ✅ | 24 tools (10 vault + 11 mac + 3 portal) | 2026-02-28 |
| Both servers verified via portal | ✅ | health_check (mac), health (vault) both OK | 2026-02-28 |
| Decision: adopt portal | ✅ | ADR-0030 | 2026-02-28 |

### Key Findings
- **API-created servers don't generate backing Access apps** — must use dashboard
- **Two-layer policy model:** portal app + individual server apps both need policies
- **Managed OAuth DCR:** leave Advanced settings empty in Claude.ai (no manual Client ID)
- **Portal adds 3 tools:** portal_list_servers, portal_toggle_servers, portal_toggle_single_server

### Phase 6 — Pending
| Item | Status | Reason |
|------|--------|--------|
| GitHub MCP server in portal | 🔄 | Dashboard creation needed (third-party OAuth) |
| Production domain (mcp.deltaops.dev) | ❌ Deferred | Keeping mcp-test until portal proves stable |
| Latency benchmarks | ❌ Deferred | Qualitative: no noticeable delay |

## Phase 7 — AI Gateway ✅

| Item | Status | Detail | Date |
|------|--------|--------|------|
| 7.1 Gateway created | ✅ | infra-gateway via CF API (logging, rate limiting 100/min) | 2026-03-01 |
| 7.2 Classification pass | ✅ | classify.ts — Llama 3.1 8B via Workers AI → gateway, backfills task_type/complexity/language/stack/domain on D1 | 2026-03-01 |
| 7.3 Wired into execute | ✅ | waitUntil(classifyTask(...)) in execute.ts success path | 2026-03-01 |
| 7.4 Workers AI binding | ✅ | [ai] in wrangler.toml, env.AI: Ai in env.ts | 2026-03-01 |
| 7.5 Deployed + validated | ✅ | Version 924c8bd5, classification confirmed in D1 + gateway logs | 2026-03-01 |
| 7.6 Executor repo cloned on VM | ✅ | /home/ubuntu/repos/oosman/infrastructure | 2026-03-01 |
| 7.7 Gateway caching enabled | ✅ | skipCache=false + cacheTtl=3600 (was skipCache=true) | 2026-03-01 |
| 7.8 AI Gateway API token | ✅ | CF_AIG_TOKEN in Keychain + wrangler secret, Read+Write+Run perms | 2026-03-01 |
| 7.9 Log retention clarified | ✅ | Count-based (10M max), not time-based. No config needed. | 2026-03-01 |
| 7.10 Model ladder upgrade | ✅ | Sonnet 4.6 (claude-sonnet-4-6), Gemini 3.1 Pro (gemini-3.1-pro-preview), pricing updated | 2026-03-01 |
| 7.11 Default repo fallback | ✅ | oosman/infrastructure when repo omitted (was causing all executor calls to fail) | 2026-03-01 |
| 7.12 Sonnet 4.6 validated | ✅ | End-to-end execute → D1 with claude-sonnet-4-6, first attempt success | 2026-03-01 |

### Key Commits
- aa65507: Initial AI Gateway + classification (ANTHROPIC_API_KEY path)
- 4a007e9: Switch to Workers AI Llama 3.1 8B (free, no API key)
- ef0cfcc: Enable gateway caching (skipCache=false, cacheTtl=3600)
- f642766: Upgrade model ladder — Sonnet 4.6 + Gemini 3.1 Pro + default repo fallback
- 453308b: Upgrade model ladder — Sonnet 4.6, Gemini 3.1 Pro, updated pricing

### Key Decisions
- Workers AI (Llama 3.1 8B) over Anthropic Haiku — free tier, no API key, sufficient for 5-field JSON classification
- Anthropic OAuth tokens banned for third-party API use as of Feb 20 2026 — Max subscription can't be used from Workers
- Classification is best-effort (waitUntil, failures logged and swallowed)
- Gateway scope: classification calls only. Executor CLI calls (claude/codex/gemini) go direct to providers via OAuth/API keys — by design, CLIs need local auth and complete environments.
- Gateway value is foundational plumbing today. Once Mermaid compression protocol validates ~100x on JSON summaries → executor switches from CLI OAuth to direct API calls → all provider traffic routes through gateway → full cost analytics, caching, and rate limiting become operational. Gate G1 trigger: Mermaid validation complete.
- Gateway: skipCache=false + cacheTtl=3600 (cache identical classifications), metadata includes task_id
- Model ladder upgraded: Sonnet 4.5→4.6, Gemini 2.5 Pro→3.1 Pro ($2/$12), default repo fallback added
- Executor diagnosis: Codex blocked by ProtectSystem=strict (Phase 5 fix), Gemini CLI hangs (Phase 5 fix)
- Model ladder upgraded: Sonnet 4.5→4.6 (claude-sonnet-4-6), Gemini 2.5 Pro→3.1 Pro (gemini-3.1-pro-preview), pricing updated

### Files Created/Modified
- vault-mcp/src/logic/classify.ts (new) — classification via Workers AI
- vault-mcp/src/env.ts — AI binding, gateway constants, __waitUntil injection
- vault-mcp/src/tools/execute.ts — waitUntil wiring + classifyTask import
- vault-mcp/src/index.ts — inject __waitUntil from ExecutionContext into env
- vault-mcp/wrangler.toml — [ai] binding
- vault-mcp/src/logic/classify.ts — caching enabled (skipCache=false, cacheTtl=3600)
## Phase 8 — Context Continuity ✅

| Item | Status | Detail | Date |
|------|--------|--------|------|
| 8.1 Session canary protocol | ✅ | Step 0 in CLAUDE.md: task list as health check | 2026-02-28 |
| 8.2 Degraded mode fallback | ✅ | ~/.claude/tasks-fallback.md + checkpoints-fallback.md, symlinked from dotfiles | 2026-02-28 |
| 8.3 /compact command | ✅ | Saves vault-mcp checkpoint + local handoff before compaction | 2026-02-28 |
| 8.4 /handoff enhancement | ✅ | Auto-checkpoint + git log + open tasks from D1 | 2026-02-28 |
| 8.5 Dashboard (React artifact) | ✅ | Cost by model, circuit breaker, health strip, task counts via Anthropic API → vault-mcp MCP | 2026-02-28 |

### Key Commits
- 903de93 (dotfiles): canary protocol, degraded mode, /compact, /handoff enhancement
- 6f9751f (infrastructure): session canary in CLAUDE.md

### Files Created/Modified
- dotfiles: CLAUDE.md (session protocol), commands/compact.md (new), commands/handoff.md (enhanced), tasks-fallback.md (new), checkpoints-fallback.md (new)
- infrastructure: CLAUDE.md (session canary step 0)
- React artifact: dashboard.jsx (cost, tasks, circuit breaker, health)

### ADR Created
- ADR-0031: Session canary & degraded mode

### Docs Updated
- memory-layer.md: 4-layer model (canary → prevention → capture → recovery), degraded mode, fallback files table
- setup.md: session start verification, fallback file paths in working directories
- vault-mcp.md: checkpoint tool canary role, degraded mode reference
- risks.md: new vault-mcp outage risk with degraded mode mitigation, improved 200K context risk
- mkdocs.yml: ADR-0031 nav entry
- CLAUDE.md: ADR range 0001-0031

## Infrastructure State (verified 2026-02-28)

| Component | URL | Status | Auth |
|-----------|-----|--------|------|
| **Portal** | mcp-test.deltaops.dev | ✅ 24 tools (vault+mac+portal) | CF Access OAuth (Managed) |
| vault-mcp | vault.deltaops.dev | ✅ v2.0.0 | Bearer (REST+MCP), /health unauthenticated |
| mac-mcp | mac-mcp.deltaops.dev | ✅ v3.1.0, 11 tools | Secret path + Bearer |
| executor | executor.deltaops.dev | ✅ healthy, 0 active jobs | x-auth-token |
| KB site | oosman.github.io/Infrastructure | ✅ Zensical | Public |
| D1 | vault-db (5a0c53ff) | ✅ 8 tables, data flowing | Via vault-mcp |
| KV | TASKS_KV (0e01cc29) | ✅ | Via vault-mcp |
| AI Gateway | infra-gateway | ✅ | Workers AI binding (Llama 3.1 8B, free) |
| Model ladder | — | ✅ | Flash→3.1 Pro→Codex→Sonnet 4.6→Opus 4.6→Consensus |

## Pending Actions (require Osama's hands)

| Item | Why manual |
|------|-----------|
| Add GitHub MCP server to portal (dashboard) | Third-party OAuth server, dashboard-only |

## Key Credentials

| Secret | Keychain key | Purpose |
|--------|-------------|---------|
| Cloudflare API | CF_API_TOKEN | Workers/D1/KV (no Zero Trust) |
| CF Global Key | CF_GLOBAL_API_KEY | Zero Trust / AI Controls API |
| CF Email | CF_EMAIL | Paired with Global Key |
| vault-mcp auth | VAULT_AUTH_TOKEN | Bearer for /mcp and REST |
| mac-mcp secret | MAC_MCP_AUTH_TOKEN | URL path segment |
| Executor auth | EXECUTOR_SECRET | x-auth-token header |
| Anthropic API | ANTHROPIC_API_KEY | Worker secret (fallback, not actively used) |
| AI Gateway API | CF_AIG_TOKEN | AI Gateway Read+Write+Run (logs, analytics) |
| CF Account ID | (not a secret) | 3d18a8bf1d47b952ec66dc00b76f38cd |

## Session Prompts

| Phase | Path | Status |
|-------|------|--------|
| Phase 5 | .prompts/phase5-session.md | ✅ Complete |
| Phase 6 | .prompts/phase6-session.md | ✅ Complete |
| Phase 7 | .prompts/phase7-session.md | ✅ Complete |
| Phase 8 | .prompts/phase8-session.md | ✅ Complete |
