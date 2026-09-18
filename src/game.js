/* =====================================================================
   SQL Quest — motivation engine

   Every mechanism here is chosen because it has a documented effect on
   either motivation or retention, and each is deliberately kept on the
   honest side of the line:

   - XP / levels           competence feedback (self-determination theory).
                           Informational, never a payment for work you would
                           have done anyway — no XP is ever taken away.
   - Combo                 the "just one more" pull of an unbroken run,
                           capped so it cannot spiral.
   - Insight cards         variable-ratio surprise (reward prediction error),
                           but the payload is a fact worth knowing.
   - Daily quests          specific, moderately hard, achievable goals
                           (Locke & Latham) that reset the day cleanly.
   - Streak + freezes      habit cue with a built-in forgiveness token, so a
                           missed day does not trigger the "what the hell"
                           collapse that kills streak systems.
   - Recall deck           spaced retrieval practice — the single strongest
                           lever on long-term retention (testing effect +
                           spacing effect) and a genuine reason to return.
   ===================================================================== */

import * as store from "./store.js";
import { CARDS } from "./cards.js";

/* ------------------------------------------------------------ levels --- */

export const LEVELS = [
  { level: 1, at: 0, title: "Novice" },
  { level: 2, at: 120, title: "Apprentice" },
  { level: 3, at: 300, title: "Query Hand" },
  { level: 4, at: 560, title: "Filter Adept" },
  { level: 5, at: 900, title: "Aggregator" },
  { level: 6, at: 1350, title: "Join Runner" },
  { level: 7, at: 1900, title: "Subquery Adept" },
  { level: 8, at: 2600, title: "Window Wright" },
  { level: 9, at: 3500, title: "Pattern Seeker" },
  { level: 10, at: 4600, title: "Optimiser" },
  { level: 11, at: 6000, title: "Query Architect" },
  { level: 12, at: 7800, title: "Grandmaster of SELECT" },
];

export function levelFor(xp) {
  let current = LEVELS[0];
  for (const tier of LEVELS) if (xp >= tier.at) current = tier;
  const next = LEVELS.find((tier) => tier.at > xp) || null;
  const span = next ? next.at - current.at : 1;
  const into = xp - current.at;
  return {
    ...current,
    next,
    into,
    span,
    pct: next ? Math.min(100, Math.round((into / span) * 100)) : 100,
    toNext: next ? next.at - xp : 0,
  };
}

/* -------------------------------------------------------------- dates --- */

export function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
}

/* ------------------------------------------------------------- session --- */

function session(gameState) {
  const day = today();
  if (!gameState.session || gameState.session.day !== day) {
    gameState.session = { day, xp: 0, solved: 0, combo: 0, bestCombo: 0 };
  }
  return gameState.session;
}

export function sessionStats() {
  const gameState = store.game();
  const current = gameState.session && gameState.session.day === today()
    ? gameState.session
    : { day: today(), xp: 0, solved: 0, combo: 0, bestCombo: 0 };
  return {
    ...current,
    goal: gameState.dailyGoal || 60,
    goalPct: Math.min(100, Math.round((current.xp / (gameState.dailyGoal || 60)) * 100)),
    goalMet: current.xp >= (gameState.dailyGoal || 60),
  };
}

/* -------------------------------------------------------------- quests --- */

const QUEST_POOL = [
  { id: "solve3", event: "exercise", target: 3, label: "Solve 3 exercises" },
  { id: "unaided2", event: "unaided", target: 2, label: "Solve 2 without hints" },
  { id: "lesson1", event: "lesson", target: 1, label: "Finish a whole lesson" },
  { id: "review3", event: "review", target: 3, label: "Clear 3 recall cards", needsReviews: true },
  { id: "quiz3", event: "quiz", target: 3, label: "Answer 3 quiz questions" },
  { id: "play5", event: "playground", target: 5, label: "Run 5 queries in the playground" },
  { id: "solve5", event: "exercise", target: 5, label: "Solve 5 exercises" },
  { id: "newlesson2", event: "lesson", target: 2, label: "Finish 2 lessons" },
];

