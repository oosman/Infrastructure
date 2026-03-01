---
name: session-start
description: Session initialization and context recovery protocol. Use this skill EVERY TIME the user types "/bismillah", "bismillah", "session start", or begins a new working session. Also trigger on "start session", "initialize", or "let's begin". This skill orchestrates context recovery across ANY project using vault-mcp checkpoint tools and mac-mcp for local access. Always use this skill — never improvise the startup sequence.
---

# Session Start (/bismillah)

Execute these steps IN ORDER. Do not skip steps. Do not ask questions before completing all steps.

## Step 1: Canary Health Check
Call `vault-mcp task(action: "list", status: "open")` as a connectivity canary.
- Success: vault-mcp healthy, note open task count
- Failure: enter degraded mode (see below)

## Step 2: Load Checkpoint
Call `vault-mcp checkpoint(action: "load")` to recover session state.
- Returns: objective, recent actions, blockers, Mermaid task state, decisions
- Internalize this — it's your memory of previous sessions
- Note the `project` field if present — this tells you which project you're continuing

## Step 3: Mac MCP Connectivity
Call `mac-mcp run_command(command: "echo ok")` to verify local access.
- Failure: note it, continue (vault-mcp alone is sufficient for planning)

## Step 4: Detect Project Context
Determine the active project from (in priority order):
1. Checkpoint `project` field (if present)
2. Claude.ai Project name (visible in conversation context)
3. User's first message context
4. Ask the user (last resort)

Derive a short project prefix from the project name:
- "Infrastructure" → `Infra`
- "Mobile App" → `Mobile`
- "Web Platform" → `Web`
- Generic/unknown → `Session`

## Step 5: Set Session Title
Start your response with this EXACT format as the very first line:

**# [Prefix]: [Descriptive Session Title]**

Examples:
- `# Infra: Phase 8 Dashboard Deployment`
- `# Mobile: Auth Flow Implementation`
- `# Web: API Rate Limiting`

Claude.ai generates conversation titles from the first assistant message. A clear, distinctive first line ensures the session is identifiable and searchable later.

## Step 6: Register Title in Vault
Call `vault-mcp checkpoint(action: "save")` with:
- **objective**: The session title you just generated (for retrieval by /done)
- **recent_actions**: ["session started"]
- **blockers**: [] (or carry forward from loaded checkpoint)

This stores the title server-side so /done can retrieve it without depending on Claude.ai APIs.

## Step 7: Orient
After the title, provide a brief orientation (3-5 lines):
- Current objective (from checkpoint)
- Key blockers or context
- What the previous session left off doing
- Suggested next action

Do NOT dump the entire checkpoint. Do NOT present a status table asking what to work on. Orient and execute.

## Degraded Mode
If vault-mcp is unreachable:
1. Try mac-mcp: `cat ~/.vault/checkpoints-fallback.md`
2. Tell the user vault-mcp is down
3. Continue with available context

## Key Principle
SPEED. User types /bismillah → within seconds they see a titled, oriented session ready to work. No questions, no menus, no status dumps.
