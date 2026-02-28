<!-- RESUME CONTEXT
What: Mac MCP server reference — tools, services, monitoring
Why: Documents the Node.js MCP server on localhost
Next: vault-mcp.md for the Cloudflare Worker counterpart
Depends-on: architecture.md
-->
---
title: "Local MCP Server"
type: reference
status: active
date: 2026-02-27
tags: [mcp, local, server]
---

# Local MCP Server

Node.js MCP server providing Claude.ai with direct Mac access.

## Location

~/Developer/local-mcp/server.js (v3.0.0, ~837 lines)

## Tools (11)

| Tool | Purpose |
|------|---------|
| run_command | Execute shell commands |
| read_file | Read files from filesystem |
| write_file | Write files to filesystem |
| list_dir | List directory contents |
| cc_dispatch | Dispatch Claude Code agent (background) |
| cc_status | Check CC agent status |
| cc_result | Get completed CC agent output |
| cc_kill | Kill a running CC agent |
| cc_send_input | Send input to a running CC agent |
| health | Server health check |
| self_test | Run server self-diagnostics |

## Services (3 launchd plists)

| Service | Plist | Port |
|---------|-------|------|
| MCP Server | com.osman.local-mcp | 3001 |
| Cloudflare Tunnel | com.osman.mcp-tunnel | — |
| Watchdog | com.osman.mcp-watchdog | — |

## Model Discipline Enforcement

Server rejects cc_dispatch calls with `--model opus` or `--model claude-opus`. FORBIDDEN_MODELS array in server.js.

## Monitoring

```bash
# Health check
curl -sf http://127.0.0.1:3001/health | jq

# Tunnel status  
curl -sf http://127.0.0.1:20241/ready

# Logs
tail -f ~/Developer/local-mcp/mcp.log

# Restart
launchctl kickstart -k gui/$(id -u)/com.osman.local-mcp
```

## Configuration

- Token: macOS Keychain entry "local-mcp-token" (account: osman)
- Tunnel config: ~/Developer/local-mcp/cloudflared-config.yml
- Watchdog: ~/Developer/local-mcp/watchdog.sh (10s timeout)
