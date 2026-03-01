/**
 * background.js — service worker
 * Receives transcripts from bridge.js, forwards to native host for disk write.
 * Falls back to chrome.storage.local if native messaging unavailable.
 */

const NATIVE_HOST = "dev.deltaops.claude_capture";
const STORAGE_KEY = "pending_transcripts";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "transcript" || !Array.isArray(msg.entries)) return;

  // Try native messaging first (writes JSONL to disk)
  try {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, { entries: msg.entries }, (resp) => {
      if (chrome.runtime.lastError) {
        // Native host not available — queue in storage
        queueToStorage(msg.entries);
      }
    });
  } catch (e) {
    queueToStorage(msg.entries);
  }
});

async function queueToStorage(entries) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const existing = data[STORAGE_KEY] || [];
  existing.push(...entries);
  // Cap at 2000 entries
  const trimmed = existing.slice(-2000);
  await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
}

// Periodic flush from storage via native messaging (every 5 min)
chrome.alarms.create("flush-transcripts", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "flush-transcripts") return;
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const pending = data[STORAGE_KEY] || [];
  if (pending.length === 0) return;

  try {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, { entries: pending }, (resp) => {
      if (!chrome.runtime.lastError) {
        chrome.storage.local.set({ [STORAGE_KEY]: [] });
      }
    });
  } catch (e) {
    // native host still unavailable, keep queued
  }
});
