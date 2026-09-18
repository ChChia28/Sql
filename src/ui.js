/* =====================================================================
   SQL Quest — small shared UI helpers
   ===================================================================== */

import { execIsolated } from "./db.js";
import { escapeHtml, resultTable, resultMeta } from "./format.js";
import { explainSqlError } from "./grader.js";
import { MODULES, moduleExerciseIds, allExercises } from "./curriculum/index.js";
import * as store from "./store.js";

/* --------------------------------------------------------------- toasts */

export function toast(message, kind = "") {
  const stack = document.getElementById("toast-stack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  stack.append(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .25s ease";
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

/* ------------------------------------------------- runnable code blocks */

/**
 * Wire up every "Run" button inside `root`. Each example executes against a
 * pristine throwaway copy of the database, so examples never interfere with
 * one another (or with the playground).
 */
export function attachRunButtons(root) {
  for (const button of root.querySelectorAll(".run-sql")) {
    button.addEventListener("click", async () => {
      const block = button.closest(".code-block");
      const out = block.querySelector(".code-out");
      const sql = button.dataset.sql;
      button.disabled = true;
      button.textContent = "Running…";
      out.hidden = false;
      out.innerHTML = '<div class="faint">Running…</div>';
      try {
        const run = await execIsolated(sql);
        if (!run.ok) {
          const tip = explainSqlError(run.error);
          out.innerHTML = `<div class="msg err">${escapeHtml(run.error)}</div>${
            tip ? `<div class="faint" style="margin-top:6px">${tip}</div>` : ""
          }`;
        } else {
          const results = run.main.results;
          if (!results.length) {
            out.innerHTML = `<div class="msg ok">Statement executed — ${
              run.main.rowsModified
            } row${run.main.rowsModified === 1 ? "" : "s"} changed. (This copy of the database is thrown away afterwards.)</div>`;
          } else {
            out.innerHTML = results
              .map(
                (r) =>
                  resultMeta(r, run.main.elapsed) + resultTable(r, { maxRows: 50 })
              )
              .join("");
          }
        }
      } catch (err) {
        out.innerHTML = `<div class="msg err">${escapeHtml(err.message)}</div>`;
      } finally {
        button.disabled = false;
        button.textContent = "▸ Run";
      }
    });
  }
}

/* -------------------------------------------------------------- progress */

/** Percentage that never rounds real progress down to a discouraging 0%. */
function percent(done, total) {
  if (!total) return 0;
  if (!done) return 0;
  return Math.max(1, Math.round((done / total) * 100));
}

export function courseStats() {
  const exercises = allExercises();
  const solved = exercises.filter((e) => store.isSolved(e.id)).length;
  return { total: exercises.length, solved, pct: percent(solved, exercises.length) };
}

export function moduleStats(mod) {
  const ids = moduleExerciseIds(mod);
  const solved = ids.filter((id) => store.isSolved(id)).length;
  return {
    total: ids.length,
    solved,
    pct: percent(solved, ids.length),
    done: ids.length > 0 && solved === ids.length,
  };
}

export function lessonSolved(lesson) {
  const ids = (lesson.exercises || []).map((e) => e.id);
  if (!ids.length) return store.isVisited(lesson.id);
  return ids.every((id) => store.isSolved(id));
}

/* ---------------------------------------------------------------- badges */

export const BADGES = [
  { id: "first-query", icon: "🌱", name: "First Query", desc: "Solve your first exercise",
    earned: (s) => s.solved >= 1 },
  { id: "ten", icon: "⚡", name: "Getting Fluent", desc: "Solve 10 exercises",
    earned: (s) => s.solved >= 10 },
  { id: "fifty", icon: "🔥", name: "Half a Century", desc: "Solve 50 exercises",
    earned: (s) => s.solved >= 50 },
  { id: "hundred", icon: "💎", name: "Century", desc: "Solve 100 exercises",
    earned: (s) => s.solved >= 100 },
  { id: "basics", icon: "📘", name: "Grounded", desc: "Finish Module 1",
    earned: (s) => s.modulesDone.includes("first-queries") },
  { id: "joins", icon: "🔗", name: "Join Master", desc: "Finish the Joins module",
    earned: (s) => s.modulesDone.includes("joins") },
  { id: "windows", icon: "🪟", name: "Window Wizard", desc: "Finish Window Functions",
    earned: (s) => s.modulesDone.includes("windows") },
  { id: "expert", icon: "🏆", name: "Expert", desc: "Finish the Expert Track",
    earned: (s) => s.modulesDone.includes("expert") },
  { id: "unaided", icon: "🧠", name: "No Peeking", desc: "Solve 15 exercises without hints or solutions",
    earned: (s) => s.unaided >= 15 },
  { id: "streak", icon: "📆", name: "Consistent", desc: "Practise on 3 different days",
    earned: (s) => s.days >= 3 },
  { id: "playground", icon: "🛠", name: "Tinkerer", desc: "Run 25 queries of your own",
    earned: (s) => s.queriesRun >= 25 },
  { id: "complete", icon: "👑", name: "SQL Quest Complete", desc: "Solve every exercise in the course",
    earned: (s) => s.solved === s.total && s.total > 0 },
];

export function badgeState() {
  const stats = courseStats();
  const state = store.getState();
  const unaided = Object.values(state.solved).filter((s) => !s.peeked && !s.hints).length;
  const modulesDone = MODULES.filter((m) => moduleStats(m).done).map((m) => m.id);
  const context = {
    ...stats,
    unaided,
    modulesDone,
    days: state.stats.days.length,
    queriesRun: state.stats.queriesRun,
  };
  return BADGES.map((badge) => ({ ...badge, isEarned: badge.earned(context) }));
}
