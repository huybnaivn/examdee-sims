import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, initialState, load, solve, status, answer, next, apply, imbalance, minSteps, eqOf, eqText, clampState } from "./model.js";

const fresh = p => load(initialState(), p);

test("text uses textbook notation", () => {
  assert.equal(eqText([3, 2, 1, 8]), "3x + 2 = x + 8");
  assert.equal(eqText([-1, -4, 0, -6]), "−x − 4 = −6");
  assert.equal(eqText([0, 0, 2, 0]), "0 = 2x");
});

test("every both-sides operation keeps the equation equivalent and the scale level", () => {
  PRESETS.forEach((p, i) => {
    const r0 = solve(p);
    for (const [op, item, n] of [["add", "x", 2], ["remove", "1", 3], ["remove", "x", 1], ["add", "1", 4]]) {
      const s = fresh(i);
      const before = imbalance(s);
      if (!apply(s, op, item, n).ok) continue;
      const r1 = solve(eqOf(s));
      assert.equal(r1.kind, r0.kind);
      if (r0.kind === "one") assert.equal(r1.x, r0.x);
      assert.equal(imbalance(s), before);
      if (r0.kind !== "none") assert.equal(imbalance(s), 0);
    }
  });
  const s = load(initialState(), 0);
  apply(s, "remove", "x", 1); // 2x + 2 = 8
  apply(s, "remove", "1", 2); // 2x = 6
  assert.ok(apply(s, "divide", "x", 2).ok); // x = 3
  assert.deepEqual(eqOf(s), [1, 0, 0, 3]);
  assert.ok(!apply(fresh(0), "divide", "x", 2).ok, "3x + 2 = x + 8 cannot be split into 2 equal groups");
});

test("the final x matches the algebraic solution (d − b)/(a − c) for every unique-solution preset", () => {
  PRESETS.forEach((p, i) => {
    const r = solve(p);
    if (r.kind !== "one") return;
    assert.equal(r.x, (p[3] - p[1]) / (p[0] - p[2]));
    // Textbook route: gather x on the pan with the larger coefficient, units on the other, then divide.
    const s = fresh(i);
    const left = p[0] > p[2];
    const small = Math.min(p[0], p[2]);
    if (small) apply(s, small > 0 ? "remove" : "add", "x", Math.abs(small));
    const u = left ? s.lb : s.rb;
    if (u) apply(s, u > 0 ? "remove" : "add", "1", Math.abs(u));
    const k = left ? s.la : s.ra;
    if (k !== 1) apply(s, "divide", "x", k);
    assert.equal(status(eqOf(s)), "solved", eqText(eqOf(s)));
    assert.equal(answer(eqOf(s)), r.x);
    assert.equal(imbalance(s), 0);
  });
});

test("a one-sided move tips the scale and is rejected", () => {
  const s = fresh(0);
  const before = { ...s };
  const r = apply(s, "remove", "1", 2, "left");
  assert.equal(r.ok, false);
  assert.equal(r.tip, -1, "left pan got lighter, so the right side goes down");
  assert.equal(apply(s, "add", "x", 1, "left").tip, 1);
  assert.equal(apply(s, "add", "x", 1, "right").tip, -1);
  assert.deepEqual(s, before);
});

test("no-solution and infinitely-many cases are detected", () => {
  assert.equal(solve([2, 3, 2, 5]).kind, "none");
  assert.equal(solve([3, 6, 3, 6]).kind, "infinite");
  const none = fresh(6);
  assert.notEqual(imbalance(none), 0, "no x balances 2x + 3 and 2x + 5");
  apply(none, "remove", "x", 2);
  assert.equal(status(eqOf(none)), "none");
  const inf = fresh(7);
  apply(inf, "remove", "x", 3);
  assert.equal(status(eqOf(inf)), "infinite");
  assert.equal(apply(inf, "add", "1", 1).ok, false, "nothing to do once decided");
});

test("minimum number of steps", () => {
  assert.equal(minSteps([3, 2, 1, 8]), 3);
  assert.equal(minSteps([2, 5, 0, 11]), 2);
  assert.equal(minSteps([1, 4, 3, -6]), 3);
  assert.equal(minSteps([2, 3, 2, 5]), 1);
  assert.equal(minSteps([1, 0, 0, 3]), 0);
});

test("divide and overflow guards, forged state clamped", () => {
  assert.ok(next([4, 0, 0, 8], "divide", "x", 1).error);
  assert.ok(next([12, 0, 0, 8], "add", "x", 1).error);
  const s = clampState({ ...initialState(), la: 1e9, lb: -3.7, preset: 99, steps: -4 });
  assert.deepEqual([s.la, s.lb, s.preset, s.steps], [12, -4, 0, 0]);
});
