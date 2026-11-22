import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, spring, stiffness, seriesK, parallelK, weightOf, massOf, guessIsRight, maxExtension, X_LIMIT, MAX_COUNT } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const fresh = over => ({ ...initialState(), count: 0, maxLoad: 0, ...over });

test("weight convention P = 10·m: one 50 g weight weighs 0.5 N", () => {
  near(massOf(1), 0.05);
  near(weightOf(1), 0.5);
  near(weightOf(4), 10 * 0.2);
});

test("Hooke's law F = k·Δl in the elastic range, extension proportional to load", () => {
  for (const k of [20, 25, 50, 80]) {
    for (let n = 0; n <= MAX_COUNT; n++) {
      const r = solve(fresh({ k1: k, count: n }));
      if (r.load > k * X_LIMIT) continue;
      near(r.load, k * r.extension);
      assert.ok(r.elastic);
    }
  }
  const one = solve(fresh({ count: 1 })).extension;
  near(solve(fresh({ count: 3 })).extension, 3 * one);
  near(solve(initialState()).extension, 0.08); // 2 N on 25 N/m
});

test("slope of the F–Δl graph equals k", () => {
  for (const setup of ["single", "series", "parallel", "unknown"]) {
    const s = fresh({ setup });
    const a = solve(s, 1);
    const b = solve(s, 3);
    near((b.load - a.load) / (b.extension - a.extension), stiffness(s), 1e-9);
  }
});

test("series: 1/k = 1/k1 + 1/k2, same force in both, extensions add", () => {
  const s = fresh({ setup: "series", k1: 25, k2: 50, count: 2 });
  near(1 / stiffness(s), 1 / 25 + 1 / 50);
  near(seriesK(30, 60), 20);
  const r = solve(s);
  near(r.parts[0].force, r.load);
  near(r.parts[1].force, r.load);
  near(r.extension, r.parts[0].extension + r.parts[1].extension);
  near(r.load, stiffness(s) * r.extension);
  assert.ok(stiffness(s) < Math.min(s.k1, s.k2));
});

test("parallel: k = k1 + k2, same extension, forces add up to the load", () => {
  const s = fresh({ setup: "parallel", k1: 25, k2: 50, count: 6 });
  near(stiffness(s), 75);
  near(parallelK(20, 30), 50);
  const r = solve(s);
  near(r.parts[0].extension, r.parts[1].extension);
  near(r.parts[0].force + r.parts[1].force, r.load);
  near(r.parts[0].force, 25 * r.extension);
  near(r.load, 75 * r.extension);
});

test("parallel springs stay equally long also beyond the limit", () => {
  const s = fresh({ setup: "parallel", k1: 20, k2: 20, count: 10, maxLoad: 5 });
  for (const n of [10, 5, 0]) {
    const r = solve(s, n);
    near(r.parts[0].extension, r.parts[1].extension);
    near(r.parts[0].force + r.parts[1].force, r.load);
  }
});

test("beyond the elastic limit the extension grows faster than Hooke's law", () => {
  const s = fresh({ k1: 20, count: 10 }); // 5 N > 20 × 0.16 = 3.2 N
  const r = solve(s);
  assert.ok(!r.elastic);
  assert.ok(r.extension > r.load / 20);
  near(r.extension, 0.16 + (5 - 3.2) / 10);
});

test("an overstretched spring does not return to its natural length", () => {
  const s = fresh({ k1: 20, count: 10 });
  s.maxLoad = solve(s).load; // what the sim records
  const unloaded = solve(s, 0);
  assert.ok(unloaded.permanent > 0);
  near(unloaded.extension, unloaded.permanent);
  near(unloaded.extension, 0.34 - 5 / 20);
  // it comes back along slope k, and reloading to the old maximum gives the old length
  near(solve(s, 4).extension - unloaded.extension, 2 / 20);
  near(solve(s, 10).extension, 0.34);
  // a spring kept inside the limit does return
  const ok = fresh({ k1: 25, count: 6, maxLoad: 3 });
  near(solve(ok, 0).extension, 0);
});

test("spring() is continuous at the limit and never shortens under more load", () => {
  let prev = -1;
  for (let F = 0; F <= 6; F += 0.05) {
    const x = spring(25, F).extension;
    assert.ok(x > prev);
    prev = x;
  }
  near(spring(25, 4).extension, X_LIMIT);
});

test("unknown spring: answer accepted only within 5 %", () => {
  const s = fresh({ setup: "unknown", kx: 40 });
  assert.ok(guessIsRight({ ...s, guess: 40 }));
  assert.ok(guessIsRight({ ...s, guess: 42 }));
  assert.ok(!guessIsRight({ ...s, guess: 43 }));
  assert.ok(!guessIsRight({ ...s, guess: 37 }));
  // measuring F/Δl in the elastic range recovers kx
  const r = solve(s, 4);
  near(r.load / r.extension, 40);
});

test("forged state cannot break the model", () => {
  const r = solve({ ...initialState(), maxLoad: -1e9, kx: 1e9, setup: "unknown", count: 99 });
  assert.ok(Number.isFinite(r.extension) && r.extension >= 0);
  assert.equal(r.k, 80);
  near(r.load, 5);
  const big = solve({ ...initialState(), maxLoad: 1e9, count: 0 });
  assert.ok(big.extension <= maxExtension(initialState()));
});
