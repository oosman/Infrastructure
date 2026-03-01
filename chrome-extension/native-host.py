#!/usr/bin/env python3
"""Native messaging host: receives transcript entries from Chrome extension,
appends to JSONL file for vault-mcp ingestion."""

import json
import struct
import sys
from pathlib import Path

JSONL_FILE = Path(__file__).parent.parent / "mitmproxy" / "transcripts" / "claude.jsonl"

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    length = struct.unpack("=I", raw_length)[0]
    data = sys.stdin.buffer.read(length)
    return json.loads(data)

def send_message(msg):
    encoded = json.dumps(msg).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def main():
    msg = read_message()
    if not msg or "entries" not in msg:
        send_message({"status": "error", "reason": "no entries"})
        return
    
    JSONL_FILE.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with open(JSONL_FILE, "a") as f:
        for entry in msg["entries"]:
            f.write(json.dumps(entry) + "\n")
            count += 1
    
    send_message({"status": "ok", "written": count})

if __name__ == "__main__":
    main()
