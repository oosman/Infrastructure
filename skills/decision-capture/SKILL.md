---
name: decision-capture
description: Capture architectural decisions to vault-mcp. Trigger when a technical choice, trade-off, or constraint is being decided or agreed upon during conversation. Look for phrases like "let's go with", "the design should", "we decided", "the principle is", or any moment where a choice is made between alternatives. Also trigger when the user says "capture that", "record that decision", or "ADR".
---

# Decision Capture

When an architectural decision, technical trade-off, or design constraint is agreed upon:

## Step 1: Call vault-mcp checkpoint
```
vault-mcp checkpoint(action: "decide", decision: "[what was decided]", rationale: "[why]")
```

Keep both fields concise — one sentence each.

## Step 2: Confirm inline
After the tool call, briefly confirm: "Captured: [decision]" — then continue the conversation naturally. Don't break flow.

## What counts as a decision
- Technology choices ("vault-mcp owns session protocol, not mac-mcp")
- Architectural patterns ("cloud-first: minimize local dependencies")
- Rejected alternatives ("completion.md is redundant, checkpoint is source of truth")
- Constraints accepted ("mac-mcp only for genuine local access needs")
- Naming/convention changes ("workflow not pipeline")

## What does NOT count
- Temporary debugging choices
- One-off commands
- Preferences without trade-offs
- Things already captured in a previous session

## Key Principle
Decisions made in conversation evaporate after compaction. This skill makes them durable.
