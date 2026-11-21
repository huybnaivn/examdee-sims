import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, step, restart, halfLife, unit, rate, elapsed, finished, decayConstant, expected, activity,
  lifetimes, remaining, halfLivesPassed, ISOTOPES, WATCH, SPAN,
} from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("N(t) = N0·2^(−t/T) = N0·e^(−λt)", () => {
  close(expected(1000, 0, 8), 1000);
  close(expected(1000, 16, 8), 250);
  close(expected(1000, 4, 8), 1000 / Math.SQRT2);
  for (const t of [0.3, 5, 21]) close(expected(640, t, 5.27), 640 * Math.exp(-decayConstant(5.27) * t));
});

test("after one half-life the expected count is N0/2, after k it is N0/2^k", () => {
  for (const T of [0.5, 8.02, 5730]) {
    close(expected(400, T, T), 200);
    close(expected(400, 3 * T, T), 50);
  }
});

test("decay constant λ = ln2/T and activity H = λN", () => {
  close(decayConstant(8.02), 0.6931471805599453 / 8.02);
  close(decayConstant(1) * 1, Math.LN2);
  close(activity(1000, 2), 500 * Math.LN2);
  // H falls with the same half-life as N
  close(activity(expected(800, 5, 5), 5), activity(800, 5) / 2);
  assert.equal(activity(0, 3), 0);
});

test("the seeded run is deterministic and a saved state replays identically", () => {
  assert.deepEqual(lifetimes(7, 200), lifetimes(7, 200));
  assert.notDeepEqual(lifetimes(7, 200), lifetimes(8, 200));
  const a = restart(initialState());
  const counts = [];
  for (let i = 0; i < 1500; i++) counts.push(remaining(step(a, 1 / 120)));
  // reopen from the saved flat state part-way and at the end
  const saved = JSON.parse(JSON.stringify(a, (k, v) => (k.startsWith("_") ? undefined : v)));
  assert.equal(remaining(saved), counts.at(-1));
  const b = { ...initialState(), seed: a.seed, time: 0 };
  for (let i = 0; i < 1500; i++) assert.equal(remaining(step(b, 1 / 120)), counts[i]);
});

test("the count starts at N0, never increases and every nucleus eventually decays", () => {
  const s = { ...initialState(), n0: 300, time: 0 };
  assert.equal(remaining(s, 0), 300);
  let prev = 300;
  for (let k = 0; k <= 60; k++) {
    const n = remaining(s, (k / 10) * halfLife(s));
    assert.ok(n <= prev);
    prev = n;
  }
  assert.equal(remaining(s, 1e6 * halfLife(s)), 0);
});

test("a large sample stays within statistical tolerance of the curve", () => {
  for (const seed of [1, 2027, 99999]) {
    const s = { ...initialState(), n0: 10000, seed };
    const T = halfLife(s);
    for (const x of [0.5, 1, 2, 3, 4]) {
      const p = 2 ** -x;
      const sigma = Math.sqrt(s.n0 * p * (1 - p)); // binomial
      assert.ok(Math.abs(remaining(s, x * T) - expected(s.n0, x * T, T)) < 4 * sigma, `seed ${seed}, t = ${x}T`);
    }
  }
});

test("time scaling: one half-life of any real isotope takes WATCH seconds; custom runs in real seconds", () => {
  for (const isotope of Object.keys(ISOTOPES)) {
    const s = { ...initialState(), isotope, time: 0 };
    for (let i = 0; i < WATCH * 120; i++) step(s, 1 / 120);
    close(s.time, halfLife(s), 1e-9);
    assert.equal(halfLivesPassed(s), 1);
    assert.equal(halfLife(s), ISOTOPES[isotope].T);
  }
  const c = { ...initialState(), isotope: "custom", customT: 2.5, time: 0 };
  assert.equal(unit(c), "s");
  assert.equal(rate(c), 1);
  for (let i = 0; i < 300; i++) step(c, 1 / 120);
  close(c.time, 2.5, 1e-9);
});

test("the run stops after SPAN half-lives, then starts over with a new sample", () => {
  const s = { ...initialState(), isotope: "custom", customT: 1, time: 0 };
  for (let i = 0; i < 120 * 10; i++) if (!finished(s)) step(s, 1 / 120);
  assert.equal(s.time, SPAN);
  const seed = s.seed;
  step(s, 1 / 120);
  assert.notEqual(s.seed, seed);
  assert.ok(s.time < 0.01);
});

test("a forged state cannot break the model", () => {
  const s = { ...initialState(), time: -5, customT: -3, isotope: "nope", seed: -1.5 };
  assert.equal(elapsed(s), 0);
  assert.equal(halfLife(s), 1);
  assert.equal(remaining(s), s.n0);
  s.time = 1e12;
  assert.equal(elapsed(s), SPAN);
  assert.ok(remaining(s) >= 0);
});
