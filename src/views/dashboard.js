/* =====================================================================
   SQL Quest — dashboard
   ===================================================================== */

import { MODULES, allLessons } from "../curriculum/index.js";
import { escapeHtml } from "../format.js";
import { courseStats, moduleStats, lessonSolved } from "../ui.js";
import * as store from "../store.js";

/** The first lesson that still has unsolved exercises. */
function nextLesson() {
  const lessons = allLessons();
  return lessons.find((lesson) => !lessonSolved(lesson)) || lessons[0];
}

export default async function renderDashboard(container) {
  const stats = courseStats();
  const target = nextLesson();
  const state = store.getState();
  const started = stats.solved > 0 || Object.keys(state.visited).length > 0;

  container.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Learn SQL from zero to expert</div>
      <h1>SQL Quest</h1>
      <p>
        Ten modules, ${allLessons().length} lessons and ${stats.total} graded exercises, all running against a
        real SQLite database inside this page. Write a query, press Check, and your answer is executed and
        compared with the reference solution — no accounts, no network, nothing to install.
      </p>
      <div class="row" style="margin-top:18px">
        <a class="btn primary" href="#/lesson/${target.id}">${
          started ? "Continue" : "Start the course"
        } → ${escapeHtml(target.title)}</a>
        <a class="btn ghost" href="#/playground">Open the playground</a>
        <a class="btn ghost" href="#/schema">Explore the database</a>
      </div>
    </section>

    <section class="stat-grid" style="margin-bottom:22px">
      <div class="stat"><b>${stats.solved}<span style="font-size:1rem;color:var(--text-faint)"> / ${
        stats.total
      }</span></b><span>Exercises solved</span></div>
      <div class="stat"><b>${stats.pct}%</b><span>Course complete</span></div>
      <div class="stat"><b>${MODULES.filter((m) => moduleStats(m).done).length} / ${
        MODULES.length
      }</b><span>Modules finished</span></div>
      <div class="stat"><b>${store.streak()}</b><span>Day streak</span></div>
    </section>

    <h2>The curriculum</h2>
    <div class="grid-cards">
      ${MODULES.map((mod) => {
        const ms = moduleStats(mod);
        return `
        <a class="mod-card" href="#/lesson/${mod.lessons[0].id}">
          <div class="row">
            <span class="pill ${ms.done ? "ok" : "accent"}">Module ${mod.number}</span>
            <span class="spacer"></span>
            <span class="pill">${escapeHtml(mod.level || "")}</span>
          </div>
          <h3>${escapeHtml(mod.title)}</h3>
          <p>${escapeHtml(mod.summary)}</p>
          <div class="bar"><i style="width:${ms.pct}%"></i></div>
          <div class="faint">${ms.solved} / ${ms.total} exercises · ${mod.lessons.length} lessons</div>
        </a>`;
      }).join("")}
    </div>

    <h2 style="margin-top:28px">How this works</h2>
    <div class="grid-cards">
      <div class="card">
        <h3>A real database, in your browser</h3>
        <p class="muted">SQLite is compiled to WebAssembly and runs on a background thread. Every query you
        write is really executed — including <code>INSERT</code>, <code>UPDATE</code> and
        <code>CREATE TABLE</code>.</p>
      </div>
      <div class="card">
        <h3>Answers are executed, not string-matched</h3>
        <p class="muted">Your SQL and the reference solution run on two identical, pristine copies of the
        sample database and the results are compared. Any correct query passes, whatever style you write it in.</p>
      </div>
      <div class="card">
        <h3>Nothing leaves this page</h3>
        <p class="muted">Progress lives in your browser's local storage. You can export it from the
        <a href="#/progress">Progress</a> page, and reset it whenever you like.</p>
      </div>
    </div>`;
}
