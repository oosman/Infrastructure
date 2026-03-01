---
name: session-start
description: Session initialization protocol. Use EVERY TIME the user types "/bismillah", "bismillah", "session start", or begins a new working session. Calls vault-mcp session_start (one tool call) then formats the response.
---

# Session Start (/bismillah)

## Step 1: Call vault-mcp session_start
One tool call. No other tools needed.

```
vault-mcp session_start()
```

This returns: vault health, checkpoint (objective, content, signals), recent tasks, recent decisions, task stats, timestamp — everything needed to orient.

## Step 2: Detect Project Context
From (in priority order):
1. Checkpoint content (project field or objective text)
2. Claude.ai Project name (visible in conversation context)
3. Ask the user (last resort)

Derive prefix: "Infrastructure" → `Infra`, "Mobile App" → `Mobile`, etc.

## Step 3: Set Session Title
First line of response MUST be:

**# [Prefix]: [Descriptive Session Title]**

Claude.ai generates conversation titles from the first assistant message. This ensures searchability.

## Step 4: Orient
After the title, 3-5 lines:
- Current objective (from checkpoint)
- Key blockers
- What previous session left off
- Suggested next action

No status dumps. No menus. Orient and execute.

## Degraded Mode
If vault-mcp session_start fails:
- Tell the user vault-mcp is down
- Try mac-mcp: `cat ~/.vault/checkpoints-fallback.md` (situational, only if mac-mcp available)
- Continue with available context

## Key Principle
ONE tool call → titled, oriented session. Fast.
