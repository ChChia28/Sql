/* =====================================================================
   SQL Quest — exercise grading
   Nothing is hard-coded: the learner's SQL and the reference solution are
   executed on two identical, pristine copies of the sample database and
   the result sets are compared. For exercises that change data, a
   verification query is run against both databases afterwards instead.
   ===================================================================== */

import { gradeRun } from "./db.js";
import { escapeHtml, resultTable } from "./format.js";

const NULL_MARK = "\u0000NULL";
const CELL_SEP = "\u0001";

/** Strip comments and string literals so pattern checks can't be fooled. */
function bareSql(sql) {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, " 'str' ");
}

function normalizeValue(value) {
  if (value === null || value === undefined) return NULL_MARK;
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 1e6) / 1e6);
  }
  if (value instanceof Uint8Array) return `blob:${value.length}`;
  const text = String(value).trim();
  // "12.50" and 12.5 should count as the same answer
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);
  }
  return text;
}

function rowKey(row) {
  return row.map(normalizeValue).join(CELL_SEP);
}

function lastResult(run) {
  if (!run || !run.results || !run.results.length) return null;
  return run.results[run.results.length - 1];
}

function counter(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = rowKey(row);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

/** Rows present in `a` more often than in `b`. */
function difference(a, b) {
  const out = [];
  const remaining = counter(b);
  for (const row of a) {
    const key = rowKey(row);
    const left = remaining.get(key) || 0;
    if (left > 0) remaining.set(key, left - 1);
    else out.push(row);
  }
  return out;
}

function sampleRows(rows, columns, limit = 3) {
  return resultTable({ columns, values: rows.slice(0, limit) }, { rowNumbers: false });
}

function fail(title, detail = "") {
  return { status: "fail", title, detail };
}

/**
 * Compare two result sets and explain the first meaningful difference in
 * terms a learner can act on.
 */
export function compareResults(user, expected, options = {}) {
  const { orderMatters = false, checkColumnNames = false } = options;

  if (!expected) return { status: "pass", title: "Correct" };
  if (!user) {
    return fail(
      "Your statement didn't return a result set",
      "The task expects a query that produces rows — make sure it starts with <code>SELECT</code> (or <code>WITH</code>)."
    );
  }

  if (user.columns.length !== expected.columns.length) {
    return fail(
      `Expected ${expected.columns.length} column${expected.columns.length === 1 ? "" : "s"}, your query returned ${user.columns.length}`,
      `The answer should have these columns: <code>${escapeHtml(expected.columns.join(", "))}</code>.`
    );
  }

  if (checkColumnNames) {
    const mismatch = expected.columns.findIndex(
      (name, index) => String(name).toLowerCase() !== String(user.columns[index]).toLowerCase()
    );
    if (mismatch !== -1) {
      return fail(
        `Column ${mismatch + 1} should be named "${expected.columns[mismatch]}"`,
        `Yours is named <code>${escapeHtml(String(user.columns[mismatch]))}</code>. Use <code>AS</code> to set the column name.`
      );
    }
  }

  const userRows = user.values;
  const expectedRows = expected.values;
  const missing = difference(expectedRows, userRows);
  const extra = difference(userRows, expectedRows);

  if (!missing.length && !extra.length) {
    if (orderMatters) {
      const same = userRows.every((row, index) => rowKey(row) === rowKey(expectedRows[index]));
      if (!same) {
        return fail(
          "Right rows, wrong order",
          "All the data is correct, but this task cares about the order. Check your <code>ORDER BY</code> clause (and whether it should be <code>ASC</code> or <code>DESC</code>)."
        );
      }
    }
    return { status: "pass", title: "Correct" };
  }

  if (expectedRows.length === 0) {
    return fail(
      `Expected no rows, your query returned ${userRows.length}`,
      `The correct answer is an empty result. Your filter is letting rows through:${sampleRows(extra, user.columns)}`
    );
  }

  if (userRows.length === 0) {
    return fail(
      `Your query returned no rows — ${expectedRows.length} expected`,
      "Your <code>WHERE</code> clause (or a join condition) is probably too strict. Try removing conditions one at a time to see which one empties the result."
    );
  }

  if (!missing.length && extra.length) {
    return fail(
      `Too many rows: ${userRows.length} returned, ${expectedRows.length} expected`,
      `Every expected row is there, plus ${extra.length} that shouldn't be. For example:${sampleRows(extra, user.columns)}`
    );
  }

  if (missing.length && !extra.length) {
    return fail(
      `Too few rows: ${userRows.length} returned, ${expectedRows.length} expected`,
      `These rows are missing:${sampleRows(missing, expected.columns)}`
    );
  }

  return fail(
    `${missing.length} row${missing.length === 1 ? "" : "s"} wrong`,
    `Expected (but missing):${sampleRows(missing, expected.columns)}<p style="margin:.6em 0 0">Returned (but not expected):</p>${sampleRows(extra, user.columns)}`
  );
}

/** Friendlier wording for the most common SQLite error messages. */
export function explainSqlError(message) {
  const text = String(message);
  const tips = [
    [/no such column: (\S+)/i, (m) => `SQLite doesn't know the column <code>${escapeHtml(m[1])}</code>. Check the spelling, and remember text values need quotes: <code>'gold'</code>, not <code>gold</code>.`],
    [/no such table: (\S+)/i, (m) => `There is no table called <code>${escapeHtml(m[1])}</code>. Open the Schema page to see what exists.`],
    [/no such function: (\S+)/i, (m) => `<code>${escapeHtml(m[1])}</code> isn't a SQLite function. SQLite spells some things differently from other engines (for example <code>strftime()</code> rather than <code>DATE_FORMAT()</code>).`],
    [/misuse of aggregate/i, () => "Aggregates like <code>SUM()</code> can't be used in <code>WHERE</code>. Filter groups with <code>HAVING</code> instead."],
    [/ambiguous column name/i, () => "Two joined tables have a column with this name. Qualify it, for example <code>o.customer_id</code>."],
    [/syntax error/i, () => "Usually a missing comma, an unclosed bracket or quote, or clauses in the wrong order (<code>SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT</code>)."],
    [/UNIQUE constraint failed: (\S+)/i, (m) => `A row with that value already exists (<code>${escapeHtml(m[1])}</code> must be unique).`],
    [/NOT NULL constraint failed: (\S+)/i, (m) => `<code>${escapeHtml(m[1])}</code> can't be NULL — give it a value.`],
    [/FOREIGN KEY constraint failed/i, () => "You're pointing at a parent row that doesn't exist (or removing one that still has children)."],
    [/CHECK constraint failed/i, () => "The value breaks a CHECK rule on the table. Its DDL is on the Schema page."],
  ];
  for (const [re, make] of tips) {
    const m = re.exec(text);
    if (m) return make(m);
  }
  return "";
}

/**
 * Grade one exercise attempt.
 * @returns {Promise<{status:'pass'|'fail'|'error', title, detail, result}>}
 */
export async function gradeExercise(exercise, userSql) {
  const trimmed = String(userSql || "").trim();
  if (!trimmed) {
    return { status: "error", title: "Write a query first", detail: "The editor is empty." };
  }

  const bare = bareSql(trimmed);
  for (const rule of exercise.requires || []) {
    const re = new RegExp(rule.re, rule.flags || "i");
    const hit = re.test(bare);
    if (rule.not ? hit : !hit) {
      return { status: "fail", title: rule.msg, detail: rule.detail || "" };
    }
  }

  let run;
  try {
    run = await gradeRun(trimmed, exercise.solution, exercise.check || null);
  } catch (err) {
    return { status: "error", title: "Query stopped", detail: escapeHtml(err.message) };
  }

  const { user, expected } = run;

  if (!expected.ok) {
    // Shouldn't happen: tools/verify.mjs runs every reference solution.
    return { status: "error", title: "The reference solution failed to run", detail: escapeHtml(expected.error) };
  }

  if (!user.ok) {
    const tip = explainSqlError(user.error);
    return {
      status: "error",
      title: "SQLite rejected the query",
      detail: `<code>${escapeHtml(user.error)}</code>${tip ? `<p style="margin:.6em 0 0">${tip}</p>` : ""}`,
    };
  }

  const isCheck = Boolean(exercise.check);
  const userResult = isCheck ? lastResult(user.check) : lastResult(user.main);
  const expectedResult = isCheck ? lastResult(expected.check) : lastResult(expected.main);

  const verdict = compareResults(userResult, expectedResult, {
    orderMatters: Boolean(exercise.orderMatters),
    checkColumnNames: Boolean(exercise.checkColumnNames),
  });

  return {
    ...verdict,
    result: lastResult(user.main),
    elapsed: user.main ? user.main.elapsed : 0,
    rowsModified: user.main ? user.main.rowsModified : 0,
    checkResult: isCheck ? userResult : null,
  };
}
