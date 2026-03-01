/**
 * bridge.js — ISOLATED world content script on claude.ai
 *
 * Listens for postMessage from inject.js (MAIN world) and forwards
 * transcript entries to the service worker via chrome.runtime.sendMessage.
 *
 * NOTE: CustomEvent does NOT cross world boundaries in MV3 — postMessage does.
 */
(function () {
  "use strict";

  console.log("[ClaudeCapture] bridge.js loaded");

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "claude-transcript-v2") return;
    if (!event.data?.entry || typeof event.data.entry !== "object") return;

    chrome.runtime.sendMessage(
      { type: "transcript-v2", entry: event.data.entry },
      () => {
        // Suppress "Could not establish connection" errors when SW not ready
        void chrome.runtime.lastError;
      }
    );
  });
})();
