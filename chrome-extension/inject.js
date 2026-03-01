/**
 * inject.js — MAIN world content script on claude.ai
 *
 * Monkey-patches fetch() to passively capture full conversation transcripts.
 * Uses ReadableStream.tee() so SSE streaming is NEVER interrupted.
 *
 * JSONL entry per turn:
 * {
 *   session_date, conversation_id, turn_number, is_branch, history_length,
 *   user_content, assistant_content, [full_history], created_at
 * }
 * full_history included on turn 1 and on any branch; omitted otherwise.
 */
(function () {
  "use strict";

  if (window.__claudeCapturePatched) return;
  window.__claudeCapturePatched = true;

  console.log("[ClaudeCapture] inject.js v2 loaded");
  _debugSet({ loaded: true, ts: new Date().toISOString() });

  const originalFetch = window.fetch;

  // Per-conversation tracking: conv_id → { turn_number, history_length, last_parent_uuid }
  const convState = Object.create(null);

  window.fetch = async function (...args) {
    const [input, init] = args;
    const url = typeof input === "string" ? input : input?.url ?? "";
    const method = (init?.method || "GET").toUpperCase();

    if (method !== "POST" || !isCompletionEndpoint(url)) {
      return originalFetch.apply(this, args);
    }

    console.log("[ClaudeCapture] Intercepting POST:", url);

    // ── Parse request body ────────────────────────────────────────────────────
    let requestData = {};
    try {
      const body = init?.body;
      if (typeof body === "string") {
        requestData = JSON.parse(body);
      } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        requestData = JSON.parse(new TextDecoder().decode(body));
      }
    } catch (e) {
      console.debug("[ClaudeCapture] Could not parse request body:", e.message);
    }

    // ── Extract conversation metadata ─────────────────────────────────────────
    const conversationId = extractConversationId(url);
    const messages = extractMessages(requestData);
    const userContent = extractLastUserContent(messages);
    const historyLength = messages.length;
    const parentUuid = requestData?.parent_message_uuid ?? null;

    // ── Branch / edit detection ───────────────────────────────────────────────
    const prev = convState[conversationId] ?? { turn_number: 0, history_length: 0, last_parent_uuid: null };
    const isBranch =
      prev.turn_number > 0 &&
      (historyLength < prev.history_length || (parentUuid !== null && parentUuid !== prev.last_parent_uuid));

    const turnNumber = prev.turn_number + 1;
    convState[conversationId] = { turn_number: turnNumber, history_length: historyLength, last_parent_uuid: parentUuid };

    const includeFullHistory = turnNumber === 1 || isBranch;

    console.log(
      `[ClaudeCapture] conv=${conversationId.slice(0, 8)}… turn=${turnNumber} branch=${isBranch} ` +
      `history=${historyLength} user="${userContent.slice(0, 60)}…"`
    );

    // ── Perform the real fetch ────────────────────────────────────────────────
    let response;
    try {
      response = await originalFetch.apply(this, args);
    } catch (networkErr) {
      throw networkErr;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream") && response.body) {
      const [streamForApp, streamForCapture] = response.body.tee();

      // Capture async — never block the app stream
      captureSSEStream(streamForCapture, {
        conversationId,
        turnNumber,
        isBranch,
        historyLength,
        userContent,
        fullHistory: includeFullHistory ? messages : null,
      });

      return new Response(streamForApp, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function isCompletionEndpoint(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      const host = parsed.hostname;
      // Strict: only claude.ai or *.claude.ai — never statsig, intercom, etc.
      if (host !== "claude.ai" && !host.endsWith(".claude.ai")) return false;
      const path = parsed.pathname;
      return (
        /\/chat_conversations\/[\w-]+\/completion$/.test(path) ||
        /\/chat_conversations\/[\w-]+\/retry_completion$/.test(path)
      );
    } catch (e) {
      return false;
    }
  }

  function extractConversationId(url) {
    try {
      const m = url.match(/\/chat_conversations\/([\w-]+)\//);
      return m ? m[1] : "unknown";
    } catch (e) {
      return "unknown";
    }
  }

  /** Handle both messages-array format and legacy Human:/Assistant: prompt format. */
  function extractMessages(body) {
    if (Array.isArray(body?.messages) && body.messages.length > 0) {
      return body.messages.map(normalizeMessage);
    }
    if (typeof body?.prompt === "string" && body.prompt.length > 0) {
      return parsePromptFormat(body.prompt);
    }
    return [];
  }

  function normalizeMessage(msg) {
    const role = msg.role === "human" ? "user" : msg.role;
    const content = contentToText(msg.content);
    return { role, content };
  }

  function contentToText(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("\n");
    }
    return String(content ?? "");
  }

  function parsePromptFormat(prompt) {
    const messages = [];
    // Split on double-newline before role markers
    const parts = prompt.split(/(?=\n\nHuman:|\n\nAssistant:)/);
    for (const part of parts) {
      const trimmed = part.replace(/^\n+/, "");
      if (trimmed.startsWith("Human:")) {
        messages.push({ role: "user", content: trimmed.slice(6).trim() });
      } else if (trimmed.startsWith("Assistant:")) {
        messages.push({ role: "assistant", content: trimmed.slice(10).trim() });
      }
    }
    return messages;
  }

  function extractLastUserContent(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content ?? "";
    }
    return "";
  }

  // ── SSE capture ─────────────────────────────────────────────────────────────

  async function captureSSEStream(stream, meta) {
    const chunks = [];
    try {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop(); // keep incomplete line
        for (const line of lines) {
          processSSELine(line, chunks);
        }
      }
      // Flush remaining buffer
      if (buf) processSSELine(buf, chunks);
    } catch (e) {
      console.warn("[ClaudeCapture] SSE read error:", e.message);
    }

    const assistantContent = chunks.join("");
    const now = new Date().toISOString();

    const entry = {
      session_date: now.slice(0, 10),
      conversation_id: meta.conversationId,
      turn_number: meta.turnNumber,
      is_branch: meta.isBranch,
      history_length: meta.historyLength,
      user_content: meta.userContent,
      assistant_content: assistantContent,
      created_at: now,
    };

    if (meta.fullHistory) {
      entry.full_history = meta.fullHistory;
    }

    console.log(
      `[ClaudeCapture] Captured turn=${meta.turnNumber} ` +
      `assistant=${assistantContent.length}c branch=${meta.isBranch}`
    );
    _debugSet({ last_entry: { ...entry, full_history: entry.full_history ? `[${entry.full_history.length} msgs]` : undefined }, ts: now });

    // Send to ISOLATED world via postMessage (CustomEvent does NOT cross worlds in MV3)
    window.postMessage({ type: "claude-transcript-v2", entry }, "*");
  }

  function processSSELine(line, chunks) {
    if (!line.startsWith("data: ")) return;
    const data = line.slice(6).trim();
    if (data === "[DONE]") return;
    try {
      const event = JSON.parse(data);
      // Anthropic streaming format
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        chunks.push(event.delta.text ?? "");
      } else if (event.type === "completion" && typeof event.completion === "string") {
        // Legacy format
        chunks.push(event.completion);
      } else if (typeof event.delta?.text === "string") {
        chunks.push(event.delta.text);
      }
    } catch (e) {
      // Non-JSON data line — skip
    }
  }

  // ── Debug helper ─────────────────────────────────────────────────────────────

  function _debugSet(obj) {
    try {
      localStorage.setItem("__claude_capture_debug", JSON.stringify(obj));
    } catch (e) {}
  }
})();
