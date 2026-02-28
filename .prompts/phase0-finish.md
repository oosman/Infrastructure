Complete Phase 0 KB Bootstrap for ~/Developer/infrastructure/. Three tasks: new ADRs, resume context comments on all docs, and 5 missing docs.

Git identity: Osama Osman, oosman@deltaops.dev

## Task 1: Create ADRs 0011-0028

Create these ADR files in docs/decisions/. Use the same format as existing ADRs (read 0001 for reference). Each must have YAML frontmatter (title, status: accepted, date: 2026-02-28, tags), then Context (2-3 sentences), Decision (1-2 sentences), Consequences (2-4 bullets). Keep each under 40 lines.

0011-zensical-over-material.md — Zensical over MkDocs Material. Material entering maintenance mode (Insiders repo deleted May 2026). Zensical has mkdocs.yml compatibility, Disco search. 5-min Material fallback. Tags: [kb, rendering]

0012-single-source-kb.md — Single-source KB with flat docs/ and frontmatter typing. docs/ IS the documentation, Zensical renders. No Diataxis directories. Tags: [kb, architecture]

0013-dotfiles-symlink-source-of-truth.md — ~/dotfiles/claude/ is canonical, ~/.claude/ is symlinks only. Never write directly to ~/.claude/. Tags: [dotfiles, conventions]

0014-cc-max-oauth-over-vertex.md — CC uses Max OAuth (device-auth, $0 marginal) not Vertex AI. Vertex only at Gate G1. 200K context hard limit. Tags: [cc, auth, cost]

0015-dual-connection-model.md — Claude.ai connects via CF Access (no Bearer possible), CC/scripts use Bearer token directly. Both must work simultaneously on same server. Tags: [auth, mcp]

0016-human-tasks-kv-not-github.md — Human tasks use vault-mcp Workers KV, not GitHub Issues. Every-surface access needed (Claude.ai, CC, iPhone). Binary status, freeform project strings, ULID keys. Tags: [tasks, vault-mcp]

0017-naming-infrastructure-workflow.md — Use "infrastructure" or "workflow", never "pipeline" or "deltaforce". All legacy naming purged. Tags: [naming, conventions]

0018-vault-db-rename.md — D1 database renamed from pipeline-db to vault-db (UUID: 5a0c53ff-963c-48f9-b68d-f13536104aa1). Zero tables at time of rename, clean swap. Tags: [d1, naming]

0019-sdk-pin-1-17-3.md — MCP SDK pinned to 1.17.3. Auto-upgrade to 1.27.0 broke auth middleware. Review in Phase 3. Tags: [sdk, mcp]

0020-kb-bootstrap-phase-zero.md — KB Bootstrap moved to Phase 0 (was Phase 9 in v1). CC agents need CLAUDE.md context during all build phases. Tags: [kb, phasing]

0021-direct-https-vm.md — Evaluate direct HTTPS for VM over tunnel (Phase 4). VM has public IP. Caddy + Lets Encrypt + ACL is simpler. Update: Phase 4 decided to stay with tunnel. Status: superseded. Supersedes: null. Superseded-by: 0027. Tags: [vm, networking]

0022-hooks-shell-oneliners.md — Compaction hooks are simple shell one-liners in settings.json. No Python, no API calls, no retry logic. hooks/ directory stays empty. Tags: [compaction, hooks]

0023-circuit-breakers-auxiliary-only.md — Circuit breakers apply to auxiliary API costs only. Max subscription excluded. $2/task alert, $5/task halt, $20/day pause, $80/month review. Tags: [cost, circuit-breakers]

0024-skip-a2a-protocol.md — Skip Agent-to-Agent protocol. No multi-agent discovery needed. Adds JSON-RPC overhead, rewrites working code. Re-evaluate after 50 tasks. Tags: [architecture, protocols]

0025-classification-pass-structured-fields.md — Executors write raw_diff + commit_message only. Haiku/Flash backfills structured fields via waitUntil(). Roughly $0.002 per task. Tags: [vault-mcp, classification]

0026-consensus-worktree-isolation.md — Consensus runs require worktree isolation. Each executor in separate git worktree or clone. Prevents contaminated diffs. Phase 5 precondition. Tags: [consensus, executor]

0027-executor-stay-with-tunnel.md — Decided to keep CF Tunnel for executor instead of direct HTTPS + Caddy. Simplifies config, already working. Supersedes: 0021. Tags: [executor, networking]

