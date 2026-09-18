/* =====================================================================
   SQL Quest — progress store (localStorage)
   ===================================================================== */

const KEY = "sqlquest.v1";

const EMPTY = {
  solved: {},      // exerciseId -> { at, attempts, hints, peeked }
  visited: {},     // lessonId   -> timestamp
  quiz: {},        // quizKey    -> chosen index
  snippets: [],    // playground saves
  settings: { theme: "dark" },
  stats: { queriesRun: 0, firstSeen: null, days: [] },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(EMPTY);
    const parsed = JSON.parse(raw);
    return { ...clone(EMPTY), ...parsed, settings: { ...EMPTY.settings, ...(parsed.settings || {}) },
             stats: { ...EMPTY.stats, ...(parsed.stats || {}) } };
  } catch {
    return clone(EMPTY);
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — progress simply won't survive the session */
  }
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function isSolved(exerciseId) {
  return Boolean(state.solved[exerciseId]);
}

export function solvedEntry(exerciseId) {
  return state.solved[exerciseId] || null;
}

export function markSolved(exerciseId, { hints = 0, peeked = false, attempts = 1 } = {}) {
  const existing = state.solved[exerciseId];
  state.solved[exerciseId] = {
    at: existing ? existing.at : Date.now(),
    attempts: (existing ? existing.attempts : 0) + attempts,
    hints: Math.max(existing ? existing.hints : 0, hints),
    peeked: Boolean(existing ? existing.peeked : false) || peeked,
  };
  touchDay();
  persist();
  return !existing;                       // true when newly solved
}

export function recordAttempt(exerciseId) {
  const entry = state.solved[exerciseId];
  if (entry) entry.attempts += 1;
  state.stats.queriesRun += 1;
  touchDay();
  persist();
}

export function markVisited(lessonId) {
  if (!state.visited[lessonId]) {
    state.visited[lessonId] = Date.now();
    touchDay();
    persist();
  }
}

export function isVisited(lessonId) {
  return Boolean(state.visited[lessonId]);
}

export function setQuizAnswer(key, choice) {
  state.quiz[key] = choice;
  persist();
}

export function getQuizAnswer(key) {
  return key in state.quiz ? state.quiz[key] : null;
}

function touchDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (!state.stats.firstSeen) state.stats.firstSeen = today;
  if (!state.stats.days.includes(today)) state.stats.days.push(today);
}

/** Consecutive days of practice, counting back from today. */
export function streak() {
  const days = [...state.stats.days].sort();
  if (!days.length) return 0;
  let count = 0;
  const cursor = new Date();
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    if (days.includes(iso)) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (count === 0 && iso === new Date().toISOString().slice(0, 10)) {
      cursor.setDate(cursor.getDate() - 1);          // today not practised yet
    } else break;
  }
  return count;
}

/* ------------------------------------------------------------ snippets */

export function saveSnippet(name, sql) {
  state.snippets = state.snippets.filter((s) => s.name !== name);
  state.snippets.unshift({ name, sql, at: Date.now() });
  state.snippets = state.snippets.slice(0, 40);
  persist();
}

export function deleteSnippet(name) {
  state.snippets = state.snippets.filter((s) => s.name !== name);
  persist();
}

export function snippets() {
  return state.snippets;
}

/* ------------------------------------------------------------ settings */

export function setTheme(theme) {
  state.settings.theme = theme;
  persist();
}

export function theme() {
  return state.settings.theme;
}

/* ------------------------------------------------------- import/export */

export function exportProgress() {
  return JSON.stringify(state, null, 2);
}

export function importProgress(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Not a progress file");
  state = { ...clone(EMPTY), ...parsed };
  persist();
}

export function resetProgress() {
  state = clone(EMPTY);
  persist();
}
