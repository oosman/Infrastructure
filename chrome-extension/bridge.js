/**
 * bridge.js — ISOLATED world content script on claude.ai
 * Listens for postMessage from inject.js (MAIN world) and forwards
 * transcript data to the background service worker via chrome.runtime.
 */
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "claude-transcript") return;
  if (!Array.isArray(event.data?.entries)) return;

  chrome.runtime.sendMessage({
    type: "transcript",
    entries: event.data.entries,
  });
});
