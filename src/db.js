/* =====================================================================
   SQL Quest — main-thread database client
   Thin promise wrapper around the worker, with per-call timeouts. A query
   that never finishes (hello, accidental cross join) gets the worker
   terminated and replaced rather than locking up the browser.

   If Workers are unavailable (some sandboxed embeddings block them), the
   client falls back to running SQLite on the main thread — same API, but
   nothing to cancel, so a runaway query blocks the page.
   ===================================================================== */

const DEFAULT_TIMEOUT = 8000;

let worker = null;
let seq = 0;
const pending = new Map();
let bootPromise = null;
let localEngine = null;        // set only when the worker is unavailable

export function isLocalMode() {
  return Boolean(localEngine);
}

function spawn() {
  worker = new Worker(new URL("./worker.js", import.meta.url));
  worker.onmessage = (event) => {
    const { id, ok, result, error } = event.data;
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    if (ok) entry.resolve(result);
    else entry.reject(new Error(error));
  };
  worker.onerror = (event) => {
    const message = event.message || "database worker crashed";
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(message));
    }
    pending.clear();
  };
}

function callWorker(type, payload, timeout) {
  if (!worker) spawn();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // The worker is wedged inside SQLite; the only way out is to kill it.
      worker.terminate();
      worker = null;
      for (const [, entry] of pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error("Database restarted"));
      }
      pending.clear();
      bootPromise = null;
      reject(
        new Error(
          `Query cancelled after ${(timeout / 1000).toFixed(
            0
          )}s. It was probably reading far more rows than intended — check your join conditions, or add a LIMIT.`
        )
      );
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, type, payload });
  });
}

function call(type, payload, timeout = DEFAULT_TIMEOUT) {
  if (localEngine) return localEngine.handle(type, payload);
  return callWorker(type, payload, timeout);
}

/** Boot the engine (loads WebAssembly + the sample data). Idempotent. */
export function initEngine() {
  if (!bootPromise) {
    bootPromise = (async () => {
      try {
        return await callWorker("ping", {}, 60000);
      } catch (workerError) {
        // Workers blocked or broken: run SQLite here instead.
        try {
          localEngine = await import("./engine-local.js");
          return await localEngine.handle("ping");
        } catch (localError) {
          localEngine = null;
          throw new Error(
            `${workerError.message} (and the main-thread fallback failed: ${localError.message})`
          );
        }
      }
    })();
  }
  return bootPromise;
}

/** Execute SQL against the persistent playground database. */
export function execPlayground(sql, { reset = false, timeout } = {}) {
  return call("exec", { sql, reset }, timeout);
}

/** Execute SQL against a pristine throwaway copy of the sample database. */
export function execIsolated(sql, checkSql = null, { timeout } = {}) {
  return call("execIsolated", { sql, checkSql }, timeout);
}

/** Run learner SQL and reference SQL on identical fresh databases. */
export function gradeRun(userSql, solutionSql, checkSql = null, { timeout } = {}) {
  return call("grade", { userSql, solutionSql, checkSql }, timeout);
}

export function resetPlayground() {
  return call("resetPlayground", {});
}

let schemaCache = null;
export async function describeSchema() {
  if (!schemaCache) schemaCache = await call("describe", {}, 30000);
  return schemaCache;
}
