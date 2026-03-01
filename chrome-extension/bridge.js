/**
 * bridge.js — ISOLATED world content script on claude.ai
 * Forwards transcript events from inject.js to background service worker.
 */
window.addEventListener("claude-transcript", (event) => {
  if (event.detail && Array.isArray(event.detail)) {
    chrome.runtime.sendMessage({
      type: "transcript",
      entries: event.detail,
    });
  }
});
