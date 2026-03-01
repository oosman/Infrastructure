#!/usr/bin/env python3
"""
Native messaging host: dev.deltaops.claude_capture

Receives JSON messages from the Chrome extension (Chrome native messaging
protocol: 4-byte little-endian length prefix + UTF-8 JSON), appends each
transcript entry as a JSONL line, and returns a status response.

Output file: {repo_root}/mitmproxy/transcripts/claude.jsonl
Log file:    {repo_root}/mitmproxy/transcripts/native-host.log
"""

import json
import logging
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
TRANSCRIPTS_DIR = REPO_ROOT / "mitmproxy" / "transcripts"
JSONL_FILE = TRANSCRIPTS_DIR / "claude.jsonl"
LOG_FILE = TRANSCRIPTS_DIR / "native-host.log"

# ── Logging (to file only — stdout is the native messaging channel) ──────────

TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("native-host")


# ── Native messaging protocol ────────────────────────────────────────────────

def read_message() -> dict | None:
    """Read one length-prefixed JSON message from stdin."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length or len(raw_length) < 4:
        return None
    (length,) = struct.unpack("=I", raw_length)
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode("utf-8"))


def send_message(msg: dict) -> None:
    """Write one length-prefixed JSON message to stdout."""
    encoded = json.dumps(msg, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("native-host started")
    try:
        msg = read_message()
    except Exception as e:
        log.error("Failed to read message: %s", e)
        send_message({"status": "error", "reason": f"read error: {e}"})
        return

    if not msg:
        log.warning("Empty message received")
        send_message({"status": "error", "reason": "empty message"})
        return

    entries = msg.get("entries", [])
    if not isinstance(entries, list):
        send_message({"status": "error", "reason": "entries must be a list"})
        return

    if not entries:
        send_message({"status": "ok", "written": 0})
        return

    count = 0
    try:
        TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
        with open(JSONL_FILE, "a", encoding="utf-8") as f:
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                # Ensure created_at is set
                if "created_at" not in entry:
                    entry["created_at"] = datetime.now(timezone.utc).isoformat()
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
                count += 1
        log.info("Wrote %d entries to %s", count, JSONL_FILE)
        send_message({"status": "ok", "written": count})
    except Exception as e:
        log.error("Write failed: %s", e)
        send_message({"status": "error", "reason": str(e)})


if __name__ == "__main__":
    main()
