/* =====================================================================
   SQL Quest — main-thread database engine (fallback)

   Normally SQLite runs in a Web Worker (src/worker.js) so a runaway query
   can be cancelled. Some sandboxed embeddings block Workers entirely; this
   module answers the same messages on the main thread so the app still
   works there. It deliberately mirrors the worker's small set of
   operations rather than sharing code with it — a classic worker script
   and an ES module cannot import each other.

   Trade-off: without a separate thread there is nothing to terminate, so a
   runaway query blocks the page until SQLite finishes.
   ===================================================================== */

let SQL = null;
let seedBytes = null;
let playground = null;
let ready = null;

async function boot() {
  const initSqlJs = globalThis.initSqlJs;
  if (typeof initSqlJs !== "function") {
    throw new Error("sql.js did not load (vendor/sqljs/sql-wasm.js)");
  }
  SQL = await initSqlJs({ locateFile: (file) => `vendor/sqljs/${file}` });
  const seedSql = await (await fetch("data/seed.sql")).text();
  const db = new SQL.Database();
  db.run(seedSql);
  seedBytes = db.export();
  db.close();
  playground = fresh();
}

function fresh() {
  const db = new SQL.Database(seedBytes);
  db.run("PRAGMA foreign_keys = ON;");
  return db;
}

function execute(db, sql) {
  const t0 = performance.now();
  const results = db.exec(sql);
  return {
    results: results.map((r) => ({ columns: r.columns, values: r.values })),
    rowsModified: db.getRowsModified(),
    elapsed: performance.now() - t0,
  };
}

function runIsolated(sql, checkSql) {
  const db = fresh();
  try {
    const main = execute(db, sql);
    const check = checkSql ? execute(db, checkSql) : null;
    return { ok: true, main, check };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  } finally {
    db.close();
  }
}

function describe() {
  const db = fresh();
  try {
    const tables = db.exec(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )[0];
    return tables.values.map(([name, ddl]) => {
      const cols = db.exec(`PRAGMA table_info(${name})`)[0];
      const fkRes = db.exec(`PRAGMA foreign_key_list(${name})`);
      const fks = fkRes.length
        ? fkRes[0].values.map((r) => ({ from: r[3], table: r[2], to: r[4] }))
        : [];
      return {
        name,
        ddl,
        rowCount: db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0],
        columns: cols.values.map((c) => ({
          name: c[1],
          type: c[2] || "ANY",
          notNull: !!c[3],
          defaultValue: c[4],
          pk: !!c[5],
          fk: fks.find((f) => f.from === c[1]) || null,
        })),
      };
    });
  } finally {
    db.close();
  }
}

/** Same protocol as the worker's onmessage handler. */
export async function handle(type, payload = {}) {
  if (!ready) ready = boot();
  await ready;

  switch (type) {
    case "ping":
      return "pong";
    case "exec":
      if (payload.reset) {
        playground.close();
        playground = fresh();
      }
      return execute(playground, payload.sql);
    case "execIsolated":
      return runIsolated(payload.sql, payload.checkSql);
    case "grade":
      return {
        user: runIsolated(payload.userSql, payload.checkSql),
        expected: runIsolated(payload.solutionSql, payload.checkSql),
      };
    case "describe":
      return describe();
    case "resetPlayground":
      playground.close();
      playground = fresh();
      return true;
    default:
      throw new Error(`unknown message type: ${type}`);
  }
}
