/**
 * background.js — MV3 service worker
 *
 * Receives transcript entries from bridge.js, writes to disk via native
 * messaging host (dev.deltaops.claude_capture). Falls back to
 * chrome.storage.local if the native host is unavailable, then flushes
 * on the next successful connection.
 */
"use strict";

const NATIVE_HOST = "dev.deltaops.claude_capture";
const STORAGE_KEY = "pending_transcripts_v2";
const MAX_PENDING = 2000;

// ── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg?.type !== "transcript-v2" || !msg.entry) return false;
  handleEntry(msg.entry);
  return false; // synchronous, no async response needed
});

async function handleEntry(entry) {
  try {
    await sendNative({ entries: [entry] });
    console.log(
      `[ClaudeCapture BG] Wrote turn=${entry.turn_number} conv=${String(entry.conversation_id).slice(0, 8)}…`
    );
  } catch (e) {
    console.debug("[ClaudeCapture BG] Native host unavailable, queuing:", e.message);
    await queueToStorage([entry]);
  }
}

// ── Native messaging ─────────────────────────────────────────────────────────

function sendNative(payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(resp);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

// ── Storage fallback ─────────────────────────────────────────────────────────

async function queueToStorage(entries) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const existing = data[STORAGE_KEY] ?? [];
  existing.push(...entries);
  await chrome.storage.local.set({ [STORAGE_KEY]: existing.slice(-MAX_PENDING) });
}

// ── Periodic flush of queued entries ─────────────────────────────────────────

chrome.alarms.create("flush-queue", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "flush-queue") return;

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const pending = data[STORAGE_KEY] ?? [];
  if (pending.length === 0) return;

  try {
    await sendNative({ entries: pending });
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    console.log(`[ClaudeCapture BG] Flushed ${pending.length} queued entries`);
  } catch (e) {
    // Native host still unavailable — keep entries queued
  }
});
