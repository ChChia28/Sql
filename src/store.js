/* =====================================================================
   SQL Quest — progress store (localStorage)
   ===================================================================== */

const KEY = "sqlquest.v1";

const EMPTY = {
  solved: {},      // exerciseId -> { at, attempts, hints, peeked }
  visited: {},     // lessonId   -> timestamp
  quiz: {},        // quizKey    -> chosen index
  snippets: [],    // playground saves
  settings: { theme: null },   // null = follow the host/system theme
  stats: { queriesRun: 0, firstSeen: null, days: [] },
  game: {
    xp: 0,
    freezes: 2,        // streak freezes in hand
    frozen: [],        // days a freeze covered
    quests: null,      // { day, items: [...], perfectClaimed }
    session: null,     // { day, xp, solved, combo, bestCombo }
    reviews: {},       // exerciseId -> { due, interval, ease, reps, lapses }
    cards: [],         // discovered insight-card ids
    log: {},           // YYYY-MM-DD -> xp earned that day
    seeds: [],         // ids of one-off starting points already applied
    dailyGoal: 60,
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(EMPTY);
    const parsed = JSON.parse(raw);
    return {
      ...clone(EMPTY),
      ...parsed,
      settings: { ...EMPTY.settings, ...(parsed.settings || {}) },
      stats: { ...EMPTY.stats, ...(parsed.stats || {}) },
      game: { ...clone(EMPTY.game), ...(parsed.game || {}) },
    };
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

/* ---------------------------------------------------------------- game */

export function game() {
  return state.game;
}

/** Mutate the game slice and persist once. */
export function updateGame(mutator) {
  const result = mutator(state.game);
  persist();
  return result;
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

/* ---------------------------------------------------------------- merge */

const uniq = (list) => [...new Set(list || [])];
const minDefined = (a, b) => (a && b ? Math.min(a, b) : a || b);

/**
 * Combine two progress states without ever losing work: solved exercises,
 * visited lessons, cards and XP are unioned or maxed, never replaced. Used
 * both when remote progress arrives and when a backup is restored.
 */
export function mergeStates(base, incoming) {
  if (!incoming || typeof incoming !== "object") return base;
  const merged = clone(base);
  // Snapshots delivered by the account store are FROZEN, and so is everything
  // inside them. Copying one into state gives us an object the app cannot
  // later mutate ("Cannot assign to read only property"), so deep-clone first.
  const other = clone(incoming);

  for (const [id, entry] of Object.entries(other.solved || {})) {
    const mine = merged.solved[id];
    merged.solved[id] = mine
      ? {
          at: minDefined(mine.at, entry.at),
          attempts: Math.max(mine.attempts || 0, entry.attempts || 0),
          hints: Math.max(mine.hints || 0, entry.hints || 0),
          peeked: Boolean(mine.peeked || entry.peeked),
        }
      : entry;
  }

  for (const [id, at] of Object.entries(other.visited || {})) {
    merged.visited[id] = minDefined(merged.visited[id], at);
  }

  for (const [key, choice] of Object.entries(other.quiz || {})) {
    if (!(key in merged.quiz)) merged.quiz[key] = choice;
  }

  const byName = new Map(merged.snippets.map((s) => [s.name, s]));
  for (const snippet of other.snippets || []) {
    const mine = byName.get(snippet.name);
    if (!mine || (snippet.at || 0) > (mine.at || 0)) byName.set(snippet.name, snippet);
  }
  merged.snippets = [...byName.values()].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 40);

  merged.settings = {
    ...(other.settings || {}),
    ...merged.settings,
    theme: merged.settings.theme || (other.settings || {}).theme || null,
  };

  const otherStats = other.stats || {};
  merged.stats = {
    queriesRun: Math.max(merged.stats.queriesRun || 0, otherStats.queriesRun || 0),
    firstSeen:
      merged.stats.firstSeen && otherStats.firstSeen
        ? [merged.stats.firstSeen, otherStats.firstSeen].sort()[0]
        : merged.stats.firstSeen || otherStats.firstSeen || null,
    days: uniq([...(merged.stats.days || []), ...(otherStats.days || [])]).sort(),
  };

  const mineGame = merged.game;
  const theirGame = other.game || {};
  mineGame.xp = Math.max(mineGame.xp || 0, theirGame.xp || 0);
  mineGame.freezes = Math.max(mineGame.freezes || 0, theirGame.freezes || 0);
  mineGame.frozen = uniq([...(mineGame.frozen || []), ...(theirGame.frozen || [])]).sort();
  mineGame.cards = uniq([...(mineGame.cards || []), ...(theirGame.cards || [])]);
  mineGame.lessonsDone = uniq([
    ...(mineGame.lessonsDone || []),
    ...(theirGame.lessonsDone || []),
  ]);
  mineGame.seeds = uniq([...(mineGame.seeds || []), ...(theirGame.seeds || [])]);
  mineGame.dailyGoal = mineGame.dailyGoal !== 60 ? mineGame.dailyGoal : theirGame.dailyGoal || 60;

  const log = { ...(theirGame.log || {}) };
  for (const [day, xp] of Object.entries(mineGame.log || {})) {
    log[day] = Math.max(log[day] || 0, xp);
  }
  mineGame.log = log;

  const reviews = { ...(theirGame.reviews || {}) };
  for (const [id, card] of Object.entries(mineGame.reviews || {})) {
    const theirs = reviews[id];
    reviews[id] =
      !theirs || (card.reps || 0) >= (theirs.reps || 0) ? card : theirs;
  }
  mineGame.reviews = reviews;

  // today's quests and session: keep whichever has made more progress today
  const progressOf = (quests) =>
    (quests && quests.items ? quests.items : []).reduce((sum, q) => sum + (q.progress || 0), 0);
  if (
    theirGame.quests &&
    (!mineGame.quests ||
      (theirGame.quests.day === mineGame.quests.day &&
        progressOf(theirGame.quests) > progressOf(mineGame.quests)))
  ) {
    mineGame.quests = theirGame.quests;
  }
  if (
    theirGame.session &&
    (!mineGame.session ||
      (theirGame.session.day === mineGame.session.day &&
        (theirGame.session.xp || 0) > (mineGame.session.xp || 0)))
  ) {
    mineGame.session = theirGame.session;
  }

  return merged;
}

/** Merge an incoming state into the current one and persist. */
export function mergeIn(incoming) {
  state = mergeStates(state, incoming);
  persist();
  return state;
}

/* ------------------------------------------------------- import/export */

export function exportProgress() {
  return JSON.stringify(state, null, 2);
}

/**
 * Restore a backup. The payload may be a bare state or the wrapper the
 * backup file uses. Merging (the default) can only add progress; pass
 * `{ merge: false }` to replace outright.
 */
export function importProgress(json, { merge = true } = {}) {
  const parsed = typeof json === "string" ? JSON.parse(json) : json;
  if (!parsed || typeof parsed !== "object") throw new Error("Not a progress file");
  const incoming = parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;
  if (!incoming.solved && !incoming.game && !incoming.visited) {
    throw new Error("That does not look like a SQL Quest backup");
  }
  state = merge
    ? mergeStates(state, incoming)
    : { ...clone(EMPTY), ...incoming, game: { ...clone(EMPTY.game), ...(incoming.game || {}) } };
  persist();
  return state;
}

/** The backup payload: the state plus a little provenance. */
export function backupPayload() {
  return {
    app: "sql-quest",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
}

export function resetProgress() {
  // one-off seeds already granted stay consumed, or a reset would undo itself
  const seeds = [...(state.game.seeds || [])];
  state = clone(EMPTY);
  state.game.seeds = seeds;
  persist();
}
