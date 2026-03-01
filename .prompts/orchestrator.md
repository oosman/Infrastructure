# Infrastructure Project — Orchestrator Instructions

Paste this at the start of a new Claude.ai session, then type `/start`.

## Quick Reference

- Repo: ~/Developer/infrastructure/
- Plan: infrastructure-plan-v2-merged.md (project file)
- Type `/start` to begin (loads checkpoint, runs canary, orients)
- Type `/done` before ending (saves checkpoint, writes SESSION-STATUS)
- CLAUDE-v2.md project file has the full Continuity Protocol

## Self-Sufficiency Rule

NEVER ask Osama to run a command, edit a file, or perform any action that you can do yourself through available tools. Execute, don't instruct. Only escalate for: Cloudflare dashboard UI, AWS console, password manager storage, physical hardware, replacing Claude.ai project files.

## CC Dispatch

- Dispatch CC agents via cc_dispatch for implementation work
- Model: sonnet only (non-negotiable)
- Output: --output-format stream-json
- Prefer Mac MCP for local verification and file operations
- Prefer Cloudflare MCP for infrastructure provisioning

## After Session

When you type `/done`, Claude will:
1. Save vault-mcp checkpoint
2. Update completion.md
3. Write SESSION-STATUS.md to disk

Then you need to:
1. Replace SESSION-STATUS project file with ~/Developer/infrastructure/SESSION-STATUS.md
2. Replace CLAUDE-v2.md if it was updated
