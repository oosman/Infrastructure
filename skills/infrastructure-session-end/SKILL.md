---
name: infrastructure-session-end
description: Infrastructure session completion and handoff protocol. Use this skill EVERY TIME the user types "/done", "done", "session end", "wrap up session", or indicates they want to close an infrastructure session. Also trigger when the user says "save checkpoint", "end session", or "let's wrap up". This skill orchestrates checkpoint saving, documentation updates, and git operations. Always use this skill for infrastructure session endings — never improvise the sequence.
---

# Infrastructure Session End (/done)

When triggered, execute these steps IN ORDER. Do not skip steps. Report each step's result briefly.

## Step 1: Save Checkpoint
Call `vault-mcp checkpoint(action: "save")` with:
- **objective**: What the session was working on (one sentence)
- **recent_actions**: List of 3-5 key things completed this session
- **blockers**: Any unresolved issues or pending items

This checkpoint is the primary handoff mechanism for the next session.

## Step 2: Update completion.md
Use `mac-mcp run_command` to append a session entry to completion.md:
```bash
cd ~/Developer/infrastructure && cat docs/completion.md
```
Review the current state, then use `mac-mcp write_file` or `run_command` with `cat >> ` to add any new completed items that aren't already documented.

Only add entries for work that was actually completed this session. Do not duplicate existing entries.

## Step 3: Git Commit and Push
Use `mac-mcp run_command`:
```bash
cd ~/Developer/infrastructure && git add -A && git status
```
If there are changes:
```bash
cd ~/Developer/infrastructure && git commit -m "session: [brief description of session work]" && git push
```

## Step 4: Transcript Capture (optional)
If the session produced significant discussion worth preserving, note that transcript capture happens automatically via the VPS service. No manual action needed.

## Step 5: Summary
End with a brief 3-line summary:
1. What was accomplished
2. What's next
3. Any blockers for the next session

## Error Handling
- If vault-mcp checkpoint save fails: save checkpoint content to `~/.claude/checkpoints-fallback.md` via mac-mcp
- If git push fails: report the error, suggest manual resolution
- If mac-mcp is down: save checkpoint to vault-mcp only, skip git operations

## Key Principle
The goal is RELIABLE HANDOFF. Every session must leave enough context for the next session to resume without re-explaining anything. The checkpoint + completion.md + git push trio ensures nothing is lost.
