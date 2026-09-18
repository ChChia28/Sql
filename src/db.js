/* =====================================================================
   SQL Quest — main-thread database client
   Thin promise wrapper around the worker, with per-call timeouts. A query
   that never finishes (hello, accidental cross join) gets the worker
   terminated and replaced rather than locking up the browser.
   ===================================================================== */

const DEFAULT_TIMEOUT = 8000;

let worker = null;
let seq = 0;
const pending = new Map();
let bootPromise = null;

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

function call(type, payload, timeout = DEFAULT_TIMEOUT) {
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

/** Boot the engine (loads WebAssembly + the sample data). Idempotent. */
export function initEngine() {
  if (!bootPromise) bootPromise = call("ping", {}, 60000);
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
