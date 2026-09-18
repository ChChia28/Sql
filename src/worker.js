/* =====================================================================
   SQL Quest — database worker
   Runs SQLite (sql.js / WebAssembly) off the main thread so a runaway
   query can be terminated without freezing the page.
   ===================================================================== */

/* global importScripts, initSqlJs */
importScripts("../vendor/sqljs/sql-wasm.js");

let SQL = null;
let seedBytes = null;      // pristine snapshot of the sample database
let playground = null;     // long-lived db the playground writes to

async function boot() {
  SQL = await initSqlJs({ locateFile: (f) => "../vendor/sqljs/" + f });
  const seedSql = await (await fetch("../data/seed.sql")).text();
  const db = new SQL.Database();
  db.run(seedSql);
  seedBytes = db.export();
  db.close();
  playground = fresh();
}

const ready = boot();

function fresh() {
  const db = new SQL.Database(seedBytes);
  db.run("PRAGMA foreign_keys = ON;");   // per-connection, so set it every time
  return db;
}

/** Run SQL and return every result set it produced, plus timing. */
function execute(db, sql) {
  const t0 = performance.now();
  const results = db.exec(sql);
  const elapsed = performance.now() - t0;
  return {
    results: results.map((r) => ({ columns: r.columns, values: r.values })),
    rowsModified: db.getRowsModified(),
    elapsed,
  };
}

/** Run `sql`, then (optionally) a verification query, on a throwaway copy. */
function runIsolated(sql, checkSql) {
  const db = fresh();
  try {
    const main = execute(db, sql);
    let check = null;
    if (checkSql) check = execute(db, checkSql);
    return { ok: true, main, check };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    db.close();
  }
}

/** Describe every table: columns, keys, row counts. */
function describe() {
  const db = fresh();
  try {
    const tables = db
      .exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0];
    const out = [];
    for (const [name, ddl] of tables.values) {
      const cols = db.exec(`PRAGMA table_info(${name})`)[0];
      const fkRes = db.exec(`PRAGMA foreign_key_list(${name})`);
      const fks = fkRes.length
        ? fkRes[0].values.map((r) => ({ from: r[3], table: r[2], to: r[4] }))
        : [];
      const count = db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0];
      out.push({
        name,
        ddl,
        rowCount: count,
        columns: cols.values.map((c) => ({
          name: c[1],
          type: c[2] || "ANY",
          notNull: !!c[3],
          defaultValue: c[4],
          pk: !!c[5],
          fk: fks.find((f) => f.from === c[1]) || null,
        })),
      });
    }
    return out;
  } finally {
    db.close();
  }
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;
  const reply = (body) => self.postMessage({ id, ...body });
  try {
    await ready;
    switch (type) {
      case "ping":
        reply({ ok: true, result: "pong" });
        break;

      case "exec": {
        // Free-form execution against the persistent playground database.
        if (payload.reset) {
          playground.close();
          playground = fresh();
        }
        reply({ ok: true, result: execute(playground, payload.sql) });
        break;
      }

      case "execIsolated":
        reply({ ok: true, result: runIsolated(payload.sql, payload.checkSql) });
        break;

      case "grade": {
        // Run the learner's SQL and the reference solution on identical,
        // pristine copies of the database, then hand both back for comparison.
        const user = runIsolated(payload.userSql, payload.checkSql);
        const expected = runIsolated(payload.solutionSql, payload.checkSql);
        reply({ ok: true, result: { user, expected } });
        break;
      }

      case "describe":
        reply({ ok: true, result: describe() });
        break;

      case "resetPlayground":
        playground.close();
        playground = fresh();
        reply({ ok: true, result: true });
        break;

      default:
        reply({ ok: false, error: `unknown message type: ${type}` });
    }
  } catch (err) {
    reply({ ok: false, error: String((err && err.message) || err) });
  }
};
