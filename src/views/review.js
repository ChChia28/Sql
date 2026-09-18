/* =====================================================================
   SQL Quest — recall deck
   Spaced retrieval practice over exercises you have already solved.
   Re-writing a query from memory a day later, then three days later, is
   what moves it from "I followed that" to "I can do that" — and it gives
   the app an honest reason to be worth opening tomorrow.
   ===================================================================== */

import { allExercises } from "../curriculum/index.js";
import { renderMarkdown, escapeHtml, resultTable, resultMeta, codeBlock } from "../format.js";
import { createEditor } from "../editor.js";
import { gradeExercise } from "../grader.js";
import { dueReviewIds, scheduleReview, awardReview, reviewStats } from "../game.js";
import {
  toast,
  xpFloat,
  confetti,
  levelUpBanner,
  questToast,
  attachRunButtons,
} from "../ui.js";

function emptyState(stats) {
  const soon = stats.nextDue
    ? `Next cards are due on <strong>${escapeHtml(stats.nextDue)}</strong>.`
    : "Solve a few exercises and they will start appearing here tomorrow.";
  return `
    <div class="card" style="text-align:center;padding:40px 24px">
      <div style="font-size:2.4rem">🧠</div>
      <h2 style="margin-top:.4em">Deck clear</h2>
      <p class="muted">${soon}</p>
      <p class="faint">${stats.tracked} exercise${stats.tracked === 1 ? "" : "s"} tracked ·
        ${stats.mature} at long intervals</p>
      <div class="row" style="justify-content:center;margin-top:10px">
        <a class="btn primary" href="#/">Back to the course</a>
      </div>
    </div>`;
}

export default async function renderReview(container) {
  const byId = new Map(allExercises().map((exercise) => [exercise.id, exercise]));
  const queue = dueReviewIds().filter((id) => byId.has(id));
  const stats = reviewStats();
  const total = queue.length;
  let index = 0;
  let cleared = 0;

  container.innerHTML = `
    <div class="breadcrumb"><a href="#/">Dashboard</a> · Recall deck</div>
    <h1>Recall deck</h1>
    <p class="muted">Exercises you have solved before, resurfacing at widening intervals.
    Write the query from memory — the effort is the part that works.</p>
    <div id="deck"></div>`;

  const deck = container.querySelector("#deck");

  function finish() {
    deck.innerHTML = emptyState(reviewStats());
    if (cleared > 0) {
      const card = deck.querySelector(".card");
      confetti(card, 30);
    }
  }

  function renderCard() {
    if (index >= queue.length) return finish();

    const exercise = byId.get(queue[index]);
    const done = index;
    deck.innerHTML = `
      <div class="deck-head">
        <span class="pill accent">${done + 1} of ${total}</span>
        <div class="deck-progress bar"><i style="width:${Math.round((done / total) * 100)}%"></i></div>
        <span class="faint">${escapeHtml(exercise.module.title)} · ${escapeHtml(exercise.lesson.title)}</span>
      </div>
      <section class="recall-card">
        <div class="exercise-head">
          <h3>From memory</h3>
          <span class="spacer"></span>
          <a class="btn small ghost" href="#/lesson/${exercise.lesson.id}">Open the lesson</a>
        </div>
        <div class="exercise-body">
          <div class="task prose">${renderMarkdown(exercise.prompt)}</div>
          <div data-role="editor"></div>
          <div data-role="feedback"></div>
          <details class="solution" data-role="solution">
            <summary>I cannot remember — show the answer</summary>
            <div data-role="solution-body"></div>
          </details>
        </div>
      </section>`;

    const feedback = deck.querySelector('[data-role="feedback"]');
    const solutionDetails = deck.querySelector('[data-role="solution"]');
    const solutionBody = deck.querySelector('[data-role="solution-body"]');
    let lapsed = false;

    solutionDetails.addEventListener("toggle", () => {
      if (!solutionDetails.open || solutionBody.innerHTML) return;
      solutionBody.innerHTML = codeBlock(exercise.solution, {
        runnable: true,
        label: "reference solution",
      });
      attachRunButtons(solutionBody);
      lapsed = true;
      // an answer you had to look up comes back tomorrow, not in a month
      scheduleReview(exercise.id, false);
      feedback.innerHTML =
        '<div class="msg info">No problem — this card is back in the deck for tomorrow.</div>';
    });

    async function check(editor) {
      editor.setBusy(true);
      feedback.innerHTML = '<div class="msg info">Checking…</div>';
      try {
        const verdict = await gradeExercise(exercise, editor.getValue());
        if (verdict.status === "pass") {
          if (!lapsed) {
            scheduleReview(exercise.id, true);
            const award = awardReview({ moduleNumber: exercise.module.number, success: true });
            xpFloat(editor.el.querySelector(".btn.primary"), `+${award.xp} XP`);
            for (const quest of award.quests || []) questToast(quest);
            if (award.levelUp) levelUpBanner(award.levelUp);
            cleared += 1;
          }
          const next = deck.querySelector(".recall-card");
          confetti(next, 14);
          feedback.innerHTML = `<div class="msg ok"><strong>Still there.</strong> ${
            lapsed ? "It will come round again tomorrow." : "Moving it further out."
          }</div>${
            verdict.result ? resultMeta(verdict.result, verdict.elapsed) + resultTable(verdict.result, { maxRows: 12 }) : ""
          }`;
          setTimeout(() => {
            index += 1;
            renderCard();
          }, 900);
        } else {
          lapsed = true;
          scheduleReview(exercise.id, false);
          feedback.innerHTML = `<div class="msg warn"><strong>${escapeHtml(verdict.title)}</strong>${
            verdict.detail ? `<div style="margin-top:6px">${verdict.detail}</div>` : ""
          }<div style="margin-top:6px">Try again — this card stays in tomorrow's deck either way.</div></div>`;
        }
      } catch (err) {
        feedback.innerHTML = `<div class="msg err">${escapeHtml(err.message)}</div>`;
      } finally {
        editor.setBusy(false);
      }
    }

    const editor = createEditor({
      value: "",
      height: 150,
      storageKey: "",
      onRun: check,
      hint: "Ctrl/⌘ + Enter to check",
      buttons: [
        {
          label: "Skip for now",
          className: "btn small ghost",
          onClick: () => {
            index += 1;
            renderCard();
          },
        },
      ],
    });
    // in the deck the primary action is the check itself
    editor.el.querySelector(".btn.primary").textContent = "✓ Check";
    deck.querySelector('[data-role="editor"]').append(editor.el);
    editor.focus();
  }

  if (!total) {
    deck.innerHTML = emptyState(stats);
    return;
  }
  toast(`${total} card${total === 1 ? "" : "s"} due`, "");
  renderCard();
}
