/**
 * inject.js — runs in MAIN world on claude.ai
 * Monkey-patches fetch() to passively capture conversation traffic.
 * Uses ReadableStream.tee() so streaming is never interrupted.
 */

(function () {
  "use strict";

  const CAPTURE_KEY = "__claude_transcripts";
  const MAX_STORED = 500; // max transcript pairs in localStorage
  const originalFetch = window.fetch;

  // Only patch once
  if (window.__claudeCapturePatched) return;
  window.__claudeCapturePatched = true;

  window.fetch = async function (...args) {
    const [input, init] = args;
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || "GET").toUpperCase();

    // Only intercept POSTs to conversation/completion endpoints
    if (method !== "POST" || !isConversationEndpoint(url)) {
      return originalFetch.apply(this, args);
    }

    // Extract user prompt from request body
    let userPrompt = "";
    try {
      const body = init?.body;
      if (typeof body === "string") {
        userPrompt = extractPrompt(JSON.parse(body));
      }
    } catch (e) {
      // body might not be JSON
    }

    const response = await originalFetch.apply(this, args);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream") && response.body) {
      // SSE stream — tee it so Claude.ai gets uninterrupted streaming
      const [streamForApp, streamForCapture] = response.body.tee();

      // Capture in background, don't await
      captureSSEStream(streamForCapture, userPrompt, url);

      // Return cloned response with the app's stream
      return new Response(streamForApp, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    if (contentType.includes("application/json")) {
      // JSON response — clone and capture
      const cloned = response.clone();
      captureJSONResponse(cloned, userPrompt, url);
      return response;
    }

    return response;
  };

  function isConversationEndpoint(url) {
    // Match Claude.ai conversation/chat/completion endpoints
    return (
      url.includes("/api/") ||
      url.includes("/completion") ||
      url.includes("/chat_conversations") ||
      url.includes("/retry_completion") ||
      url.includes("/organizations/") 
    );
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
          return c
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join(" ");
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
          } catch (e) {
            // not JSON, skip
          }
        }
      }

      const assistantText = chunks.join("");
      if (userPrompt || assistantText) {
        storeTranscript(userPrompt, assistantText, url);
      }
    } catch (e) {
      console.debug("[ClaudeCapture] SSE capture error:", e.message);
    }
  }

  async function captureJSONResponse(response, userPrompt, url) {
    try {
      const body = await response.json();
      let assistantText = "";
      const content = body?.content;
      if (Array.isArray(content)) {
        assistantText = content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join(" ");
      } else if (typeof body?.completion === "string") {
        assistantText = body.completion;
      }
      if (userPrompt || assistantText) {
        storeTranscript(userPrompt, assistantText, url);
      }
    } catch (e) {
      // response might not be JSON
    }
  }

  function storeTranscript(userPrompt, assistantText, url) {
    try {
      const now = new Date().toISOString();
      const sessionDate = now.slice(0, 10);
      const entries = [];

      if (userPrompt) {
        entries.push({
          session_date: sessionDate,
          role: "user",
          content: userPrompt,
          path: url,
          created_at: now,
        });
      }
      if (assistantText) {
        entries.push({
          session_date: sessionDate,
          role: "assistant",
          content: assistantText,
          path: url,
          created_at: now,
        });
      }

      // Read existing, append, trim
      const existing = JSON.parse(localStorage.getItem(CAPTURE_KEY) || "[]");
      existing.push(...entries);
      // Keep last MAX_STORED entries
      const trimmed = existing.slice(-MAX_STORED);
      localStorage.setItem(CAPTURE_KEY, JSON.stringify(trimmed));

      console.debug(
        `[ClaudeCapture] ${userPrompt.length}c prompt, ${assistantText.length}c response`
      );

      // Also dispatch custom event for background script pickup
      window.dispatchEvent(
        new CustomEvent("claude-transcript", { detail: entries })
      );
    } catch (e) {
      console.debug("[ClaudeCapture] store error:", e.message);
    }
  }
})();