0028-mermaid-compression-protocol.md — Mermaid diagrams as compression protocol for executor output. Roughly 100x compression. Deterministic. Reduces context consumption for orchestrator round-trips. Tags: [compression, context]

## Task 2: Add resume context comments to ALL existing docs

The plan requires every doc to start with a resume context HTML comment. Add this to EVERY .md file in docs/ and docs/decisions/ that does not already have one. Insert BEFORE the YAML frontmatter (line 1 of file). Format:

<!-- RESUME CONTEXT
What: [brief description of what this file is]
Why: [why it exists in the KB]
Next: [what related doc or action follows]
Depends-on: [files this doc assumes exist]
-->

For ADRs, use:
<!-- RESUME CONTEXT
What: ADR-NNNN — [title]
Why: Records [the decision] and its rationale
Next: Implementation in [relevant phase]
Depends-on: _adr-template.md
-->

Also add to _adr-template.md itself.

## Task 3: Create 5 missing docs

Create these in docs/. Each must have YAML frontmatter AND a resume context comment. Keep under 80 lines each.

1. docs/workflow.md — Title: "Infrastructure Workflow". Type: explanation. Tags: [workflow, orchestration]. Content: Describe the current workflow. The orchestrator (Claude.ai with human) decomposes intent into tasks. Tasks are dispatched to CC agents (sonnet) on Mac or VM via mac-mcp cc_dispatch. Results flow back through conversation. vault-mcp logs workflow state to D1. Current active focus: building the infrastructure itself (the system that will later orchestrate mobile app builds and other projects). Mention the phases (0-8) as the current work stream.

2. docs/testing.md — Title: "Testing Conventions". Type: reference. Tags: [testing, validation]. Content: N-of-M validation pattern (run N times, accept if M pass). CLI validation: 5-10 test runs per tool. Smoke tests: curl health endpoints. Integration tests: end-to-end MCP protocol calls. No unit test framework currently (solo operator, infrastructure focus). Validation gates in plan: each phase has validation criteria that must pass before moving on.

3. docs/ci-workflow.md — Title: "CI/CD Configuration". Type: reference. Tags: [ci, deployment]. Content: Currently minimal. GitHub Actions deploys docs site (Zensical build on push to main). vault-mcp deployed via wrangler (manual). Executor deployed via systemd on VM (manual). mac-mcp runs via launchd (auto-restart on failure). No automated test pipeline yet. Future: may add pre-commit hooks, PR checks.

4. docs/intent-validation.md — Title: "Intent Validation". Type: explanation. Tags: [intent, workflow]. Content: Human provides intent in natural language via Claude.ai. The orchestrator decomposes into concrete tasks with acceptance criteria. Key principle: humans own intent and curation, machines own implementation and validation. The plan validation framework (plan-validation-prompt.md) formalizes this for infrastructure plans. For code tasks: intent flows through execute tool to CC agent, result validated by orchestrator before acceptance.

5. docs/memory-layer.md — Title: "Context Persistence". Type: explanation. Tags: [context, compaction, memory]. Content: Three layers of context persistence. Layer 1 Prevention: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=90, short sessions. Layer 2 Capture: PreCompact hook copies transcript, /handoff command writes HANDOFF.md with session state. Layer 3 Recovery: SessionStart hook reminds to read CLAUDE.md + HANDOFF.md. Also: CLAUDE.md (always in context), KB docs (searchable), skills/commands (loaded on use), Claude.ai memory (cross-session). The KB site is the long-term source of truth.

## Task 4: Update mkdocs.yml nav

Add the 5 new docs to the nav section in mkdocs.yml. Place them logically:
- Workflow goes under Home (top level, after Architecture)
- Testing goes under Operations
- CI/CD goes under Operations
- Intent Validation goes under Operations
- Context Persistence goes under Operations

Also add any new ADR files to the Decisions section of nav.

## Task 5: Build, commit, push

1. Build: zensical build --clean (or mkdocs build --strict if zensical fails)
2. Fix any errors
3. git add -A
4. git commit -m "docs: complete Phase 0 — ADRs 0011-0028, resume context, missing docs"
5. git push origin main

## Verification
- zensical build --clean (or mkdocs build --strict) passes
- All docs have resume context comment (grep -rL "RESUME CONTEXT" docs/)
- ADRs 0011-0028 exist
- 5 new docs exist
- mkdocs.yml nav includes all files
- gh run list --limit 1

Do NOT touch ~/Developer/archive/. Do NOT edit files outside ~/Developer/infrastructure/.
