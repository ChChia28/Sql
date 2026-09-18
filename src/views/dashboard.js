/* =====================================================================
   SQL Quest — dashboard
   For a returning learner the page opens on "today": the daily goal, the
   three quests, and anything the recall deck owes them. The course map and
   the module list sit underneath.
   ===================================================================== */

import { MODULES, allLessons } from "../curriculum/index.js";
import { escapeHtml } from "../format.js";
import { courseStats, moduleStats, lessonSolved } from "../ui.js";
import {
  quests,
  sessionStats,
  streakInfo,
  reviewStats,
  levelFor,
  totalXp,
  xpHistory,
} from "../game.js";
import * as store from "../store.js";

/** The first lesson that still has unsolved exercises. */
function nextLesson() {
  const lessons = allLessons();
  return lessons.find((lesson) => !lessonSolved(lesson)) || lessons[0];
}

function goalRing(session) {
  const radius = 49;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, session.xp / session.goal));
  return `
    <div class="goal-ring">
      <svg viewBox="0 0 116 116" aria-hidden="true">
        <defs>
          <linearGradient id="goalGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--accent)" />
            <stop offset="100%" stop-color="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle class="bg" cx="58" cy="58" r="${radius}" />
        <circle class="fg" cx="58" cy="58" r="${radius}"
          style="stroke-dasharray:${circumference};stroke-dashoffset:${offset}" />
      </svg>
      <div class="label">
        <b>${session.xp}</b>
        <span>of ${session.goal} XP</span>
      </div>
    </div>`;
}

function questList(items) {
  return items
    .map(
      (quest) => `
    <div class="quest ${quest.done ? "done" : ""}">
      <span class="tickbox">${quest.done ? "✓" : ""}</span>
      <div class="quest-body">
        <div class="quest-label">${escapeHtml(quest.label)}</div>
        <div class="bar"><i style="width:${Math.min(
          100,
          Math.round((quest.progress / quest.target) * 100)
        )}%"></i></div>
      </div>
      <span class="quest-count">${Math.min(quest.progress, quest.target)}/${quest.target}</span>
    </div>`
    )
    .join("");
}

function questMap() {
  const firstUnfinished = MODULES.findIndex((mod) => !moduleStats(mod).done);
  return `
    <div class="quest-map">
      ${MODULES.map((mod, i) => {
        const stats = moduleStats(mod);
        const reached = stats.solved > 0 || i === 0 || moduleStats(MODULES[i - 1]).done;
        const classes = [
          stats.done ? "done" : "",
          reached ? "reached" : "",
          i === firstUnfinished ? "current" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `
        <a class="map-node ${classes}" href="#/lesson/${mod.lessons[0].id}"
           title="${escapeHtml(mod.title)} — ${stats.solved}/${stats.total} exercises">
          <span class="map-dot">${stats.done ? "★" : mod.number}</span>
          <small>${escapeHtml(mod.title)}</small>
        </a>`;
      }).join("")}
    </div>`;
}

function sparkline(history) {
  const max = Math.max(10, ...history.map((d) => d.xp));
  return `<div class="spark">${history
    .map(
      (day, i) =>
        `<i class="${i === history.length - 1 ? "today" : ""}" style="height:${Math.round(
          (day.xp / max) * 100
        )}%" title="${day.day}: ${day.xp} XP"></i>`
    )
    .join("")}</div>`;
}

export default async function renderDashboard(container) {
  const stats = courseStats();
  const target = nextLesson();
  const state = store.getState();
  const started = stats.solved > 0 || Object.keys(state.visited).length > 0;
  const session = sessionStats();
  const daily = quests();
  const streak = streakInfo();
  const reviews = reviewStats();
  const level = levelFor(totalXp());

  const hero = `
    <section class="hero">
      <div class="eyebrow">Learn SQL from zero to expert</div>
      <h1>SQL Quest</h1>
      <p>
        Ten modules, ${allLessons().length} lessons and ${stats.total} graded exercises, all running against a
        real SQLite database inside this page. Write a query, press Check, and your answer is executed and
        compared with the reference solution — no accounts, no network, nothing to install.
      </p>
      <div class="row" style="margin-top:18px">
        ${
          started
            ? ""
            : `<a class="btn primary" href="#/lesson/${target.id}">Start the course → ${escapeHtml(
                target.title
              )}</a>`
        }
        <a class="btn ${started ? "" : "ghost"}" href="#/playground">Open the playground</a>
        <a class="btn ghost" href="#/schema">Explore the database</a>
        <a class="btn ghost" href="#/science">Why it works</a>
      </div>
    </section>`;

  const today = `
    <section class="today">
      <div>
        <h3>Today</h3>
        ${goalRing(session)}
        <p class="faint" style="text-align:center;margin:10px 0 0">
          ${
            session.goalMet
              ? "Daily goal met — anything more is a bonus."
              : `${session.goal - session.xp} XP to today's goal`
          }
        </p>
      </div>

      <div>
        <h3>Quests · reset at midnight</h3>
        ${questList(daily.items)}
        <p class="faint" style="margin:10px 0 0">
          ${
            daily.items.every((q) => q.done)
              ? "All three done. Freeze earned."
              : "Finish all three for a bonus and a streak freeze."
          }
        </p>
      </div>

      <div class="today-side">
        <a class="due-pill ${reviews.due ? "hot" : ""}" href="#/review">
          <b>${reviews.due}</b>
          <span>${reviews.due ? "recall cards due" : "recall deck clear"}</span>
        </a>
        <a class="due-pill" href="#/progress">
          <b>${streak.days}🔥</b>
          <span>day streak · ${streak.freezes} freeze${streak.freezes === 1 ? "" : "s"}</span>
        </a>
        <a class="btn primary" href="#/lesson/${target.id}" style="justify-content:center">
          ${started ? "Continue" : "Start"} → ${escapeHtml(target.title)}
        </a>
      </div>
    </section>`;

  container.innerHTML = `
    ${started ? today : hero}

    <h2>Course map</h2>
    ${questMap()}

    ${started ? hero : today}

    <section class="stat-grid" style="margin-bottom:22px">
      <div class="stat"><b>${level.level}</b><span>${escapeHtml(level.title)}</span></div>
      <div class="stat"><b>${stats.solved}<span style="font-size:1rem;color:var(--text-faint)"> / ${
        stats.total
      }</span></b><span>Exercises solved</span></div>
      <div class="stat"><b>${stats.pct}%</b><span>Course complete</span></div>
      <div class="stat"><b>${MODULES.filter((m) => moduleStats(m).done).length} / ${
        MODULES.length
      }</b><span>Modules finished</span></div>
    </section>

    ${
      started
        ? `<div class="card">
             <div class="row" style="margin-bottom:8px">
               <h3 style="margin:0">XP, last 14 days</h3>
               <span class="spacer"></span>
               <span class="faint">${totalXp()} XP total · ${
                 level.next ? `${level.toNext} to ${escapeHtml(level.next.title)}` : "top rank"
               }</span>
             </div>
             ${sparkline(xpHistory(14))}
           </div>`
        : ""
    }

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
        <h3>The rewards are explained</h3>
        <p class="muted">XP, quests, streaks and the recall deck all exist for a documented reason, and none
        of them can take anything away from you. <a href="#/science">See the design</a>.</p>
      </div>
    </div>`;
}
