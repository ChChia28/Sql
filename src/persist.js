/* =====================================================================
   SQL Quest — durable progress

   localStorage is fine when the app is served from a normal origin, but
   inside a sandboxed embed (a published Artifact, a preview frame, a
   private window) it can come back empty — which silently throws away a
   learner's progress. So:

     1. if the host grants the `db` capability, progress is stored
        against the viewer's own account and survives everything;
     2. otherwise localStorage is used, exactly as before;
     3. if neither works, the app says so loudly instead of pretending.

   Local and remote states are MERGED rather than one overwriting the
   other, so no path through this code can lose a solved exercise.
   ===================================================================== */

import * as store from "./store.js";

const DOC_VERSION = 1;
const WRITE_DEBOUNCE_MS = 1200;
const MAX_SNIPPET_CHARS = 20000;   // keep the document comfortably small

let mode = "local";                // "cloud" | "local" | "none"
let docRef = null;
let writeTimer = null;
let lastWritten = "";
let writing = false;
let hydrating = false;
const listeners = new Set();

export function status() {
  return {
    mode,
    label:
      mode === "cloud"
        ? "Saved to your Claude account"
        : mode === "local"
          ? "Saved in this browser only"
          : "Not being saved — keep a backup",
    durable: mode === "cloud",
  };
}

export function onStatusChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function announce() {
  for (const fn of listeners) fn(status());
}

/** Does localStorage actually work here? */
function localStorageWorks() {
  try {
    const probe = "sqlquest.probe";
    localStorage.setItem(probe, "1");
    const ok = localStorage.getItem(probe) === "1";
    localStorage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

/** Trim anything unbounded before it goes into a size-capped document. */
function forTransport(state) {
  const copy = JSON.parse(JSON.stringify(state));
  let budget = MAX_SNIPPET_CHARS;
  copy.snippets = (copy.snippets || []).filter((snippet) => {
    budget -= (snippet.sql || "").length;
    return budget > 0;
  });
  return copy;
}

async function resolveCapability(name) {
  try {
    if (!globalThis.claude || typeof globalThis.claude.use !== "function") return null;
    return await globalThis.claude.use(name);
  } catch {
    return null;
  }
}

/** Where this viewer's progress lives: their own private subtree if possible. */
async function openDoc(db) {
  const user = await resolveCapability("user");
  let uid = null;
  try {
    uid = user ? await user.id() : null;
  } catch {
    uid = null;
  }
  try {
    return uid
      ? db.doc(`data/users/${uid}/progress`)
      : db.doc("progress/main");
  } catch {
    // a malformed id would throw synchronously — fall back to the shared doc
    return db.doc("progress/main");
  }
}

/**
 * A one-off starting point placed in the shared store (for example to
 * hand back progress lost before this app could save it). Applied once —
 * the id is recorded, so a later reset is not undone by it.
 */
async function applySeed(db) {
  try {
    const snapshot = await db.doc("progress/seed").get();
    if (!snapshot.exists) return false;
    const body = snapshot.data() || {};
    const seedId = String(body.seedId || "");
    if (!seedId || !body.state || typeof body.state !== "object") return false;
    if ((store.game().seeds || []).includes(seedId)) return false;
    hydrating = true;
    store.mergeIn(body.state);
    store.updateGame((gameState) => {
      gameState.seeds = [...(gameState.seeds || []), seedId];
    });
    hydrating = false;
    return true;
  } catch {
    return false;   // a missing or unreadable seed is not an error
  }
}

async function pushNow() {
  if (!docRef || writing) return;
  const payload = forTransport(store.getState());
  const serialized = JSON.stringify(payload);
  if (serialized === lastWritten) return;
  writing = true;
  try {
    await docRef.set({ version: DOC_VERSION, updatedAt: Date.now(), state: payload });
    lastWritten = serialized;
  } catch (error) {
    if (error && (error.code === "revoked" || error.code === "not_granted")) {
      docRef = null;
      mode = localStorageWorks() ? "local" : "none";
      announce();
    }
    // other failures: keep the local copy and try again on the next change
  } finally {
    writing = false;
  }
}

function schedulePush() {
  if (!docRef || hydrating) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(pushNow, WRITE_DEBOUNCE_MS);
}

/**
 * Bring up persistence. Resolves once any remote state has been merged
 * in, so the first render already shows the learner's real progress.
 */
export async function initPersistence() {
  const localOk = localStorageWorks();
  mode = localOk ? "local" : "none";

  const db = await resolveCapability("db");
  if (db) {
    try {
      docRef = await openDoc(db);
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        const body = snapshot.data() || {};
        if (body.state && typeof body.state === "object") {
          hydrating = true;
          store.mergeIn(body.state);
          hydrating = false;
        }
      }
      await applySeed(db);
      mode = "cloud";
      lastWritten = "";        // force one write so the merged state is stored
      await pushNow();
    } catch {
      docRef = null;
      mode = localOk ? "local" : "none";
    }
  }

  store.subscribe(schedulePush);
  announce();

  // a last-chance flush when the tab goes away
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pushNow();
  });
  window.addEventListener("pagehide", () => {
    pushNow();
  });

  return status();
}

/** Force a write now (used by the backup UI). */
export async function flush() {
  clearTimeout(writeTimer);
  await pushNow();
}

/** Offer the backup as a real file, whichever mechanism this host allows. */
export async function saveBackupFile(filename, text) {
  const downloads = await resolveCapability("downloads");
  if (downloads) {
    await downloads.save({ filename, data: text });
    return "saved";
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "attempted";
}

/** Clipboard with a selection fallback for sandboxes that block it. */
export async function copyText(text, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallbackEl) {
      fallbackEl.removeAttribute("readonly");
      fallbackEl.focus();
      fallbackEl.select();
      try {
        const ok = document.execCommand("copy");
        fallbackEl.setAttribute("readonly", "readonly");
        if (ok) return true;
      } catch {
        /* fall through */
      }
    }
    return false;
  }
}
