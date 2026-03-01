---
name: session-end
description: Session completion protocol. Use EVERY TIME the user types "/done", "done", "session end", "wrap up", or wants to close a session. Calls vault-mcp session_end (one tool call) then optionally handles local git ops.
---

# Session End (/done)

## Step 1: Call vault-mcp session_end
One tool call. Handles checkpoint save + transcript capture atomically.

```
vault-mcp session_end({
  objective: "Session title from first assistant message",
  recent_actions: ["action1", "action2", "action3"],
  blockers: ["blocker1"] // or empty
})
```

## Step 2: Git (optional, only if mac-mcp available)
If there were local file changes this session:
```
mac-mcp run_command("cd [project_dir] && git add -A && git commit -m 'session: [brief]' && git push")
```

Skip if: no local changes, mac-mcp unavailable, or no known project repo.

## Step 3: Summary
Exactly 3 lines:
1. **Done**: What was accomplished
2. **Next**: What next session should pick up
3. **Blocked**: Any blockers (or "None")

## Error Handling
- vault-mcp down → save to `~/.vault/checkpoints-fallback.md` via mac-mcp if available
- Transcript capture fails → non-fatal, checkpoint is the critical artifact
- Git fails → report error, continue

## Key Principle
ONE vault tool call for the critical path. Git is optional local cleanup.
