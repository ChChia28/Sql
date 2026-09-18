#!/usr/bin/env node
/* =====================================================================
   SQL Quest — curriculum verifier
   Executes every example query and every reference solution in the course
   against the real sample database, and sanity-checks the exercise
   metadata. Run it after editing any lesson:

       npm run verify        (or: node tools/verify.mjs)
   ===================================================================== */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const initSqlJs = require(path.join(root, "vendor/sqljs/sql-wasm.js"));

const args = new Set(process.argv.slice(2));
const verbose = args.has("--verbose");

const problems = [];
const warnings = [];
let checks = 0;

function fail(where, message) {
  problems.push(`${where}: ${message}`);
}
function warn(where, message) {
  warnings.push(`${where}: ${message}`);
}

const SQL = await initSqlJs({
  locateFile: (file) => path.join(root, "vendor/sqljs", file),
});
const seed = readFileSync(path.join(root, "data/seed.sql"), "utf8");

const template = new SQL.Database();
template.run(seed);
const seedBytes = template.export();
template.close();

function fresh() {
  const db = new SQL.Database(seedBytes);
  db.run("PRAGMA foreign_keys = ON;");
  return db;
}

/** Run SQL on a throwaway database; returns { ok, rows, columns, error }. */
function run(sql, followUp = null) {
  const db = fresh();
  try {
    const results = db.exec(sql);
    let check = null;
    if (followUp) {
      const checkResults = db.exec(followUp);
      check = checkResults.length ? checkResults[checkResults.length - 1] : null;
    }
    const last = results.length ? results[results.length - 1] : null;
    return {
      ok: true,
      columns: last ? last.columns : [],
      rows: last ? last.values : [],
      check,
      statements: results.length,
    };
  } catch (error) {
    return { ok: false, error: String(error.message || error) };
  } finally {
    db.close();
  }
}

function rowKey(row) {
  return row
    .map((v) => {
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
      return String(v).trim();
    })
    .join("\u0001");
}

function sameResult(a, b) {
  if (!a || !b) return a === b;
  if (a.rows.length !== b.rows.length) return false;
  const left = a.rows.map(rowKey).sort();
  const right = b.rows.map(rowKey).sort();
  return left.every((value, index) => value === right[index]);
}

function stripSql(sql) {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/'(?:[^']|'')*'/g, " 'str' ");
}

/* ------------------------------------------------------------------ run */

const { MODULES, allLessons, allExercises } = await import(
  path.join(root, "src/curriculum/index.js")
);
const { splitLessonContent } = await import(path.join(root, "src/content.js"));

/** Lesson prose lives in content/<module-id>.md. */
function moduleProse(moduleId) {
  try {
    return splitLessonContent(readFileSync(path.join(root, `content/${moduleId}.md`), "utf8"));
  } catch {
    return null;
  }
}

const seenIds = new Set();
function uniqueId(kind, id, where) {
  if (!id) return fail(where, `${kind} has no id`);
  if (seenIds.has(id)) fail(where, `duplicate id "${id}"`);
  seenIds.add(id);
}

