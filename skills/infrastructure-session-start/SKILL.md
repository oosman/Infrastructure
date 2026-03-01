---
name: infrastructure-session-start
description: Infrastructure session initialization protocol. Use this skill EVERY TIME the user types "/bismillah", "bismillah", "session start", or begins a new infrastructure project conversation. Also trigger when the user says "start session", "initialize", or references the bismillah protocol. This skill orchestrates a multi-step startup sequence using vault-mcp and mac-mcp tools. Always use this skill for infrastructure project session starts — never improvise the sequence.
---

# Infrastructure Session Start (/bismillah)

When triggered, execute these steps IN ORDER. Do not skip steps. Do not ask questions before completing all steps.

## Step 1: Canary Health Check
Call `vault-mcp task(action: "list", status: "open")` as a connectivity canary.
- If it succeeds: vault-mcp is healthy, note the open task count.
- If it fails: enter degraded mode — tell the user vault-mcp is unreachable and suggest checking https://vault.deltaops.dev/health

## Step 2: Load Checkpoint
Call `vault-mcp checkpoint(action: "load")` to recover session state.
- This returns the last saved checkpoint with: objective, recent actions, blockers, Mermaid task state, and decisions.
- Parse and internalize this context — it's your memory of what happened in previous sessions.

## Step 3: Mac MCP Connectivity
Call `mac-mcp run_command(command: "echo ok")` to verify local Mac access.
- If it fails: note that mac-mcp is down but continue (vault-mcp is sufficient for planning).

## Step 4: Set Session Title
Based on the checkpoint objective and any user context, start your response with a clear, descriptive title in this exact format:

**# Infra: [Descriptive Session Title]**

Example titles:
- `# Infra: Phase 8 Dashboard Deployment`
- `# Infra: Executor Auth Hardening`
- `# Infra: Transcript Capture Pipeline`

This title MUST be the very first line of your response. Claude.ai uses the first assistant message to generate the conversation title — a clear, descriptive first line ensures the title is meaningful and searchable.

## Step 5: Orient
After the title, provide a brief orientation:
- Current objective (from checkpoint)
- Key blockers or context
- What the previous session left off doing
- Suggested next action

Keep orientation to 3-5 lines. Do NOT dump the entire checkpoint. Do NOT present a status table asking what to work on — just orient and be ready to execute.

## Degraded Mode
If vault-mcp is unreachable:
1. Read fallback files if available via mac-mcp: `~/.claude/tasks-fallback.md` and `~/.claude/checkpoints-fallback.md`
2. Tell the user vault-mcp is down
3. Continue the session using available context

## Key Principle
The goal is SPEED. The user types /bismillah and within 10 seconds sees a titled, oriented session ready to work. No questions, no menus, no status dumps.
