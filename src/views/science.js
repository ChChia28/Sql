/* =====================================================================
   SQL Quest — "Why it works"
   The motivation design, in the open: what each mechanism is, the evidence
   behind it, and the dark patterns it deliberately avoids.
   ===================================================================== */

import { renderMarkdown, escapeHtml } from "../format.js";
import { levelFor, totalXp, streakInfo, reviewStats, collectedCards } from "../game.js";
import * as store from "../store.js";

let cached = null;

export default async function renderScience(container) {
  if (!cached) {
    const response = await fetch("content/science.md");
    if (!response.ok) throw new Error("Could not load content/science.md");
    cached = await response.text();
  }

  const level = levelFor(totalXp());
  const streak = streakInfo();
  const reviews = reviewStats();
  const cards = collectedCards().filter((card) => card.owned).length;

  container.innerHTML = `
    <div class="breadcrumb"><a href="#/">Dashboard</a> · Why it works</div>
    <h1>The motivation design, in the open</h1>
    <p class="muted">Every reward in this app is described here, along with the research it leans on —
    including the parts that could be used against you, and why they are not.</p>

    <div class="stat-grid" style="margin-bottom:22px">
      <div class="stat"><b>${level.level}</b><span>${escapeHtml(level.title)}</span></div>
      <div class="stat"><b>${streak.days}</b><span>Day streak · ${streak.freezes} freeze${
        streak.freezes === 1 ? "" : "s"
      }</span></div>
      <div class="stat"><b>${reviews.tracked}</b><span>Cards in the recall deck</span></div>
      <div class="stat"><b>${cards}</b><span>Insight cards found</span></div>
    </div>

    <div class="prose">${renderMarkdown(cached)}</div>

    <div class="card" style="margin-top:22px">
      <h3>Your controls</h3>
      <p class="muted">If a mechanism is not helping you, turn it down. None of them are load-bearing.</p>
      <div class="row">
        <label class="faint" for="daily-goal">Daily XP goal</label>
        <select id="daily-goal" class="btn small">
          ${[30, 60, 100, 150]
            .map(
              (value) =>
                `<option value="${value}" ${
                  (store.game().dailyGoal || 60) === value ? "selected" : ""
                }>${value} XP</option>`
            )
            .join("")}
        </select>
        <span class="spacer"></span>
        <a class="btn ghost small" href="#/progress">Progress &amp; data</a>
      </div>
    </div>`;

  container.querySelector("#daily-goal").addEventListener("change", (event) => {
    const value = Number(event.target.value);
    store.updateGame((gameState) => {
      gameState.dailyGoal = value;
    });
  });
}
