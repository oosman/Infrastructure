---
name: session-end
description: Session completion, checkpoint, and handoff protocol. Use this skill EVERY TIME the user types "/done", "done", "session end", "wrap up", or indicates they want to close a working session. Also trigger on "save checkpoint", "end session", or "let's wrap up". This skill orchestrates checkpoint saving, documentation updates, transcript capture, and git operations for ANY project. Always use this skill — never improvise the shutdown sequence.
---

# Session End (/done)

Execute these steps IN ORDER. Do not skip steps. Report each step's result briefly.

## Step 0: Recover Session Title
Load the current checkpoint to get the session title (stored in `objective` by /bismillah).
If not available, construct a title from the conversation context.

## Step 1: Save Final Checkpoint
Call `vault-mcp checkpoint(action: "save")` with:
- **objective**: Session title from Step 0 (preserve it for transcript capture)
- **recent_actions**: 3-5 key things completed this session
- **blockers**: Unresolved issues or pending items

This is the primary handoff for the next session.

## Step 2: Detect Project and Update Docs
Determine the project from checkpoint or context. Then update the project's completion tracking doc if one exists.

Use `mac-mcp run_command` to find and read the project's completion doc:
```bash
# Common locations — adapt per project
find ~/Developer -maxdepth 3 -name "completion.md" -path "*[project]*" 2>/dev/null
```

Append any new completed items from this session. Only add work actually completed. Do not duplicate.

If no completion doc exists for this project, skip this step.

## Step 3: Git Commit and Push
Use `mac-mcp run_command` to find the project repo and commit:
```bash
cd [project_dir] && git add -A && git status
```
If there are changes:
```bash
cd [project_dir] && git commit -m "session: [brief description]" && git push
```

If git operations fail or repo location is unknown, skip and note the failure.

## Step 4: Transcript Capture
Trigger title-based transcript capture using the session title:
```bash
VAULT_TOKEN=$(security find-generic-password -a "osman" -s "VAULT_AUTH_TOKEN" -w)
curl -sf --max-time 60 -X POST "https://vault.deltaops.dev/transcripts/capture" \
  -H "Authorization: Bearer $VAULT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "[SESSION_TITLE]"}'
```

If capture fails (VPS down, timeout, title not matched): log error, continue. The checkpoint from Step 1 is the critical artifact — transcript is supplementary.

## Step 5: Summary
End with exactly 3 lines:
1. **Done**: What was accomplished
2. **Next**: What the next session should pick up
3. **Blocked**: Any blockers (or "None")

## Error Handling
- vault-mcp down → save to `~/.vault/checkpoints-fallback.md` via mac-mcp
- git push fails → report error, suggest manual resolution
- mac-mcp down → save checkpoint to vault-mcp only, skip local operations
- transcript capture fails → log and continue

## Key Principle
RELIABLE HANDOFF. Every session leaves enough context for the next session to resume cold, in any project, without re-explaining anything.
