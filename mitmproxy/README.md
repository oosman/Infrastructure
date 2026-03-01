# mitmproxy Claude.ai Transcript Capture

Captures Claude.ai conversations via mitmproxy and stores them as JSONL
for vault-mcp search ingestion.

## Prerequisites

```bash
brew install mitmproxy   # already installed if mitmdump is on PATH
which mitmdump           # verify: /opt/homebrew/bin/mitmdump
```

## Setup

### 1. Trust the mitmproxy CA certificate

mitmproxy generates a CA cert on first run. It must be trusted by macOS
for HTTPS interception to work.

```bash
# Run mitmdump once to generate certs (Ctrl-C after it starts)
mitmdump

# Install the CA cert into the system keychain
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  ~/.mitmproxy/mitmproxy-ca-cert.pem
```

### 2. Configure macOS system proxy

Open **System Settings > Network > Wi-Fi > Details > Proxies**, then:

- Enable **Web Proxy (HTTP)**: `127.0.0.1`, port `8080`
- Enable **Secure Web Proxy (HTTPS)**: `127.0.0.1`, port `8080`

Or via CLI:

```bash
# Find your active network service name
networksetup -listallnetworkservices

# Set proxy (replace "Wi-Fi" with your service name)
networksetup -setwebproxy "Wi-Fi" 127.0.0.1 8080
networksetup -setsecurewebproxy "Wi-Fi" 127.0.0.1 8080
```

> **Note**: The `allow_hosts` option in the plist ensures only `api.claude.ai`
> traffic is intercepted. All other HTTPS traffic passes through untouched
> (no cert spoofing).

### 3. Install the launchd service

```bash
cp com.osman.mitmproxy.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.osman.mitmproxy.plist
```

## Verify

```bash
# Check service is running
launchctl list | grep com.osman.mitmproxy

# Check logs
tail -f ~/logs/mitmproxy.log

# After using Claude.ai, check for captured transcripts
cat mitmproxy/transcripts/claude.jsonl | python3 -m json.tool --no-ensure-ascii
```

## Stop / Restart

```bash
# Stop
launchctl unload ~/Library/LaunchAgents/com.osman.mitmproxy.plist

# Restart
launchctl unload ~/Library/LaunchAgents/com.osman.mitmproxy.plist
launchctl load ~/Library/LaunchAgents/com.osman.mitmproxy.plist

# Disable system proxy when not needed
networksetup -setwebproxystate "Wi-Fi" off
networksetup -setsecurewebproxystate "Wi-Fi" off
```

## Transcript Format

Each line in `transcripts/claude.jsonl` is a JSON object:

```json
{"session_date": "2026-02-28", "role": "user", "content": "...", "created_at": "..."}
{"session_date": "2026-02-28", "role": "assistant", "content": "...", "created_at": "..."}
```

## Vault-mcp Ingestion

To push transcripts into vault-mcp's D1 search index:

```bash
TOKEN=$(security find-generic-password -a "osman" -s "VAULT_AUTH_TOKEN" -w)

# Convert JSONL to the entries array format
jq -s '{entries: .}' transcripts/claude.jsonl | \
  curl -s -X POST https://vault.deltaops.dev/transcripts \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @-
```

Then searchable via vault-mcp's `search(query)` tool.
