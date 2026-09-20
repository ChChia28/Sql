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
import { status as storageStatus, flush, saveBackupFile, copyText } from "../persist.js";

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
  const storage = storageStatus();

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

    <h2 style="margin-top:26px">Backup &amp; restore</h2>
    <div class="card">
      <div class="row" style="margin-bottom:10px">
        <span class="storage-pill ${storage.mode}"><span class="dot"></span>${escapeHtml(
          storage.label
        )}</span>
        <span class="spacer"></span>
        <span class="faint">${stats.solved} solved · ${totalXp()} XP · ${
          Object.keys(state.game.reviews || {}).length
        } recall cards</span>
      </div>
      <p class="muted" style="margin-bottom:0">${
        storage.mode === "cloud"
          ? "Your progress is stored against your Claude account, so it survives closing this page and follows you to other devices."
          : storage.mode === "local"
            ? "Your progress lives in this browser's storage. It survives reloads here, but not a different browser, device or private window — keep a backup code if this matters."
            : "<strong>Nothing is being stored in this view.</strong> Copy the backup code below before you close the page, and paste it back in to carry on."
      }</p>
    </div>

    <div class="card">
      <h3>1 · Take a backup</h3>
      <p class="muted">Everything — solved exercises, XP, streak, recall schedule, insight cards — in one code.</p>
      <div class="row">
        <button class="btn primary" id="copy-btn">⧉ Copy backup code</button>
        <button class="btn" id="file-btn">⭳ Save as file</button>
        <button class="btn ghost" id="show-btn">Show the code</button>
      </div>
      <textarea class="backup-box" id="backup-box" rows="4" readonly spellcheck="false" hidden></textarea>
    </div>

    <div class="card">
      <h3>2 · Restore a backup</h3>
      <p class="muted">Paste a backup code and press Restore. Restoring <strong>merges</strong> — it can only
      add progress, never remove what you have already done.</p>
      <textarea class="backup-box" id="restore-box" rows="4" spellcheck="false"
        placeholder="Paste your backup code here…"></textarea>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" id="restore-btn">⭱ Restore</button>
        <span class="faint" id="restore-note"></span>
      </div>
    </div>

    <div class="card">
      <h3>Start over</h3>
      <p class="muted">Deletes all progress, badges, recall cards and saved snippets in this browser.</p>
      <button class="btn ghost" id="reset-btn">Reset everything</button>
    </div>`;

  const backupText = () => JSON.stringify(store.backupPayload(), null, 2);
  const box = container.querySelector("#backup-box");
  const note = container.querySelector("#restore-note");

  container.querySelector("#show-btn").addEventListener("click", () => {
    box.value = backupText();
    box.hidden = !box.hidden;
    if (!box.hidden) box.select();
  });

  container.querySelector("#copy-btn").addEventListener("click", async () => {
    const text = backupText();
    box.value = text;
    box.hidden = false;
    const copied = await copyText(text, box);
    if (copied) toast("Backup code copied to the clipboard", "ok");
    else {
      box.select();
      toast("Select the text and press Ctrl/⌘ + C to copy it", "warn");
    }
  });

  container.querySelector("#file-btn").addEventListener("click", async () => {
    try {
      const result = await saveBackupFile("sql-quest-progress.json", backupText());
      toast(result === "saved" ? "Backup file saved" : "Backup file offered", "ok");
    } catch (err) {
      box.value = backupText();
      box.hidden = false;
      box.select();
      toast(
        err && err.code === "declined"
          ? "Save cancelled — the code is shown below instead"
          : "This view will not save files — copy the code below instead",
        "warn"
      );
    }
  });

  container.querySelector("#restore-btn").addEventListener("click", async () => {
    const raw = container.querySelector("#restore-box").value.trim();
    if (!raw) {
      note.textContent = "Paste a backup code first.";
      return;
    }
    try {
      const before = courseStats().solved;
      store.importProgress(raw);
      await flush();
      const after = courseStats().solved;
      toast(
        after > before
          ? `Restored — ${after - before} more exercise${after - before === 1 ? "" : "s"} marked solved`
          : "Restored — nothing new to add",
        "ok"
      );
      renderProgress(container);
    } catch (err) {
      note.textContent = `Could not restore: ${err.message}`;
    }
  });

  container.querySelector("#reset-btn").addEventListener("click", async () => {
    const where =
      storage.mode === "cloud"
        ? "This clears it here and in your Claude account."
        : "This cannot be undone.";
    if (!confirm(`Delete all progress, badges, recall cards and saved snippets? ${where}`)) return;
    store.resetProgress();
    await flush();          // push the cleared state, or the next load restores it
    toast("Progress reset");
    renderProgress(container);
  });
}
