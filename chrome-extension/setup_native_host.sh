#!/usr/bin/env bash
# setup_native_host.sh — Install the native messaging host manifest for Chrome.
#
# Usage:
#   ./setup_native_host.sh <extension_id>
#
# Get the extension ID from chrome://extensions after loading the unpacked extension.
# Example:
#   ./setup_native_host.sh abcdefghijklmnopabcdefghijklmnop

set -euo pipefail

EXTENSION_ID="${1:-}"
if [[ -z "$EXTENSION_ID" ]]; then
  echo "Usage: $0 <extension_id>"
  echo ""
  echo "1. Load the unpacked extension at chrome://extensions"
  echo "2. Copy the extension ID shown there"
  echo "3. Re-run: $0 <that_id>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NATIVE_HOST_SCRIPT="$SCRIPT_DIR/native-host.py"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

# Make the native host executable
chmod +x "$NATIVE_HOST_SCRIPT"

# Verify Python3 is available
PYTHON_PATH="$(command -v python3)"
if [[ -z "$PYTHON_PATH" ]]; then
  echo "Error: python3 not found in PATH"
  exit 1
fi

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/dev.deltaops.claude_capture.json" << EOF
{
  "name": "dev.deltaops.claude_capture",
  "description": "Claude Transcript Capture native messaging host",
  "path": "$NATIVE_HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "✓ Native messaging manifest installed:"
echo "  $MANIFEST_DIR/dev.deltaops.claude_capture.json"
echo ""
echo "✓ Host script: $NATIVE_HOST_SCRIPT"
echo ""
echo "Next steps:"
echo "  1. Reload the extension at chrome://extensions"
echo "  2. Navigate to claude.ai and open DevTools → Console"
echo "  3. Look for: [ClaudeCapture] inject.js v2 loaded"
echo "  4. Send a message — check mitmproxy/transcripts/claude.jsonl"
