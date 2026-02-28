<!-- RESUME CONTEXT
What: Setup guide — prerequisites, dotfiles, secrets, verification
Why: Onboarding reference for new machines or fresh installs
Next: local-mcp.md for server details
Depends-on: architecture.md
-->
---
title: "Setup Guide"
type: how-to
status: active
date: 2026-02-28
tags: [setup, onboarding]
---

# Setup Guide

## Prerequisites

- macOS with Homebrew
- Node.js 25+ (`brew install node`)
- Claude Code (`npm i -g @anthropic-ai/claude-code`)
- gh CLI (`brew install gh`, authed via `gh auth login`)
- Git identity: `git config --global user.name "Osama Osman"` / `git config --global user.email "oosman@deltaops.dev"`

## Dotfiles

All Claude config lives in ~/Developer/dotfiles/claude/ and is symlinked:

```bash
ls -la ~/.claude/  # Should show symlinks → ~/Developer/dotfiles/claude/
```

Key symlinked items: CLAUDE.md, commands/, contexts/, hooks/, scripts/, settings.json.

## Secrets

Managed via macOS Keychain (account: osman):

```bash
# Check all secrets
python3 ~/Developer/dotfiles/claude/scripts/secrets.py

# Add a new secret
security add-generic-password -a "osman" -s "KEY_NAME" -w "value" -U

# Read a secret
security find-generic-password -a "osman" -s "KEY_NAME" -w
```

| Key | Purpose |
|-----|---------|
| CF_API_TOKEN | Cloudflare API (Workers/D1/KV) |
| VAULT_AUTH_TOKEN | Bearer for vault-mcp |
| MAC_MCP_AUTH_TOKEN | Secret path for mac-mcp |
| EXECUTOR_SECRET | Auth for executor.deltaops.dev |

## Local MCP Server

See [local-mcp.md](local-mcp.md) for full details.

```bash
# Verify all three services
launchctl list | grep com.osman
curl -sf http://127.0.0.1:3001/health  # server
curl -sf http://127.0.0.1:20241/ready  # tunnel
```

## Working Directories

| Purpose | Path |
|---------|------|
| Infrastructure | ~/Developer/infrastructure/ |
| Local MCP | ~/Developer/local-mcp/ |
| Dotfiles | ~/Developer/dotfiles/ |
| Archives | ~/Developer/archive/ |
| Logs | ~/logs/ |

## VM (executor.deltaops.dev)

Git uses SSH by default (`git config --global url.git@github.com:.insteadOf https://github.com/`). Key registered as `executor-vm` on GitHub. PAT retained for GitHub API calls via vault-mcp.
