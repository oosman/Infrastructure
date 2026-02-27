---
title: "Mac MCP Architecture"
status: accepted
date: 2026-02-27
tags: [infrastructure, mcp, local]
supersedes: null
---

# ADR-0004: Mac MCP Architecture

## Context
Need Claude.ai to execute commands on local Mac — file ops, CC dispatch, shell commands — via MCP protocol.

## Decision
Custom Node.js MCP server (server.js, ~837 lines) on localhost:3001 with Cloudflare Tunnel. 11 tools including cc_dispatch/status/result/kill. Launchd-managed with watchdog for auto-recovery. Server enforces model discipline (rejects opus dispatch).

## Consequences
- ✅ Claude.ai has direct local machine access
- ✅ CC agents dispatched from conversations without SSH
- ✅ Watchdog ensures zero-downtime (previously crashed 3x/day, now 0)
- ⚠️ Single point of failure — if Mac sleeps, MCP is down
- ⚠️ Tunnel latency adds ~200-500ms per tool call
