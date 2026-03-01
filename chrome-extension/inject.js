/**
 * inject.js — MAIN world on claude.ai
 * v2: Full session capture with conversation tracking and branch detection.
 *
 * Captures: conversation_id, turn_number, full message history per request,
 * assistant response, and detects branches (edits/retries).
 */

(function () {
  "use strict";

  const STORAGE_KEY = "__claude_transcripts";
  const DEBUG_KEY = "__claude_capture_debug";
  const MAX_STORED = 2000;
  const originalFetch = window.fetch;

  if (window.__claudeCapturePatched) return;
  window.__claudeCapturePatched = true;

  // Track seen conversations: { conv_id: { turn_count, last_user_uuid, history_hashes[] } }
  const sessions = {};

  window.fetch = async function (...args) {
    const [input, init] = args;
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || "GET").toUpperCase();

    if (method !== "POST" || !isConversationEndpoint(url)) {
      return originalFetch.apply(this, args);
    }

    let reqBody = null;
    try {
      const body = init?.body;
      if (typeof body === "string") {
        reqBody = JSON.parse(body);
      }
    } catch (e) {}

    // Debug: dump raw request structure (first 3 calls only)
    if (reqBody) {
      debugLog("REQ_BODY_KEYS", {
        url: url.slice(-80),
        keys: Object.keys(reqBody),
        message_count: Array.isArray(reqBody.messages) ? reqBody.messages.length : 0,
        has_parent: !!reqBody.parent_message_uuid,
        has_conversation_id: !!reqBody.conversation_uuid,
        sample_msg_keys: Array.isArray(reqBody.messages) && reqBody.messages[0]
          ? Object.keys(reqBody.messages[0]) : [],
      });
    }

    const convId = extractConversationId(url, reqBody);
    const parentUuid = reqBody?.parent_message_uuid || null;
    const allMessages = reqBody?.messages || [];

    const response = await originalFetch.apply(this, args);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream") && response.body) {
      const [streamForApp, streamForCapture] = response.body.tee();
      captureCompletion(streamForCapture, "sse", convId, parentUuid, allMessages, url);
      return new Response(streamForApp, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    if (contentType.includes("application/json")) {
      const cloned = response.clone();
      captureCompletion(cloned, "json", convId, parentUuid, allMessages, url);
      return response;
    }

    return response;
  };

  function isConversationEndpoint(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      const host = parsed.hostname;
      if (host !== "claude.ai" && host !== "www.claude.ai") return false;
      const path = parsed.pathname;
      return (
        path.includes("/completion") ||
        path.includes("/retry_completion") ||
        (path.includes("/chat_conversations") && path.includes("/chat"))
      );
    } catch (e) {
      return false;
    }
  }

  function extractConversationId(url, body) {
    // From URL: /chat_conversations/{uuid}/completion
    const match = url.match(/chat_conversations\/([a-f0-9-]+)/);
    if (match) return match[1];
    // From body
    if (body?.conversation_uuid) return body.conversation_uuid;
    return "unknown";
  }

  async function captureCompletion(streamOrResponse, type, convId, parentUuid, allMessages, url) {
    let assistantText = "";

    if (type === "sse") {
      assistantText = await readSSEStream(streamOrResponse);
    } else {
      try {
        const body = await streamOrResponse.json();
        const content = body?.content;
        if (Array.isArray(content)) {
          assistantText = content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
        } else if (typeof body?.completion === "string") {
          assistantText = body.completion;
        }
      } catch (e) {}
    }

    // Build session state
    if (!sessions[convId]) {
      sessions[convId] = { turn_count: 0, history_hashes: [], last_msg_count: 0 };
    }
    const session = sessions[convId];

    // Detect branch: if message count decreased or parent_uuid doesn't match expected
    const prevCount = session.last_msg_count;
    const curCount = allMessages.length;
    const isBranch = curCount > 0 && prevCount > 0 && curCount < prevCount;

    session.turn_count++;
    session.last_msg_count = curCount + 1; // +1 for the assistant response we're about to add

    // Build history hash for branch detection
    const historyHash = simpleHash(allMessages.map(m => {
      const c = m.content;
      if (typeof c === "string") return c.slice(0, 100);
      if (Array.isArray(c)) return c.map(p => (p.text || "").slice(0, 50)).join("");
      return "";
    }).join("|"));

    const isBranchByHash = session.history_hashes.length > 0 &&
      !session.history_hashes.includes(historyHash) &&
      curCount <= prevCount;

    session.history_hashes.push(historyHash);

    const now = new Date().toISOString();
    const sessionDate = now.slice(0, 10);

    // Extract the new user message (last user msg in the array)
    let userPrompt = "";
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === "user") {
        userPrompt = extractText(allMessages[i].content);
        break;
      }
    }

    const entry = {
      session_date: sessionDate,
      conversation_id: convId,
      turn_number: session.turn_count,
      parent_message_uuid: parentUuid,
      is_branch: isBranch || isBranchByHash,
      history_length: curCount,
      history_hash: historyHash,
      user_content: userPrompt,
      assistant_content: assistantText,
      path: url,
      created_at: now,
    };

    // Also capture full message history on first turn or branch (for full session reconstruction)
    if (session.turn_count === 1 || isBranch || isBranchByHash) {
      entry.full_history = allMessages.map(m => ({
        role: m.role,
        content: extractText(m.content),
        uuid: m.uuid || m.id || null,
      }));
    }

    storeEntry(entry);

    console.log(
      `[ClaudeCapture] conv=${convId.slice(0, 8)} turn=${session.turn_count}` +
      ` msgs=${curCount} branch=${isBranch || isBranchByHash}` +
      ` user=${userPrompt.length}c asst=${assistantText.length}c`
    );
  }

  function extractText(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(" ");
    }
    return "";
  }

  async function readSSEStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if (delta?.type === "text_delta" && delta.text) {
                chunks.push(delta.text);
              }
            } else if (event.type === "completion" && event.completion) {
              chunks.push(event.completion);
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.debug("[ClaudeCapture] SSE read error:", e.message);
    }
    return chunks.join("");
  }

  function storeEntry(entry) {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      existing.push(entry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(-MAX_STORED)));
      window.postMessage({ type: "claude-transcript", entries: [entry] }, "*");
    } catch (e) {
      console.debug("[ClaudeCapture] store error:", e.message);
    }
  }

  function debugLog(label, data) {
    try {
      const existing = JSON.parse(localStorage.getItem(DEBUG_KEY) || "[]");
      existing.push({ label, data, ts: new Date().toISOString() });
      localStorage.setItem(DEBUG_KEY, JSON.stringify(existing.slice(-50)));
    } catch (e) {}
  }

  function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
    }
    return hash.toString(36);
  }
})();
