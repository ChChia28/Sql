/* =====================================================================
   SQL Quest — progress, badges, import/export
   ===================================================================== */

import { MODULES } from "../curriculum/index.js";
import { escapeHtml } from "../format.js";
import { courseStats, moduleStats, badgeState, toast } from "../ui.js";
import {
  levelFor,
  totalXp,
  streakInfo,
  reviewStats,
  collectedCards,
  sessionStats,
} from "../game.js";
import * as store from "../store.js";

export default async function renderProgress(container) {
  const stats = courseStats();
  const state = store.getState();
  const badges = badgeState();
  const unaided = Object.values(state.solved).filter((s) => !s.peeked && !s.hints).length;
  const attempts = Object.values(state.solved).reduce((sum, s) => sum + s.attempts, 0);

  const level = levelFor(totalXp());
  const streak = streakInfo();
  const reviews = reviewStats();
  const cards = collectedCards();
  const owned = cards.filter((card) => card.owned).length;
  const session = sessionStats();

  container.innerHTML = `
    <div class="breadcrumb"><a href="#/">Dashboard</a> · Progress</div>
    <h1>Your progress</h1>

    <div class="card">
      <div class="row" style="margin-bottom:10px">
        <span class="pill accent">Level ${level.level}</span>
        <strong>${escapeHtml(level.title)}</strong>
        <span class="spacer"></span>
        <span class="faint">${totalXp()} XP${
          level.next ? ` · ${level.toNext} to ${escapeHtml(level.next.title)}` : " · top rank"
        }</span>
      </div>
      <div class="bar"><i style="width:${level.pct}%"></i></div>
      <div class="row" style="margin-top:12px">
        <span class="faint">Today: ${session.xp} / ${session.goal} XP</span>
        <span class="spacer"></span>
        <span class="faint">${streak.days}-day streak · ${streak.freezes} freeze${
          streak.freezes === 1 ? "" : "s"
        }${streak.frozen ? ` · ${streak.frozen} day${streak.frozen === 1 ? "" : "s"} covered` : ""}</span>
      </div>
    </div>

    <div class="stat-grid" style="margin-bottom:22px">
      <div class="stat"><b>${stats.solved} / ${stats.total}</b><span>Exercises solved</span></div>
      <div class="stat"><b>${stats.pct}%</b><span>Course complete</span></div>
      <div class="stat"><b>${unaided}</b><span>Solved unaided</span></div>
      <div class="stat"><b>${store.streak()}</b><span>Day streak</span></div>
      <div class="stat"><b>${state.stats.queriesRun}</b><span>Queries run</span></div>
      <div class="stat"><b>${attempts}</b><span>Total attempts</span></div>
    </div>

    <h2>By module</h2>
    <div class="card">
      ${MODULES.map((mod) => {
        const ms = moduleStats(mod);
        return `
        <div style="margin-bottom:14px">
          <div class="row" style="margin-bottom:5px">
            <a href="#/lesson/${mod.lessons[0].id}"><strong>${mod.number}. ${escapeHtml(
              mod.title
            )}</strong></a>
            <span class="spacer"></span>
            <span class="faint">${ms.solved} / ${ms.total}</span>
            ${ms.done ? '<span class="pill ok">done</span>' : ""}
          </div>
          <div class="bar"><i style="width:${ms.pct}%"></i></div>
        </div>`;
      }).join("")}
    </div>

    <h2>Recall deck</h2>
    <div class="card">
      <div class="row">
        <div class="stat" style="border:0;padding:0;background:none">
          <b>${reviews.due}</b><span>Due now</span>
        </div>
        <div class="stat" style="border:0;padding:0;background:none">
          <b>${reviews.tracked}</b><span>Tracked</span>
        </div>
        <div class="stat" style="border:0;padding:0;background:none">
          <b>${reviews.mature}</b><span>Long intervals</span>
        </div>
        <span class="spacer"></span>
        <a class="btn ${reviews.due ? "primary" : "ghost"}" href="#/review">
          ${reviews.due ? `Practise ${reviews.due} card${reviews.due === 1 ? "" : "s"}` : "Deck is clear"}
        </a>
      </div>
      <p class="faint" style="margin:10px 0 0">Solved exercises come back at widening intervals —
      spaced retrieval is the part that makes them stick. <a href="#/science">Why</a>.</p>
    </div>

    <h2>Insight cards <span class="faint" style="font-size:.8rem">${owned} / ${cards.length}</span></h2>
    <div class="card-grid" style="margin-bottom:22px">
      ${cards
        .map(
          (card) => `
        <div class="insight-card ${card.owned ? "" : "locked"}">
          <b>${card.owned ? escapeHtml(card.title) : "Undiscovered"}</b>
          <p>${escapeHtml(card.body)}</p>
        </div>`
        )
        .join("")}
    </div>

    <h2>Badges</h2>
    <div class="badges">
      ${badges
        .map(
          (badge) => `
        <div class="badge ${badge.isEarned ? "earned" : ""}">
          <span class="ico">${badge.icon}</span>
          <span><b>${escapeHtml(badge.name)}</b><span>${escapeHtml(badge.desc)}</span></span>
        </div>`
        )
        .join("")}
    </div>

    <h2 style="margin-top:26px">Your data</h2>
    <div class="card">
      <p class="muted">Progress is stored in this browser only. Export it to move to another machine, or
      wipe it to start the course fresh.</p>
      <div class="row">
        <button class="btn" id="export-btn">⭳ Export progress</button>
        <button class="btn" id="import-btn">⭱ Import progress</button>
        <button class="btn ghost" id="reset-btn">Reset everything</button>
      </div>
      <textarea id="import-box" hidden rows="6" spellcheck="false"
        style="width:100%;margin-top:12px;font-family:var(--mono);font-size:.8rem;padding:10px;
               border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text)"
        placeholder="Paste an exported progress file here, then press Import again."></textarea>
    </div>`;

  container.querySelector("#export-btn").addEventListener("click", () => {
    const blob = new Blob([store.exportProgress()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sql-quest-progress.json";
    link.click();
    URL.revokeObjectURL(url);
    toast("Progress exported", "ok");
  });

  const box = container.querySelector("#import-box");
  container.querySelector("#import-btn").addEventListener("click", () => {
    if (box.hidden) {
      box.hidden = false;
      box.focus();
      return;
    }
    try {
      store.importProgress(box.value);
      toast("Progress imported", "ok");
      renderProgress(container);
    } catch (err) {
      toast(`Could not import: ${err.message}`, "warn");
    }
  });

  container.querySelector("#reset-btn").addEventListener("click", () => {
    if (confirm("Delete all progress, badges and saved snippets? This cannot be undone.")) {
      store.resetProgress();
      toast("Progress reset");
      renderProgress(container);
    }
  });
}