for (const mod of MODULES) {
  uniqueId("module", mod.id, `module ${mod.number}`);
  if (!mod.title || !mod.summary) fail(`module ${mod.id}`, "missing title or summary");
  if (mod.draft) {
    warn(`module ${mod.id}`, "draft module, skipped");
    continue;
  }
  if (!mod.lessons.length) fail(`module ${mod.id}`, "has no lessons");

  const prose = moduleProse(mod.id);
  if (!prose) {
    fail(`module ${mod.id}`, `missing prose file content/${mod.id}.md`);
    continue;
  }
  for (const id of prose.keys()) {
    if (!mod.lessons.some((l) => l.id === id)) warn(`module ${mod.id}`, `prose section "${id}" has no matching lesson`);
  }

  for (const lesson of mod.lessons) {
    const where = `${mod.id} / ${lesson.id}`;
    uniqueId("lesson", lesson.id, where);
    if (!lesson.title) fail(where, "missing title");
    if (!lesson.goal) warn(where, "missing goal line");
    const content = prose.get(lesson.id);
    if (!content) {
      fail(where, `no prose section ":::  lesson ${lesson.id}" in content/${mod.id}.md`);
      continue;
    }
    if (content.length < 200) warn(where, "content looks very short");

    // every ```sql block in the prose must execute
    const fences = [...content.matchAll(/```sql(-static|-error)?\n([\s\S]*?)```/g)];
    if (!fences.length) warn(where, "no SQL examples in the prose");
    for (const [, variant, code] of fences) {
      if (variant === "-static") continue;   // illustrative pseudo-SQL, not runnable
      checks += 1;
      const result = run(code);
      if (variant === "-error") {
        // these examples exist to show an error message; they must actually fail
        if (result.ok) fail(where, `example marked sql-error succeeded: ${code.trim().split("\n")[0]}…`);
      } else if (!result.ok) {
        fail(where, `example failed: ${result.error}\n    ${code.trim().split("\n")[0]}…`);
      } else if (verbose) console.log(`  ok  ${where} example -> ${result.rows.length} rows`);
    }

    for (const exercise of lesson.exercises || []) {
      const spot = `${where} / ${exercise.id}`;
      uniqueId("exercise", exercise.id, spot);
      if (!exercise.prompt) fail(spot, "missing prompt");
      if (!exercise.solution) fail(spot, "missing solution");
      if (!exercise.hints || exercise.hints.length < 1) warn(spot, "no hints");

      checks += 1;
      const solved = run(exercise.solution, exercise.check || null);
      if (!solved.ok) {
        fail(spot, `solution failed: ${solved.error}`);
        continue;
      }
      if (exercise.check && !solved.check) fail(spot, "check query returned no result set");

      const target = exercise.check ? { rows: solved.check.values } : solved;
      if (!exercise.allowEmpty && target.rows.length === 0) {
        fail(spot, "solution returns zero rows — the exercise can be passed with a nonsense query");
      }

      // the solution must satisfy the exercise's own pattern requirements
      for (const rule of exercise.requires || []) {
        const re = new RegExp(rule.re, rule.flags || "i");
        const hit = re.test(stripSql(exercise.solution));
        if (rule.not ? hit : !hit) {
          fail(spot, `reference solution does not satisfy its own "requires" rule: ${rule.msg}`);
        }
      }

      // a starter that already produces the answer makes the task a no-op
      if (exercise.starter && exercise.starter.trim()) {
        const starter = run(exercise.starter, exercise.check || null);
        if (starter.ok) {
          const starterTarget = exercise.check
            ? { rows: starter.check ? starter.check.values : [] }
            : starter;
          if (sameResult(starterTarget, target) && !exercise.starterIsAnswer) {
            warn(spot, "the starter SQL already produces the expected answer");
          }
        }
      }
      if (verbose) console.log(`  ok  ${spot}`);
    }

    for (const [index, question] of (lesson.quiz || []).entries()) {
      const spot = `${where} / quiz ${index + 1}`;
      if (!question.q || !Array.isArray(question.options) || question.options.length < 2) {
        fail(spot, "malformed quiz question");
      }
      if (typeof question.answer !== "number" || !question.options[question.answer]) {
        fail(spot, "quiz answer index is out of range");
      }
      if (!question.explain) warn(spot, "quiz has no explanation");
    }
  }
}

/* --------------------------------------------------------------- report */

const lessons = allLessons();
const exercises = allExercises();

console.log(
  `\nSQL Quest curriculum: ${MODULES.length} modules, ${lessons.length} lessons, ` +
    `${exercises.length} exercises — ${checks} SQL statements executed.`
);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  x ${p}`);
  process.exit(1);
}

console.log("\nAll examples and reference solutions run clean.\n");
