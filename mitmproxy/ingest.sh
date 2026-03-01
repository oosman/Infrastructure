#!/usr/bin/env bash
# Ingest mitmproxy JSONL transcripts into vault-mcp D1 via POST /transcripts.
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
    echo "$(date -Iseconds) INFO: No JSONL file at $JSONL_FILE — nothing to ingest"
    exit 0
fi

line_count=$(wc -l < "$JSONL_FILE" | tr -d ' ')
if [[ "$line_count" -eq 0 ]]; then
    echo "$(date -Iseconds) INFO: JSONL file is empty — nothing to ingest"
    exit 0
fi

# --- Cursor: resume from last-ingested line ---
cursor=0
if [[ -f "$CURSOR_FILE" ]]; then
    cursor=$(cat "$CURSOR_FILE" | tr -d ' \n')
    # Validate it's a number
    if ! [[ "$cursor" =~ ^[0-9]+$ ]]; then
        cursor=0
    fi
fi

remaining=$((line_count - cursor))
if [[ "$remaining" -le 0 ]]; then
    echo "$(date -Iseconds) INFO: All $line_count lines already ingested (cursor=$cursor)"
    # Archive since everything is ingested
    _archive_jsonl() {
        mkdir -p "$ARCHIVE_DIR"
        local ts
        ts=$(date +%Y%m%d-%H%M%S)
        mv "$JSONL_FILE" "$ARCHIVE_DIR/claude-${ts}.jsonl"
        rm -f "$CURSOR_FILE"
        echo "$(date -Iseconds) INFO: Archived to archive/claude-${ts}.jsonl"
    }
    _archive_jsonl
    exit 0
fi

echo "$(date -Iseconds) INFO: Ingesting $remaining lines (cursor=$cursor, total=$line_count)"

# --- Ingest in batches ---
ingested=0
errors=0
batch_start=$((cursor + 1))

while [[ $batch_start -le $line_count ]]; do
    batch_end=$((batch_start + BATCH_SIZE - 1))
    if [[ $batch_end -gt $line_count ]]; then
        batch_end=$line_count
    fi

    # Build JSON entries array from JSONL lines
    entries=$(sed -n "${batch_start},${batch_end}p" "$JSONL_FILE" | jq -s '
        [.[] | {
            session_date: .session_date,
            role: .role,
            content: .content
        }]
    ' 2>/dev/null)

    if [[ -z "$entries" || "$entries" == "[]" ]]; then
        echo "$(date -Iseconds) WARN: Empty batch at lines $batch_start-$batch_end, skipping"
        batch_start=$((batch_end + 1))
        continue
    fi

    payload=$(jq -n --argjson e "$entries" '{ entries: $e }')

    # POST with retry + backoff
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
            delay=$((RETRY_DELAY * attempt))
            echo "$(date -Iseconds) WARN: HTTP $http_code on batch $batch_start-$batch_end, retry $attempt in ${delay}s"
            sleep "$delay"
        fi
    done

    if [[ "$success" != "true" ]]; then
        echo "$(date -Iseconds) ERROR: Failed batch $batch_start-$batch_end after $MAX_RETRIES attempts (HTTP $http_code)" >&2
        response_body=$(cat /tmp/ingest-response.json 2>/dev/null || echo "no response")
        echo "$(date -Iseconds) ERROR: Response: $response_body" >&2
        errors=$((errors + 1))
        # Update cursor to last successful batch and exit
        echo "$((batch_start - 1))" > "$CURSOR_FILE"
        echo "$(date -Iseconds) ERROR: Stopping. Cursor saved at $((batch_start - 1)). Ingested $ingested lines." >&2
        exit 1
    fi

    # Update cursor after each successful batch
    echo "$batch_end" > "$CURSOR_FILE"
    batch_start=$((batch_end + 1))
done

echo "$(date -Iseconds) INFO: Ingested $ingested entries from $remaining lines"

# --- Archive successfully ingested file ---
if [[ $errors -eq 0 ]]; then
    mkdir -p "$ARCHIVE_DIR"
    ts=$(date +%Y%m%d-%H%M%S)
    mv "$JSONL_FILE" "$ARCHIVE_DIR/claude-${ts}.jsonl"
    rm -f "$CURSOR_FILE"
    echo "$(date -Iseconds) INFO: Archived to archive/claude-${ts}.jsonl"
fi

rm -f /tmp/ingest-response.json
