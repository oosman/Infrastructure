# KB Docs Staleness Fix — CC Agent Prompt

Fix all stale content in docs/*.md. Here's every issue found, organized by file.

## docs/workflow.md — MAJOR REWRITE NEEDED

The phase table is completely wrong. Replace with:

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | KB Bootstrap (docs, ADRs, commands, skills, resume context) | ✅ Complete |
| 1 | Emergency Security (auth on all endpoints, SSH, secrets) | ✅ Complete |
| 2 | SSE Reliability & Mac Hardening (keepalive, watchdog, logs) | ✅ Complete |
| 3 | vault-mcp v2 (Streamable HTTP, 10 tools, D1+KV) | ✅ Complete |
| 4 | Executor Hardening (systemd, memory/CPU limits, dedicated user) | ✅ Complete |
| 5 | Orchestration Wiring (execute→workflow lifecycle, circuit breakers) | 🔄 Next |
| 6 | Portal Spike (MCP Server Portal evaluation) | 🔄 Next |
| 7 | AI Gateway (classification routing, cost analytics) | Planned |
| 8 | Context Continuity (compaction, session handoff) | Planned |

The "How Work Flows" section should also mention the executor on VM (not just cc_dispatch on Mac):
```
Two execution paths:
1. Mac: cc_dispatch via mac-mcp → CC agent (Sonnet) on Mac
2. VM: execute tool via vault-mcp → executor on Lightsail → claude/codex/gemini CLI
```

## docs/architecture.md — MULTIPLE FIXES

1. In the diagram:
   - Replace "D1 + KV + DO" with "D1 + KV" (DO was dropped)
   - Replace "Caddy + TLS" for executor with "CF Tunnel (QUIC)" (Caddy was never used, decision ADR-0027)
   - Replace "Bearer + CF Access" for vault-mcp with "Bearer token"
   - Remove "executor-mcp" label — executor is NOT an MCP server, it's REST-only

2. Auth Model section — replace "3-Layer" description:
   Current (wrong):
   ```
   1. Bearer token
   2. CF Access Service Token
   3. Anthropic IP allowlist
   ```
   Replace with:
   ```
   Auth varies by connection type:
   - Claude.ai → mac-mcp: Secret path segment in URL
   - Claude.ai → vault-mcp: Bearer token via MCP connector config
   - CC/scripts → any endpoint: Bearer token in Authorization header
   - WAF IP allowlist: Planned, not yet configured
   See ADR-0006 and ADR-0015 (dual-connection model).
   ```

3. Transport section — remove "SSE deprecated but kept on vault-mcp /sse for backward compat". SSE endpoint returns 410, it's gone.

4. Service Map at the bottom — update statuses:
   | Service | Endpoint | Location | Auth | Status |
   |---------|----------|----------|------|--------|
   | Mac MCP | mac-mcp.deltaops.dev | Local Mac | Secret path + Bearer | ✅ Healthy |
   | vault-mcp | vault.deltaops.dev | CF Worker | Bearer | ✅ Healthy |
   | executor | executor.deltaops.dev | Lightsail VM | x-auth-token | ✅ Healthy |
   | AI Gateway | CF AI Gateway | Cloudflare | Token | Phase 7 |

## docs/vault-mcp.md — FIX STATUS

Replace "D1 migrations pending" with "D1 operational (8 tables: tasks, stages, circuit_breaker, model_stats, checkpoints, decisions, transcripts, _cf_KV)"

Replace "Deployed and operational. Workflow state routes built (6 files, 1,617 lines). D1 migrations pending." with:
"Deployed v2.0.0. Stateless Worker with Streamable HTTP transport. 10 MCP tools, D1 (8 tables), KV (tasks). All migrations applied."

Add to Infrastructure section: "D1 database: vault-db (5a0c53ff-963c-48f9-b68d-f13536104aa1)"

## docs/cloudflare.md — FIX TUNNELS AND DETAILS

1. Subdomains table — add:
   | ssh-mac.deltaops.dev | Cloudflare Tunnel → Mac SSH (port 22) | Tunnel |

2. Replace "executor.deltaops.dev: Cloudflare Tunnel → Lightsail VM: Tunnel (future, Phase 3)" with:
   "executor.deltaops.dev: Cloudflare Tunnel → Lightsail VM (QUIC, hardened): Tunnel ✅"

3. Tunnels section — replace "local-mcp tunnel: Mac → mac-mcp.deltaops.dev (4 ORD connections, http2Origin enabled)" with:
   "local-mcp tunnel: Mac → mac-mcp.deltaops.dev (HTTP/2, 4 connections)"
   Remove "http2Origin enabled" — that setting was removed.

4. Add: "executor tunnel: Lightsail VM → executor.deltaops.dev (QUIC, retries 5, grace 30s, keepalive 90s)"

5. Add D1 details: "D1 database: vault-db (8 tables)"

## docs/local-mcp.md — FIX VERSION AND TOOLS

1. Replace "v3.0.0, ~837 lines" with "v3.1.0"

2. Replace the tool table with the actual 11 tools:
   | Tool | Purpose |
   |------|---------|
   | run_command | Execute shell commands |
   | read_file | Read files from filesystem |
   | write_file | Write files to filesystem |
   | list_dir | List directory contents |
   | cc_dispatch | Dispatch Claude Code agent (background) |
   | cc_status | Check CC agent status |
   | cc_result | Get completed CC agent output |
   | cc_kill | Kill a running CC agent |
   | health_check | Diagnostic info (uptime, versions, memory) |
   | search_files | Search for text patterns in files (grep + glob) |
   | notify | Send macOS notification via osascript |

   Remove cc_send_input and self_test — they don't exist.

3. Auth section — replace the token line. Change:
   "Token: macOS Keychain entry "local-mcp-token" (account: osman)"
   to:
   "Token: MAC_MCP_AUTH_TOKEN in macOS Keychain (account: osman). Used as secret path segment in URL and Bearer token."

4. Add auth model info: "Claude.ai connects via secret path segment in URL. CC/scripts use Bearer token header."

## docs/setup.md — FIX PATHS

1. Replace "~/dotfiles/claude/" with "~/Developer/dotfiles/claude/" everywhere (there are 2 occurrences)
2. Replace "All Claude config lives in ~/dotfiles/claude/" with "All Claude config lives in ~/Developer/dotfiles/claude/"
3. Working Directories table: Replace "Dotfiles: ~/dotfiles/" with "Dotfiles: ~/Developer/dotfiles/"
4. Add "Logs: ~/logs/" to the working directories table

## docs/risks.md — FIX AUTH SECTION

Replace the "Auth — Secret Path Exposure" section. Change:
- "TLS everywhere (Cloudflare edge, tunnel encryption, Caddy on VM)" → remove "Caddy on VM" (no Caddy, using CF Tunnel)
- "3-layer auth: Bearer + CF Access Service Token + Anthropic IP allowlist" → "Auth: secret path segments (Claude.ai), Bearer tokens (CC/scripts), WAF IP allowlist (planned)"
- "Each layer independently revocable" → keep this

Also add a new risk section:

## Mac MCP — Zero Auth Window (Closed)
**Risk:** Mac MCP ran with no authentication briefly during initial setup.
**Resolution:** Secret path segments implemented. mac-mcp returns 401 without valid path. Bearer token also accepted.
**Status:** Closed.

## docs/index.md — MINOR UPDATES

1. Replace "Architecture Decision Records (ADR-0001 through ADR-0010)" with "Architecture Decision Records (ADR-0001 through ADR-0028)"
2. Add after the Operations links:
   - [Completion Ledger](completion.md) — Canonical record of what's done

## docs/task-routing.md — MINOR UPDATE

Add a section about VM executors after the "Dispatch Flow" section:

### VM Executor Path (via vault-mcp)
```
Claude.ai (Opus) → execute tool (vault-mcp) → POST executor.deltaops.dev/execute → CLI on VM
                                                    ↓
                                              claude / codex / gemini CLI
                                                    ↓
                                              Mermaid-compressed result → D1 logged
```

Available executors: claude (CC 2.1.63), codex (0.104.0), gemini (0.29.7), consensus (2-way diff).

## GENERAL RULES

- Keep resume context comments at top of each file (don't remove them)
- Keep frontmatter (title, type, status, date, tags) — update date to 2026-02-28
- Don't add any information I haven't specified — only fix what's listed above
- Don't modify docs/completion.md — it's maintained separately
- Don't modify docs/decisions/*.md — those are fine
- Don't modify docs/tags.md
- Commit with message: "docs: fix stale KB content across all service docs"
