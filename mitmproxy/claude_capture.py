"""mitmproxy addon: capture Claude.ai conversations to JSONL.

Intercepts streaming completions from api.claude.ai, extracts
user prompts and assistant responses, writes paired entries to
a local JSONL file for vault-mcp ingestion.
"""

import datetime
import json
from pathlib import Path

from mitmproxy import ctx, http

TRANSCRIPT_DIR = Path(__file__).parent / "transcripts"
JSONL_FILE = TRANSCRIPT_DIR / "claude.jsonl"
TARGET_HOST = "api.claude.ai"


class ClaudeCapture:
    def __init__(self):
        TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
        ctx.log.info(f"ClaudeCapture: writing transcripts to {JSONL_FILE}")

    def response(self, flow: http.HTTPFlow):
        if flow.request.pretty_host != TARGET_HOST:
            return
        if flow.request.method != "POST":
            return
        # Only capture SSE streaming responses (completions)
        ct = flow.response.headers.get("content-type", "")
        if "text/event-stream" not in ct:
            return
        try:
            self._capture(flow)
        except Exception as e:
            ctx.log.error(f"ClaudeCapture: {e}")

    def _capture(self, flow: http.HTTPFlow):
        # Extract user prompt from request body
        req_text = flow.request.get_text()
        if not req_text:
            return
        req_body = json.loads(req_text)
        user_prompt = self._extract_prompt(req_body)
        if not user_prompt:
            return

        # Extract assistant response from SSE stream
        resp_text = flow.response.get_text()
        if not resp_text:
            return
        assistant_text = self._parse_sse(resp_text)
        if not assistant_text:
            return

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        session_date = datetime.date.today().isoformat()

        with open(JSONL_FILE, "a") as f:
            for role, content in [("user", user_prompt), ("assistant", assistant_text)]:
                f.write(json.dumps({
                    "session_date": session_date,
                    "role": role,
                    "content": content,
                    "created_at": now,
                }) + "\n")

        ctx.log.info(
            f"ClaudeCapture: {len(user_prompt)}c prompt, "
            f"{len(assistant_text)}c response"
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
            # Messages API: content_block_delta
            if event.get("type") == "content_block_delta":
                delta = event.get("delta", {})
                if delta.get("type") == "text_delta":
                    chunks.append(delta.get("text", ""))
            # Older completion format
            elif event.get("type") == "completion":
                chunks.append(event.get("completion", ""))
        return "".join(chunks)


addons = [ClaudeCapture()]
