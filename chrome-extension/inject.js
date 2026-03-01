/**
 * inject.js — runs in MAIN world on claude.ai
 * Monkey-patches fetch() to passively capture conversation traffic.
 * Uses ReadableStream.tee() so streaming is never interrupted.
 */

(function () {
  "use strict";

  const MAX_STORED = 500;
  const STORAGE_KEY = "__claude_transcripts";
  const originalFetch = window.fetch;

  if (window.__claudeCapturePatched) return;
  window.__claudeCapturePatched = true;

  window.fetch = async function (...args) {
    const [input, init] = args;
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || "GET").toUpperCase();

    // ONLY intercept POSTs to claude.ai conversation endpoints
    if (method !== "POST" || !isConversationEndpoint(url)) {
      return originalFetch.apply(this, args);
    }

    let userPrompt = "";
    try {
      const body = init?.body;
      if (typeof body === "string") {
        userPrompt = extractPrompt(JSON.parse(body));
      }
    } catch (e) {}

    const response = await originalFetch.apply(this, args);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream") && response.body) {
      const [streamForApp, streamForCapture] = response.body.tee();
      captureSSEStream(streamForCapture, userPrompt, url);
      return new Response(streamForApp, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    if (contentType.includes("application/json")) {
      const cloned = response.clone();
      captureJSONResponse(cloned, userPrompt, url);
      return response;
    }

    return response;
  };

  function isConversationEndpoint(url) {
    // STRICT: only match claude.ai completion/chat endpoints
    // Do NOT match statsig, intercom, or other third-party domains
    try {
      const parsed = new URL(url, window.location.origin);
      const host = parsed.hostname;
      // Must be claude.ai — not statsig, intercom, etc.
      if (host !== "claude.ai" && host !== "www.claude.ai") return false;
      const path = parsed.pathname;
      return (
        path.includes("/completion") ||
        path.includes("/chat_conversations") ||
        path.includes("/retry_completion") ||
        (path.includes("/organizations/") && path.includes("/chat"))
      );
    } catch (e) {
      return false;
    }
  }

  function extractPrompt(body) {
    if (typeof body?.prompt === "string") return body.prompt;
    const msgs = body?.messages;
    if (Array.isArray(msgs)) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role !== "user") continue;
        const c = msgs[i].content;
        if (typeof c === "string") return c;
        if (Array.isArray(c)) {
          return c.filter((p) => p.type === "text").map((p) => p.text).join(" ");
        }
      }
    }
    return "";
  }

  async function captureSSEStream(stream, userPrompt, url) {
    try {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const chunks = [];

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

      const assistantText = chunks.join("");
      if (userPrompt || assistantText) {
        storeTranscript(userPrompt, assistantText, url);
      }
    } catch (e) {
      console.debug("[ClaudeCapture] SSE error:", e.message);
    }
  }

  async function captureJSONResponse(response, userPrompt, url) {
    try {
      const body = await response.json();
      let assistantText = "";
      const content = body?.content;
      if (Array.isArray(content)) {
        assistantText = content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
      } else if (typeof body?.completion === "string") {
        assistantText = body.completion;
      }
      if (userPrompt || assistantText) {
        storeTranscript(userPrompt, assistantText, url);
      }
    } catch (e) {}
  }

  function storeTranscript(userPrompt, assistantText, url) {
    try {
      const now = new Date().toISOString();
      const sessionDate = now.slice(0, 10);
      const entries = [];

      if (userPrompt) {
        entries.push({ session_date: sessionDate, role: "user", content: userPrompt, path: url, created_at: now });
      }
      if (assistantText) {
        entries.push({ session_date: sessionDate, role: "assistant", content: assistantText, path: url, created_at: now });
      }

      // Store in localStorage (readable by both worlds)
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      existing.push(...entries);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(-MAX_STORED)));

      // Post to window for bridge.js pickup
      window.postMessage({ type: "claude-transcript", entries }, "*");

      console.log(`[ClaudeCapture] ${userPrompt.length}c prompt, ${assistantText.length}c response`);
    } catch (e) {
      console.debug("[ClaudeCapture] store error:", e.message);
    }
  }
})();