/** Deterministic per-day pick, so the quests do not reshuffle on reload. */
function hashDay(iso) {
  let hash = 0;
  for (const ch of iso) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function buildQuests(gameState) {
  const day = today();
  const hasReviews = dueReviewIds().length > 0;
  const pool = QUEST_POOL.filter((quest) => !quest.needsReviews || hasReviews);
  // walk the pool from a day-dependent offset: deterministic, and every
  // step lands on a different slot (a stride equal to the pool length does not)
  const start = hashDay(day) % pool.length;
  const chosen = [];
  const seenEvents = new Set();
  for (let i = 0; i < pool.length && chosen.length < 3; i += 1) {
    const quest = pool[(start + i) % pool.length];
    if (seenEvents.has(quest.event)) continue;
    seenEvents.add(quest.event);
    chosen.push({ ...quest, progress: 0, done: false });
  }
  gameState.quests = { day, items: chosen, perfectClaimed: false };
  return gameState.quests;
}

export function quests() {
  return store.updateGame((gameState) => {
    if (!gameState.quests || gameState.quests.day !== today()) buildQuests(gameState);
    return gameState.quests;
  });
}

/* -------------------------------------------------------------- streak --- */

/** Record activity for today, consuming a freeze if exactly one day was missed. */
function touchStreak(gameState) {
  const day = today();
  const days = store.getState().stats.days;
  if (!days.includes(day)) days.push(day);

  const previous = days
    .filter((d) => d < day)
    .sort()
    .pop();
  if (previous && daysBetween(previous, day) === 2 && gameState.freezes > 0) {
    // one missed day, and we have a token: keep the streak alive
    const missed = addDays(previous, 1);
    gameState.freezes -= 1;
    if (!gameState.frozen.includes(missed)) gameState.frozen.push(missed);
    if (!days.includes(missed)) days.push(missed);
    return { frozenDay: missed };
  }
  return {};
}

export function streakInfo() {
  const gameState = store.game();
  const days = [...store.getState().stats.days].sort();
  let count = 0;
  let cursor = today();
  if (!days.includes(cursor)) cursor = addDays(cursor, -1);   // today not practised yet
  while (days.includes(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return {
    days: count,
    freezes: gameState.freezes,
    practisedToday: days.includes(today()),
    frozen: gameState.frozen.length,
  };
}

/* ----------------------------------------------------------- recall deck --- */

const FIRST_INTERVAL = 1;
const START_EASE = 2.4;

/** Schedule (or reschedule) an exercise for spaced retrieval practice. */
export function scheduleReview(exerciseId, success = true) {
  return store.updateGame((gameState) => {
    const existing = gameState.reviews[exerciseId];
    if (!existing) {
      gameState.reviews[exerciseId] = {
        due: addDays(today(), FIRST_INTERVAL),
        interval: FIRST_INTERVAL,
        ease: START_EASE,
        reps: 1,
        lapses: 0,
      };
      return gameState.reviews[exerciseId];
    }
    if (success) {
      existing.ease = Math.min(3, existing.ease + 0.1);
      existing.interval = Math.max(1, Math.round(existing.interval * existing.ease));
      existing.reps += 1;
    } else {
      existing.ease = Math.max(1.6, existing.ease - 0.3);
      existing.interval = FIRST_INTERVAL;
      existing.lapses += 1;
    }
    existing.due = addDays(today(), existing.interval);
    return existing;
  });
}

export function dueReviewIds() {
  const reviews = store.game().reviews || {};
  const day = today();
  return Object.entries(reviews)
    .filter(([, card]) => card.due <= day)
    .sort((a, b) => (a[1].due < b[1].due ? -1 : 1))
    .map(([id]) => id);
}

export function reviewStats() {
  const reviews = store.game().reviews || {};
  const entries = Object.values(reviews);
  const day = today();
  const upcoming = entries
    .filter((card) => card.due > day)
    .map((card) => card.due)
    .sort();
  return {
    tracked: entries.length,
    due: entries.filter((card) => card.due <= day).length,
    mature: entries.filter((card) => card.interval >= 16).length,
    nextDue: upcoming[0] || null,
  };
}

/* --------------------------------------------------------------- awards --- */

const SURPRISE_CARD_CHANCE = 0.18;
const SURPRISE_DOUBLE_CHANCE = 0.06;

function logXp(gameState, amount) {
  const day = today();
  gameState.log[day] = (gameState.log[day] || 0) + amount;
  gameState.xp += amount;
  session(gameState).xp += amount;
}

function drawCard(gameState) {
  const unseen = CARDS.filter((card) => !gameState.cards.includes(card.id));
  if (!unseen.length) return null;
  const card = unseen[Math.floor(Math.random() * unseen.length)];
  gameState.cards.push(card.id);
  return card;
}

/**
 * Award a solved exercise.
 * @returns {{xp, combo, levelUp, card, doubled, quests, streak}}
 */
export function awardExercise({ moduleNumber = 1, hints = 0, peeked = false, isNew = true }) {
  return store.updateGame((gameState) => {
    const before = levelFor(gameState.xp);
    const current = session(gameState);
    const streakEvent = touchStreak(gameState);

    if (!isNew) {
      // re-solving something already done: keep the loop honest, no XP
      return { xp: 0, combo: current.combo, levelUp: null, card: null, quests: [], ...streakEvent };
    }

    current.combo += 1;
    current.bestCombo = Math.max(current.bestCombo, current.combo);
    current.solved += 1;

    const base = 10 + moduleNumber * 2;
    const comboMultiplier = 1 + Math.min(0.5, 0.1 * (current.combo - 1));
    const aidFactor = peeked ? 0.4 : hints > 0 ? 0.8 : 1.25;   // unaided pays, help still pays
    const doubled = Math.random() < SURPRISE_DOUBLE_CHANCE;
    let amount = Math.round(base * comboMultiplier * aidFactor) * (doubled ? 2 : 1);

    const card = Math.random() < SURPRISE_CARD_CHANCE ? drawCard(gameState) : null;
    if (card) amount += 15;

    logXp(gameState, amount);

    const completed = noteQuestEvent(gameState, "exercise");
    if (!hints && !peeked) completed.push(...noteQuestEvent(gameState, "unaided"));

    const after = levelFor(gameState.xp);
    return {
      xp: amount,
      combo: current.combo,
      doubled,
      card,
      levelUp: after.level > before.level ? after : null,
      quests: completed,
      ...streakEvent,
    };
  });
}

/** A wrong attempt breaks the combo but costs nothing else. */
export function breakCombo() {
  store.updateGame((gameState) => {
    session(gameState).combo = 0;
  });
}

export function awardReview({ moduleNumber = 1, success = true }) {
  return store.updateGame((gameState) => {
    const before = levelFor(gameState.xp);
    touchStreak(gameState);
    if (!success) return { xp: 0, levelUp: null, quests: [] };
    const amount = 5 + moduleNumber;
    logXp(gameState, amount);
    const completed = noteQuestEvent(gameState, "review");
    const after = levelFor(gameState.xp);
    return {
      xp: amount,
      levelUp: after.level > before.level ? after : null,
      quests: completed,
    };
  });
}

const SMALL_AWARDS = { quiz: 3, lesson: 8, playground: 0 };

/** Quiz answers, finished lessons, playground queries. */
export function awardEvent(event) {
  return store.updateGame((gameState) => {
    const before = levelFor(gameState.xp);
    touchStreak(gameState);
    const amount = SMALL_AWARDS[event] || 0;
    if (amount) logXp(gameState, amount);
    const completed = noteQuestEvent(gameState, event);
    const after = levelFor(gameState.xp);
    return {
      xp: amount,
      levelUp: after.level > before.level ? after : null,
      quests: completed,
    };
  });
}

/* ------------------------------------------------------ quest bookkeeping --- */

const QUEST_BONUS = 40;
const PERFECT_DAY_BONUS = 60;

function noteQuestEvent(gameState, event) {
  if (!gameState.quests || gameState.quests.day !== today()) buildQuests(gameState);
  const completed = [];
  for (const quest of gameState.quests.items) {
    if (quest.event !== event || quest.done) continue;
    quest.progress += 1;
    if (quest.progress >= quest.target) {
      quest.done = true;
      logXp(gameState, QUEST_BONUS);
      completed.push({ ...quest, bonus: QUEST_BONUS });
    }
  }
  const all = gameState.quests.items.every((quest) => quest.done);
  if (all && !gameState.quests.perfectClaimed) {
    gameState.quests.perfectClaimed = true;
    gameState.freezes = Math.min(3, gameState.freezes + 1);
    logXp(gameState, PERFECT_DAY_BONUS);
    completed.push({ id: "perfect", label: "Every quest done today", bonus: PERFECT_DAY_BONUS, freeze: true });
  }
  return completed;
}

/** Award a finished lesson exactly once. */
export function completeLesson(lessonId) {
  const first = store.updateGame((gameState) => {
    gameState.lessonsDone = gameState.lessonsDone || [];
    if (gameState.lessonsDone.includes(lessonId)) return false;
    gameState.lessonsDone.push(lessonId);
    return true;
  });
  return first ? awardEvent("lesson") : null;
}

/* --------------------------------------------------------------- misc --- */

export function collectedCards() {
  const owned = store.game().cards || [];
  return CARDS.map((card) => ({ ...card, owned: owned.includes(card.id) }));
}

export function xpHistory(days = 14) {
  const log = store.game().log || {};
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = addDays(today(), -i);
    out.push({ day, xp: log[day] || 0 });
  }
  return out;
}

export function totalXp() {
  return store.game().xp || 0;
}
