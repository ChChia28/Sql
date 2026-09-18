# SQL Quest — learn SQL from zero to expert

A complete, self-contained SQL course that runs in a browser tab. A real SQLite
engine (compiled to WebAssembly) executes every query you write, and every
exercise is graded by *running* your SQL and comparing the result with the
reference solution — so any correct answer passes, whatever style you write it
in.

No accounts, no server, no network calls, no build step.

```bash
python3 -m http.server 8000     # from this folder
# then open http://localhost:8000
```

(Any static file server works. Opening `index.html` directly from disk does
*not* — browsers block ES modules and WebAssembly on `file://`.)

## What's inside

| | |
| --- | --- |
| **10 modules, 81 lessons** | from "what is a table" to query plans and index design |
| **207 graded exercises** | executed against a private, pristine copy of the database |
| **Real sample data** | 11 tables, ~3,000 rows: catalogue, customers, staff, orders, reviews, web traffic |
| **Playground** | a persistent scratch database — write, break, reset |
| **Schema explorer** | columns, keys, row counts, DDL, row previews |
| **Reference** | one-page cheat sheet with runnable examples |
| **Progress tracking** | local only; badges, streaks, export/import |

### Curriculum

1. **First Queries** — tables, SELECT, aliases, DISTINCT, ORDER BY, LIMIT, clause order
2. **Filtering Rows** — WHERE, AND/OR precedence, IN/BETWEEN, LIKE, NULL semantics, CASE
3. **Aggregation & Grouping** — COUNT/SUM/AVG, GROUP BY, HAVING, conditional aggregation
4. **Joins** — inner, left, self, cross, anti-joins, fan-out, UNION/INTERSECT/EXCEPT
5. **Subqueries & CTEs** — scalar, IN, EXISTS, correlated, derived tables, WITH chains
6. **Types & Functions** — affinity and CAST, text, numbers, dates, NULL helpers, JSON
7. **Changing Data & Schema** — INSERT/UPDATE/DELETE, constraints, views, transactions, upserts
8. **Window Functions** — PARTITION BY, ranking, LAG/LEAD, frames, moving averages, NTILE
9. **Advanced Patterns** — recursive CTEs, hierarchies, pivots, gaps & islands, dedup, cohorts, funnels
10. **Expert Track** — execution order, EXPLAIN, index design, sargability, normalisation, concurrency, anti-patterns, portability, capstones

Every lesson has runnable examples, exercises with progressive hints and a
reference solution, and most have a short concept quiz.

## How grading works

For each attempt the worker creates **two identical, pristine copies** of the
sample database. Your SQL runs on one, the reference solution on the other, and
the result sets are compared:

- row order is ignored unless the exercise says it matters
- numbers are compared numerically (`12.50` equals `12.5`)
- exercises that modify data are verified by running a **check query**
  afterwards on both databases, so how you achieve the change is up to you
- some exercises additionally require (or forbid) a construct — "use `NOT
  EXISTS`", "no `DISTINCT`" — and say so in the feedback

Nothing is hard-coded, so there is no single "expected answer string" to guess.

## Layout

```
index.html               app shell
assets/styles.css        design system (dark + light)
content/*.md             lesson prose, one file per module (+ reference.md)
src/
  main.js                routing, sidebar, search palette, theme
  db.js                  promise client for the database worker, with timeouts
  worker.js              SQLite (sql.js/WASM) on a background thread
  grader.js              runs and compares answers, explains failures
  editor.js              textarea + syntax-highlight overlay
  format.js              markdown subset, SQL highlighter, result tables
  store.js               progress in localStorage
  ui.js                  toasts, runnable examples, badges
  curriculum/*.js        lesson metadata, exercises, quizzes
  views/*.js             dashboard, lesson, playground, schema, reference, progress
data/seed.sql            the generated sample database
tools/generate_seed.py   regenerates seed.sql deterministically
tools/verify.mjs         runs every example and solution in the course
vendor/sqljs/            sql.js 1.13 (SQLite 3.49) — MIT licensed
```

Queries run in a Web Worker, so a runaway query (an unbounded recursive CTE, an
accidental cross join) is cancelled after a few seconds and the engine restarts
instead of freezing the tab.

## Working on the course

```bash
node tools/verify.mjs          # execute every example + solution, check metadata
node tools/verify.mjs --verbose
python3 tools/generate_seed.py # regenerate data/seed.sql (deterministic)
```

The verifier is the safety net for content edits. It checks that:

- every prose example runs (and that examples marked ```sql-error really do fail)
- every reference solution runs and returns at least one row
- every solution satisfies its own `requires` rules
- ids are unique, quiz answers are in range, starters don't already answer the task

### Adding a lesson

1. Add a section to `content/<module-id>.md`:

   ```
   ::: lesson my-lesson-id

   Prose in markdown. Fenced ```sql blocks become runnable examples.
   ```

2. Add the matching entry to `src/curriculum/<module>.js`:

   ```js
   {
     id: "my-lesson-id",
     title: "…",
     goal: "…",
     keywords: ["…"],
     exercises: [{
       id: "my-lesson-e1",
       prompt: "…",          // markdown
       starter: "",
       solution: "SELECT …", // the reference answer
       hints: ["…"],
       orderMatters: true,   // optional
       checkColumnNames: true,
       // check: "SELECT …"  // required for exercises that modify data
       // requires: [{ re: "GROUP\\s+BY", msg: "Use GROUP BY." }]
     }],
     quiz: [{ q: "…", options: ["…"], answer: 0, explain: "…" }],
   }
   ```

3. Run `node tools/verify.mjs`.

## The sample database

An online music-gear shop, generated by `tools/generate_seed.py` with a fixed
random seed so every machine sees identical data:

`categories` (nested tree) · `suppliers` · `products` · `product_meta` (JSON) ·
`customers` (self-referencing referrals) · `employees` (manager hierarchy) ·
`orders` · `order_items` · `payments` · `reviews` · `web_sessions`

It deliberately contains the awkward cases you need in order to learn properly:
NULL countries and birth dates, unshipped orders, customers who never ordered,
products never sold, duplicate reviews, missing days in the traffic series, and
prices that have drifted since the order was placed. The data ends on
**2025-06-30** — treat that as "today" in date exercises.

## Licence / credits

Course content and application code in this repository are yours to use.
`vendor/sqljs` is [sql.js](https://github.com/sql-js/sql.js) (MIT), which
bundles SQLite (public domain).
