import test from "node:test";
import assert from "node:assert/strict";
import { initialState, EXPERIMENTS, EVENTS, EVENT_KEY, theory, run, clear, hits, totalTrials, random, fixMix, sanitize, MAX_TRIALS } from "./model.js";

const near = (x, y, eps = 1e-12) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const fresh = (experiment, eventId, extra = {}) => {
  const s = { ...initialState(), experiment, ...extra };
  if (eventId) s[EVENT_KEY[experiment]] = eventId;
  clear(s);
  return s;
};
const P = (exp, id, extra) => theory(fresh(exp, id, extra));

test("theoretical probabilities by counting outcomes", () => {
  assert.deepEqual(P("coin", "heads"), { favourable: 1, total: 2, p: 0.5 });
  assert.deepEqual(P("die", "even"), { favourable: 3, total: 6, p: 0.5 });
  assert.deepEqual(P("die", "prime"), { favourable: 3, total: 6, p: 0.5 });
  assert.deepEqual(P("die", "div3"), { favourable: 2, total: 6, p: 2 / 6 });
  assert.deepEqual(P("die", "six"), { favourable: 1, total: 6, p: 1 / 6 });
  assert.deepEqual(P("dice", "sum7"), { favourable: 6, total: 36, p: 6 / 36 });
  assert.deepEqual(P("dice", "sum2"), { favourable: 1, total: 36, p: 1 / 36 });
  assert.deepEqual(P("dice", "ge10"), { favourable: 6, total: 36, p: 6 / 36 });
  assert.deepEqual(P("dice", "even"), { favourable: 18, total: 36, p: 0.5 });
  assert.deepEqual(P("cards", "red", { red: 3, blue: 2, yellow: 1 }), { favourable: 3, total: 6, p: 0.5 });
  assert.deepEqual(P("cards", "yellow", { red: 3, blue: 2, yellow: 5 }), { favourable: 5, total: 10, p: 0.5 });
  assert.deepEqual(P("cards", "blue", { red: 0, blue: 0, yellow: 4 }), { favourable: 0, total: 4, p: 0 });
});

test("sum of two dice: n(sum = k) = 6 − |k − 7| over 36 outcomes", () => {
  const space = EXPERIMENTS.dice.space();
  assert.equal(space.length, 36);
  for (let k = 2; k <= 12; k++) assert.equal(space.filter(b => b + 2 === k).length, 6 - Math.abs(k - 7));
  // listing pairs (i, j) directly gives the same thing
  const direct = Array(13).fill(0);
  for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) direct[i + j]++;
  for (let k = 2; k <= 12; k++) assert.equal(space.filter(b => b + 2 === k).length, direct[k]);
});

test("complement rule: P(Ā) = 1 − P(A)", () => {
  near(P("dice", "not7").p, 1 - P("dice", "sum7").p);
  near(P("cards", "notRed").p, 1 - P("cards", "red").p);
  near(P("coin", "tails").p, 1 - P("coin", "heads").p);
  // for every event: counting the outcomes not in A gives 1 − P(A)
  for (const exp of Object.keys(EVENTS))
    for (const e of EVENTS[exp]) {
      const s = fresh(exp, e.id);
      const space = EXPERIMENTS[exp].space(s);
      near(space.filter(k => !e.test(k)).length / space.length, 1 - theory(s).p);
    }
});

test("impossible and certain events give 0 and 1, in theory and in every sample", () => {
  assert.equal(P("die", "gt6").p, 0);
  assert.equal(P("dice", "sum13").p, 0);
  assert.equal(P("die", "le6").p, 1);
  for (const [exp, id, want] of [["die", "gt6", 0], ["dice", "sum13", 0], ["die", "le6", 1]]) {
    const s = fresh(exp, id);
    run(s, 500);
    assert.equal(hits(s) / totalTrials(s), want);
  }
});

test("the seeded generator is deterministic", () => {
  const a = { seed: 42 };
  const b = { seed: 42 };
  const xs = Array.from({ length: 50 }, () => random(a));
  assert.deepEqual(Array.from({ length: 50 }, () => random(b)), xs);
  assert.ok(xs.every(x => x >= 0 && x < 1));
  // same state, same trials
  const s1 = fresh("dice", "sum7");
  const s2 = structuredClone(s1);
  run(s1, 300);
  run(s2, 300);
  assert.deepEqual(s1.counts, s2.counts);
  assert.deepEqual(s1.history, s2.history);
  // the initial sample is the same every time
  assert.deepEqual(initialState(), initialState());
});

test("large samples are within statistical tolerance of the theory", () => {
  const n = 20000;
  for (const [exp, id, extra] of [["coin", "heads"], ["die", "six"], ["dice", "sum7"], ["dice", "ge10"], ["cards", "red", { red: 3, blue: 2, yellow: 1 }]]) {
    const s = fresh(exp, id, extra);
    run(s, n);
    const { p } = theory(s);
    const f = hits(s) / n;
    const sd = Math.sqrt((p * (1 - p)) / n);
    assert.ok(Math.abs(f - p) < 4 * sd, `${exp}/${id}: f = ${f}, p = ${p}`);
  }
  // every sum of two dice as well
  const s = fresh("dice", "sum7");
  run(s, n);
  s.counts.forEach((c, b) => {
    const p = (6 - Math.abs(b + 2 - 7)) / 36;
    assert.ok(Math.abs(c / n - p) < 4 * Math.sqrt((p * (1 - p)) / n), `sum ${b + 2}`);
  });
});

test("history ends at the current frequency; trials stop at MAX_TRIALS", () => {
  const s = fresh("die", "even");
  for (const k of [1, 10, 100, 1000]) run(s, k);
  assert.equal(totalTrials(s), 1111);
  assert.deepEqual(s.history.at(-1), [1111, hits(s)]);
  assert.ok(s.history.length < 120);
  s.history.forEach((p, i) => i && assert.ok(p[0] > s.history[i - 1][0]));
  s.counts[0] = MAX_TRIALS - totalTrials(s) + s.counts[0] - 5;
  assert.equal(run(s, 1000), 5);
  assert.equal(totalTrials(s), MAX_TRIALS);
  assert.equal(run(s, 10), 0);
});

test("a box always keeps at least one card", () => {
  const s = fresh("cards", "red", { red: 0, blue: 0, yellow: 0 });
  fixMix(s, "blue");
  assert.equal(s.blue, 1);
  assert.equal(theory(s).total, 1);
});

test("sanitize keeps a valid saved state and rejects forged ones", () => {
  const s = initialState();
  run(s, 50);
  const saved = JSON.parse(JSON.stringify(s));
  assert.deepEqual(sanitize(saved, initialState()), saved);
  const bad = sanitize({ ...saved, counts: [1, -2, 3], red: 99, experiment: "x", history: "no" }, initialState());
  assert.equal(totalTrials(bad), 0);
  assert.deepEqual(bad.history, []);
  assert.equal(bad.red, 3);
  const zero = sanitize({ ...saved, red: 0, blue: 0, yellow: 0 }, initialState());
  assert.equal(zero.red + zero.blue + zero.yellow, 1);
  const forgedHistory = sanitize({ ...saved, history: [[5, 9]] }, initialState());
  assert.deepEqual(forgedHistory.history, [[totalTrials(saved), hits(saved)]]);
});
