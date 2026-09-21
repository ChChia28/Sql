#!/usr/bin/env node
/* =====================================================================
   SQL Quest — progress store tests

   Guards the merge boundary. The account store delivers FROZEN snapshots,
   so anything merged straight in becomes an object the app can never
   mutate again — which showed up as "Cannot assign to read only property
   'attempts'" the first time a learner pressed Run. These tests fail if
   that regresses.

       node tools/test-store.mjs
   ===================================================================== */

import assert from "node:assert/strict";
import { mergeStates, importProgress, getState, resetProgress } from "../src/store.js";

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${error.message}`);
  }
}

const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const today = new Date().toISOString().slice(0, 10);

/** A remote state shaped like one the account store would deliver. */
function remoteState() {
  return deepFreeze({
    solved: { "m1-tables-e1": { at: 1, attempts: 2, hints: 0, peeked: false } },
    visited: { "m1-tables": 1 },
    quiz: { "m1-tables-0": 1 },
    snippets: [{ name: "saved", sql: "SELECT 1;", at: 1 }],
    settings: { theme: null },
    stats: { queriesRun: 3, firstSeen: "2026-09-19", days: ["2026-09-19"] },
    game: {
      xp: 120,
      freezes: 2,
      frozen: [],
      seeds: ["seed-a"],
      quests: {
        day: today,
        items: [{ id: "solve3", event: "exercise", target: 3, label: "Solve 3", progress: 1, done: false }],
        perfectClaimed: false,
      },
      session: { day: today, xp: 20, solved: 1, combo: 1, bestCombo: 1 },
      reviews: { "m1-tables-e1": { due: "2020-01-01", interval: 1, ease: 2.4, reps: 1, lapses: 0 } },
      cards: ["count-one"],
      log: { [today]: 20 },
      dailyGoal: 60,
      lessonsDone: ["m1-tables"],
    },
  });
}

console.log("\nstore merge");

test("nothing merged in is frozen — every mutation site stays writable", () => {
  const merged = mergeStates(getState(), remoteState());
  // exactly the writes the app performs after hydrating
  merged.solved["m1-tables-e1"].attempts += 1;
  merged.game.session.xp += 10;
  merged.game.quests.items[0].progress += 1;
  merged.game.reviews["m1-tables-e1"].reps += 1;
  merged.snippets[0].at = Date.now();
  merged.stats.days.push("2026-09-22");
  assert.equal(merged.solved["m1-tables-e1"].attempts, 3);
  assert.equal(merged.game.session.xp, 30);
});

test("the caller's own state is never mutated", () => {
  const base = getState();
  const before = JSON.stringify(base);
  mergeStates(base, remoteState());
  assert.equal(JSON.stringify(base), before);
});

test("merging keeps work from both sides", () => {
  const local = mergeStates(getState(), {
    solved: { "m2-where-e1": { at: 5, attempts: 1, hints: 0, peeked: false } },
    game: { xp: 40, cards: ["null-sort"], lessonsDone: ["m2-where"] },
  });
  const merged = mergeStates(local, remoteState());
  assert.ok(merged.solved["m1-tables-e1"], "remote solve survived");
  assert.ok(merged.solved["m2-where-e1"], "local solve survived");
  assert.equal(merged.game.xp, 120, "xp takes the higher side");
  assert.deepEqual(merged.game.cards.sort(), ["count-one", "null-sort"]);
  assert.deepEqual(merged.game.lessonsDone.sort(), ["m1-tables", "m2-where"]);
  assert.deepEqual(merged.game.seeds, ["seed-a"], "consumed seeds carry over");
});

test("a solved exercise keeps its first-solved time and worst-case aid flags", () => {
  const early = mergeStates(getState(), {
    solved: { x: { at: 10, attempts: 1, hints: 2, peeked: false } },
  });
  const merged = mergeStates(early, {
    solved: { x: { at: 99, attempts: 4, hints: 0, peeked: true } },
  });
  assert.equal(merged.solved.x.at, 10);
  assert.equal(merged.solved.x.attempts, 4);
  assert.equal(merged.solved.x.hints, 2);
  assert.equal(merged.solved.x.peeked, true);
});

console.log("\nbackup restore");

test("a backup wrapper restores and merges", () => {
  resetProgress();
  const payload = JSON.stringify({ app: "sql-quest", version: 1, state: remoteState() });
  importProgress(payload);
  assert.ok(getState().solved["m1-tables-e1"], "restored the solve");
  assert.equal(getState().game.xp, 120);
  getState().solved["m1-tables-e1"].attempts += 1;   // must not throw
});

test("restoring twice cannot remove progress", () => {
  const before = Object.keys(getState().solved).length;
  importProgress(JSON.stringify({ state: remoteState() }));
  assert.ok(Object.keys(getState().solved).length >= before);
});

test("junk is rejected rather than wiping progress", () => {
  assert.throws(() => importProgress('{"hello":"world"}'), /backup/i);
  assert.throws(() => importProgress("not json"), /./);
  assert.ok(getState().solved["m1-tables-e1"], "progress intact after bad restores");
});

test("reset clears progress but keeps consumed seeds", () => {
  resetProgress();
  assert.equal(Object.keys(getState().solved).length, 0);
  assert.deepEqual(getState().game.seeds, ["seed-a"]);
});

console.log(failures ? `\n${failures} test(s) failed\n` : "\nAll store tests passed.\n");
process.exit(failures ? 1 : 0);
