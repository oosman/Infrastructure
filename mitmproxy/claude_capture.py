"""mitmproxy addon: capture Claude.ai conversations to JSONL.

Intercepts streaming completions from claude.ai, extracts
user prompts and assistant responses, writes paired entries to
a local JSONL file for vault-mcp ingestion.
"""

import datetime
import json
from pathlib import Path

from mitmproxy import ctx, http

TRANSCRIPT_DIR = Path(__file__).parent / "transcripts"
JSONL_FILE = TRANSCRIPT_DIR / "claude.jsonl"
# Claude.ai web app uses claude.ai (not api.claude.ai)
TARGET_HOSTS = {"claude.ai", "www.claude.ai"}


class ClaudeCapture:
    def __init__(self):
        TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
        ctx.log.info(f"ClaudeCapture: writing transcripts to {JSONL_FILE}")

    def response(self, flow: http.HTTPFlow):
        host = flow.request.pretty_host
        if host not in TARGET_HOSTS:
            return
        if flow.request.method != "POST":
            return

        # Log all POSTs for debugging
        path = flow.request.path
        ct = flow.response.headers.get("content-type", "")
        ctx.log.info(f"ClaudeCapture: POST {host}{path} -> {ct[:60]}")

        # Capture SSE streaming responses (completions)
        if "text/event-stream" in ct:
            try:
                self._capture_sse(flow)
            except Exception as e:
                ctx.log.error(f"ClaudeCapture SSE: {e}")
            return

        # Also capture JSON responses (some endpoints return JSON)
        if "application/json" in ct:
            try:
                self._capture_json(flow)
            except Exception as e:
                ctx.log.error(f"ClaudeCapture JSON: {e}")

    def _capture_sse(self, flow: http.HTTPFlow):
        req_text = flow.request.get_text()
        if not req_text:
            return
        req_body = json.loads(req_text)
        user_prompt = self._extract_prompt(req_body)

        resp_text = flow.response.get_text()
        if not resp_text:
            return
        assistant_text = self._parse_sse(resp_text)

        if user_prompt or assistant_text:
            self._write(user_prompt, assistant_text, flow.request.path)

    def _capture_json(self, flow: http.HTTPFlow):
        """Capture non-streaming JSON responses that contain conversation data."""
        # Only capture completion-like paths
        path = flow.request.path
        if "/completion" not in path and "/chat" not in path:
            return
        req_text = flow.request.get_text()
        if not req_text:
            return
        req_body = json.loads(req_text)
        user_prompt = self._extract_prompt(req_body)
        
        resp_text = flow.response.get_text()
        if not resp_text:
            return
        resp_body = json.loads(resp_text)
        
        # Extract assistant text from JSON response
        assistant_text = ""
        content = resp_body.get("content", [])
        if isinstance(content, list):
            assistant_text = " ".join(
                b.get("text", "") for b in content
                if isinstance(b, dict) and b.get("type") == "text"
            )
        elif isinstance(resp_body.get("completion"), str):
            assistant_text = resp_body["completion"]
        
        if user_prompt or assistant_text:
            self._write(user_prompt, assistant_text, path)

    def _write(self, user_prompt: str, assistant_text: str, path: str):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        session_date = datetime.date.today().isoformat()

        with open(JSONL_FILE, "a") as f:
            if user_prompt:
                f.write(json.dumps({
                    "session_date": session_date,
                    "role": "user",
                    "content": user_prompt,
                    "path": path,
                    "created_at": now,
                }) + "\n")
            if assistant_text:
                f.write(json.dumps({
                    "session_date": session_date,
                    "role": "assistant",
                    "content": assistant_text,
                    "path": path,
                    "created_at": now,
                }) + "\n")

        ctx.log.info(
            f"ClaudeCapture: {len(user_prompt)}c prompt, "
            f"{len(assistant_text)}c response ({path})"
        )

    @staticmethod
    def _extract_prompt(body: dict) -> str:
        """Extract the user message from various Claude.ai request formats."""
        # Direct prompt field
        if isinstance(body.get("prompt"), str):
            return body["prompt"]
        # Messages array (find last user message)
        msgs = body.get("messages")
        if isinstance(msgs, list):
            for msg in reversed(msgs):
                if msg.get("role") != "user":
                    continue
                c = msg.get("content", "")
                if isinstance(c, str):
                    return c
                if isinstance(c, list):
                    return " ".join(
                        p.get("text", "") for p in c
                        if isinstance(p, dict) and p.get("type") == "text"
                    )
        return ""

    @staticmethod
    def _parse_sse(body: str) -> str:
        """Parse SSE stream and concatenate assistant text deltas."""
        chunks: list[str] = []
        for line in body.split("\n"):
            if not line.startswith("data: "):
                continue
            data = line[6:]
            if data == "[DONE]":
                break
            try:
                event = json.loads(data)
            except json.JSONDecodeError:
                continue
            etype = event.get("type", "")
            # Messages API: content_block_delta
            if etype == "content_block_delta":
                delta = event.get("delta", {})
                if delta.get("type") == "text_delta":
                    chunks.append(delta.get("text", ""))
            # Older completion format
            elif etype == "completion":
                chunks.append(event.get("completion", ""))
        return "".join(chunks)


addons = [ClaudeCapture()]
