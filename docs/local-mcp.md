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
date: 2026-02-28
tags: [mcp, local, server]
---

# Local MCP Server

Node.js MCP server providing Claude.ai with direct Mac access via Streamable HTTP.

## Location

~/Developer/local-mcp/server.js (v3.1.0)

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
| health_check | Diagnostic info (uptime, versions, tunnel, memory) |
| search_files | Search for text patterns in files (grep + glob) |
| notify | Send macOS notification via osascript |

## Auth

- **Claude.ai:** Secret path segment in URL (`https://mac-mcp.deltaops.dev/{MAC_MCP_AUTH_TOKEN}/mcp`)
- **CC/scripts:** Bearer token in Authorization header
- Token: MAC_MCP_AUTH_TOKEN in macOS Keychain (account: osman)

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

- Tunnel config: ~/Developer/local-mcp/cloudflared-config.yml
- Watchdog: ~/Developer/local-mcp/watchdog.sh (10s health check interval)
- SDK: @modelcontextprotocol/sdk pinned to 1.17.3
