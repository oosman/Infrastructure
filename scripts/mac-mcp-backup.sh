#!/bin/bash
# mac-mcp backup access — use when Claude.ai MCP is broken
# Token: stored in launchd plist env var MAC_MCP_AUTH_TOKEN
# Usage: mac-mcp-backup.sh <tool> [args...]

TOKEN="8495d98d47d6631c15331ac2934495b6a5bd3a3506ed4e7f1b2f138112cb8014"
URL="https://mac-mcp.deltaops.dev/mcp"

case "${1:-help}" in
  health)
    curl -s https://mac-mcp.deltaops.dev/health | python3 -m json.tool
    ;;
  tools)
    curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | python3 -m json.tool
    ;;
  run)
    shift
    CMD="$*"
    curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"run_command\",\"arguments\":{\"command\":$(echo "$CMD" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')}},\"id\":1}" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('result',{}).get('content',[{}])[0].get('text','no output'))" 2>/dev/null
    ;;
  read)
    curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"read_file\",\"arguments\":{\"path\":\"$2\"}},\"id\":1}" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('result',{}).get('content',[{}])[0].get('text','no output'))" 2>/dev/null
    ;;
  help|*)
    echo "mac-mcp backup access script"
    echo "Usage:"
    echo "  $0 health          — check server health"
    echo "  $0 tools           — list available MCP tools"
    echo "  $0 run <command>   — execute shell command"
    echo "  $0 read <path>     — read a file"
    echo ""
    echo "Token stored in launchd plist. Update via:"
    echo "  vim ~/Library/LaunchAgents/com.osman.local-mcp.plist"
    ;;
esac
