---
title: "ADR-0029: Claude CLI --strict-mcp-config Workaround"
status: accepted
date: 2026-02-28
tags: [executor, cli, bug-workaround]
---

# ADR-0029: Claude CLI --strict-mcp-config Workaround

## Context

The executor on the Lightsail VM spawns Claude Code CLI to execute tasks. The `--strict-mcp-config` flag was intended to prevent the CLI from loading account-level MCP servers (Gmail, Calendar, etc.), reducing startup latency and avoiding connection errors.

## Problem

Claude Code CLI versions 2.1.55 through 2.1.63 have a bug where passing `--strict-mcp-config` with `--mcp-config "{}"` causes the CLI to silently exit with code 0 and no output. Debug logs show the CLI initializes (auth, git, configs) but never makes an API request. Without the flag, the CLI works correctly — loads MCP servers in ~2s, then completes the request normally.

## Decision

Remove `--strict-mcp-config` and `--mcp-config "{}"` from the executor's Claude CLI spawn args. Accept the ~2s MCP server loading overhead.

## Consequences

- CLI works reliably on the VM
- ~2s startup overhead per execution (MCP server connections, some fail with auth errors but CLI handles gracefully)
- If a future CLI version fixes this bug, the flags can be re-added to save ~2s
- Gemini CLI does not support these flags, so removing them also simplifies executor code
