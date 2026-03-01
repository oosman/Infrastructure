#!/usr/bin/env bash
# Ingest Chrome extension JSONL transcripts into vault-mcp D1.
# Handles v1 (role/content) and v2 (user_content/assistant_content + metadata) formats.
# Tracks progress via .cursor file. Archives after successful ingest.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JSONL_FILE="$SCRIPT_DIR/transcripts/claude.jsonl"
CURSOR_FILE="$SCRIPT_DIR/transcripts/.cursor"
ARCHIVE_DIR="$SCRIPT_DIR/transcripts/archive"
VAULT_URL="https://vault.deltaops.dev/transcripts"
BATCH_SIZE=50
MAX_RETRIES=3
RETRY_DELAY=2

# --- Auth ---
VAULT_TOKEN="$(security find-generic-password -a "osman" -s "VAULT_AUTH_TOKEN" -w 2>/dev/null)" || {
    echo "$(date -Iseconds) ERROR: VAULT_AUTH_TOKEN not found in Keychain" >&2
    exit 1
}

# --- Guards ---
if [[ ! -f "$JSONL_FILE" ]]; then
    exit 0
fi

line_count=$(wc -l < "$JSONL_FILE" | tr -d ' ')
if [[ "$line_count" -eq 0 ]]; then
    exit 0
fi

# --- Cursor ---
cursor=0
if [[ -f "$CURSOR_FILE" ]]; then
    cursor=$(cat "$CURSOR_FILE" | tr -d ' \n')
    [[ "$cursor" =~ ^[0-9]+$ ]] || cursor=0
fi

remaining=$((line_count - cursor))
if [[ "$remaining" -le 0 ]]; then
    mkdir -p "$ARCHIVE_DIR"
    ts=$(date +%Y%m%d-%H%M%S)
    mv "$JSONL_FILE" "$ARCHIVE_DIR/claude-${ts}.jsonl"
    rm -f "$CURSOR_FILE"
    echo "$(date -Iseconds) INFO: Archived to archive/claude-${ts}.jsonl"
    exit 0
fi

echo "$(date -Iseconds) INFO: Ingesting $remaining lines (cursor=$cursor, total=$line_count)"

# --- Ingest ---
ingested=0
batch_start=$((cursor + 1))

while [[ $batch_start -le $line_count ]]; do
    batch_end=$((batch_start + BATCH_SIZE - 1))
    [[ $batch_end -gt $line_count ]] && batch_end=$line_count

    # Pass through full entries — vault-mcp handles v1/v2 format detection
    entries=$(sed -n "${batch_start},${batch_end}p" "$JSONL_FILE" | jq -s '.' 2>/dev/null)

    if [[ -z "$entries" || "$entries" == "[]" ]]; then
        batch_start=$((batch_end + 1))
        continue
    fi

    payload=$(jq -n --argjson e "$entries" '{ entries: $e }')

    attempt=0
    success=false
    while [[ $attempt -lt $MAX_RETRIES ]]; do
        http_code=$(curl -s -o /tmp/ingest-response.json -w '%{http_code}' \
            --max-time 30 \
            -X POST "$VAULT_URL" \
            -H "Authorization: Bearer $VAULT_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$payload" 2>/dev/null) || http_code=000

        if [[ "$http_code" =~ ^2 ]]; then
            batch_inserted=$(jq -r '.inserted // 0' /tmp/ingest-response.json 2>/dev/null || echo 0)
            ingested=$((ingested + batch_inserted))
            success=true
            break
        fi

        attempt=$((attempt + 1))
        if [[ $attempt -lt $MAX_RETRIES ]]; then
            sleep $((RETRY_DELAY * attempt))
        fi
    done

    if [[ "$success" != "true" ]]; then
        echo "$((batch_start - 1))" > "$CURSOR_FILE"
        echo "$(date -Iseconds) ERROR: Failed at lines $batch_start-$batch_end (HTTP $http_code)" >&2
        exit 1
    fi

    echo "$batch_end" > "$CURSOR_FILE"
    batch_start=$((batch_end + 1))
done

echo "$(date -Iseconds) INFO: Ingested $ingested entries from $remaining lines"

mkdir -p "$ARCHIVE_DIR"
ts=$(date +%Y%m%d-%H%M%S)
mv "$JSONL_FILE" "$ARCHIVE_DIR/claude-${ts}.jsonl"
rm -f "$CURSOR_FILE"
echo "$(date -Iseconds) INFO: Archived to archive/claude-${ts}.jsonl"
rm -f /tmp/ingest-response.json
