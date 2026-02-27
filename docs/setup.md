---
title: "Setup Guide"
type: how-to
status: active
date: 2026-02-27
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

All Claude config lives in ~/dotfiles/claude/ and is symlinked:

```bash
ls -la ~/.claude/  # Should show symlinks → ~/dotfiles/claude/
```

Key symlinked items: CLAUDE.md, commands/, contexts/, hooks/, scripts/, settings.json.

## Secrets

Managed via macOS Keychain (account: osman):

```bash
# Check all secrets
python3 ~/dotfiles/claude/scripts/secrets.py

# Add a new secret
security add-generic-password -a "osman" -s "KEY_NAME" -w "value" -U

# Regenerate exports
python3 ~/dotfiles/claude/scripts/secrets.py  # writes ~/.claude/secrets-env.sh
```

## Local MCP Server

See docs/local-mcp.md for full details.

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
| Projects | ~/Developer/projects/ |
| Archives | ~/Developer/archive/ |
| Dotfiles | ~/dotfiles/ |
