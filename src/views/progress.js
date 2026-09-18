/* =====================================================================
   SQL Quest — progress, badges, import/export
   ===================================================================== */

import { MODULES } from "../curriculum/index.js";
import { escapeHtml } from "../format.js";
import { courseStats, moduleStats, badgeState, toast } from "../ui.js";
import * as store from "../store.js";

export default async function renderProgress(container) {
  const stats = courseStats();
  const state = store.getState();
  const badges = badgeState();
  const unaided = Object.values(state.solved).filter((s) => !s.peeked && !s.hints).length;
  const attempts = Object.values(state.solved).reduce((sum, s) => sum + s.attempts, 0);

  container.innerHTML = `
    <div class="breadcrumb"><a href="#/">Dashboard</a> · Progress</div>
    <h1>Your progress</h1>

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
