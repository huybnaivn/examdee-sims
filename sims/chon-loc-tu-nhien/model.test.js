import test from "node:test";
import assert from "node:assert/strict";
import { initialState, generation, frequencies, counts, total, repopulate } from "./model.js";

const run = (s, gens) => {
  for (let i = 0; i < gens; i++) generation(s);
  return s;
};
const state = extra => ({ ...initialState(), ...extra });

test("no selection: no systematic drift (mean over seeded runs stays at 1/3)", () => {
  const mean = [0, 0, 0];
  const runs = 200;
  for (let seed = 1; seed <= runs; seed++) {
    const s = run(state({ selection: 0, mutation: 0, rng: seed }), 30);
    frequencies(s).forEach((f, v) => (mean[v] += f / runs));
  }
  for (const m of mean) assert.ok(Math.abs(m - 1 / 3) < 0.05, `mean ${m}`);
});

test("with selection the colour matching the background rises", () => {
  for (const background of [0, 1, 2]) {
    const s = run(state({ background, selection: 1, mutation: 0.01 }), 40);
    assert.ok(frequencies(s)[background] > 0.85, `bg ${background}: ${frequencies(s)}`);
  }
});

test("frequencies sum to 1 and the population stays within [0, cap]", () => {
  const s = state({ cap: 120, mutation: 0.05 });
  for (let g = 0; g < 60; g++) {
    generation(s);
    const n = total(s);
    assert.ok(n >= 0 && n <= 120);
    assert.ok(Math.abs(frequencies(s).reduce((a, b) => a + b) - 1) < 1e-12);
    assert.ok([s.n0, s.n1, s.n2].every(Number.isInteger));
  }
  // a forged state is cut back to the cap
  assert.ok(counts(state({ n0: 1e9, n1: -5, n2: 3, cap: 100 })).reduce((a, b) => a + b) <= 100);
});

test("zero mutation: a lost variant stays lost, even when it would be favoured", () => {
  const s = state({ n0: 0, n1: 150, n2: 150, background: 0, selection: 1, mutation: 0 });
  for (let g = 0; g < 80; g++) {
    generation(s);
    assert.equal(s.n0, 0);
  }
  // with mutation it comes back and takes over
  const m = run(state({ n0: 0, n1: 150, n2: 150, background: 0, selection: 1, mutation: 0.02 }), 80);
  assert.ok(frequencies(m)[0] > 0.5);
});

test("same seed, same history; another seed, another history", () => {
  const a = run(state(), 25);
  const b = run(state(), 25);
  assert.deepEqual([a.n0, a.n1, a.n2, a.rng], [b.n0, b.n1, b.n2, b.rng]);
  const c = state();
  repopulate(c);
  run(c, 25);
  assert.notDeepEqual([a.n0, a.n1, a.n2], [c.n0, c.n1, c.n2]);
  // continuing from a saved mid-run state gives the same result as running straight through
  const half = JSON.parse(JSON.stringify(run(state(), 10)));
  run(half, 15);
  assert.deepEqual([half.n0, half.n1, half.n2], [a.n0, a.n1, a.n2]);
});

test("extinction is final", () => {
  const s = state({ n0: 0, n1: 0, n2: 0 });
  run(s, 3);
  assert.equal(total(s), 0);
  assert.deepEqual(frequencies(s), [0, 0, 0]);
});
