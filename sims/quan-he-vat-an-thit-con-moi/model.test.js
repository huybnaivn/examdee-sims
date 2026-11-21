import test from "node:test";
import assert from "node:assert/strict";
import { E, EXTINCT, initialState, step, restart, equilibrium, invariant, hunt, winter, WINTER_LOSS } from "./model.js";

const DT = 1 / 40; // what one frame step is at the sim's playback speed (years)
const make = over => restart({ ...initialState(), ...over });
const run = (s, years, dt = DT, each) => {
  for (let i = 0; i < Math.round(years / dt); i++) {
    const r = step(s, dt);
    each?.(s, r);
  }
  return s;
};

test("without foxes, rabbits grow logistically up to the carrying capacity", () => {
  for (const [a, K, R0] of [[1, 1000, 50], [0.4, 600, 10], [2, 3000, 900], [1, 200, 1000]]) {
    const s = make({ birth: a, K, rabbits0: R0, foxes0: 0 });
    for (let t = 1; t <= 30; t++) {
      run(s, 1);
      const exact = K / (1 + (K / R0 - 1) * Math.exp(-a * t));
      assert.ok(Math.abs(s.rabbits - exact) / exact < 1e-6, `a=${a} K=${K} t=${t}: ${s.rabbits} vs ${exact}`);
    }
    run(s, 40);
    assert.ok(Math.abs(s.rabbits - K) < 1e-3 * K);
    assert.equal(s.foxes, 0);
  }
});

test("without rabbits, foxes decline exponentially", () => {
  for (const d of [0.1, 0.6, 1.5]) {
    const s = make({ death: d, rabbits0: 0, foxes0: 100 });
    for (let t = 0.5; t <= 3; t += 0.5) {
      run(s, 0.5);
      const exact = 100 * Math.exp(-d * t);
      assert.ok(Math.abs(s.foxes - exact) / exact < 1e-7, `d=${d} t=${t}`);
    }
    assert.equal(s.rabbits, 0);
  }
  // below one animal the foxes have died out
  const s = run(make({ death: 1.5, rabbits0: 0, foxes0: 100 }), 4);
  assert.equal(s.foxes, 0);
  assert.ok(100 * Math.exp(-1.5 * 4) < EXTINCT);
});

test("the coexistence equilibrium matches R* = d/(e·b), F* = (a/b)(1 − R*/K)", () => {
  const base = initialState();
  const eq = equilibrium(base);
  assert.ok(Math.abs(eq.rabbits - 300) < 1e-9 && Math.abs(eq.foxes - 35) < 1e-9);
  for (const over of [{}, { birth: 1.6, predation: 0.01, death: 0.3, K: 2500 }, { capacity: false }]) {
    const s0 = { ...base, ...over };
    const e = equilibrium(s0);
    const { birth: a, predation: b, death: d } = s0;
    assert.ok(Math.abs(e.rabbits - d / (E * b)) < 1e-9);
    const K = s0.capacity ? s0.K : Infinity;
    assert.ok(Math.abs(e.foxes - (a / b) * (1 - e.rabbits / K)) < 1e-9);
    // standing at the equilibrium, nothing changes
    const s = run(make({ ...over, rabbits0: e.rabbits, foxes0: e.foxes }), 50);
    assert.ok(Math.abs(s.rabbits - e.rabbits) < 1e-6 && Math.abs(s.foxes - e.foxes) < 1e-6);
  }
  // with a capacity the cycles damp out towards the equilibrium
  const s = run(make({}), 300);
  assert.ok(Math.abs(s.rabbits - 300) < 0.5 && Math.abs(s.foxes - 35) < 0.5, `${s.rabbits}, ${s.foxes}`);
  // foxes cannot persist when R* is above the capacity
  assert.equal(equilibrium({ ...base, death: 1.5, predation: 0.005, K: 1000 }), null);
  const gone = run(make({ death: 1.5, predation: 0.005, K: 1000 }), 60);
  assert.equal(gone.foxes, 0);
  assert.ok(Math.abs(gone.rabbits - 1000) < 1);
});

test("the classic model (no capacity) conserves V = e·b·R − d·ln R + b·F − a·ln F", () => {
  for (const over of [{}, { birth: 1.5, predation: 0.01, death: 0.4, rabbits0: 200, foxes0: 60 }]) {
    const s = make({ capacity: false, ...over });
    const v0 = invariant(s);
    let min = Infinity;
    run(s, 100, DT, x => (min = Math.min(min, x.foxes, x.rabbits)));
    assert.ok(min > EXTINCT); // the orbit never touches the extinction floor
    assert.ok(Math.abs(invariant(s) - v0) < 1e-6 * Math.abs(v0), `${invariant(s)} vs ${v0}`);
  }
});

test("numbers stay finite and never negative over the whole control range", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = (lo, hi) => lo + rnd() * (hi - lo);
  const cases = [];
  for (const birth of [0.2, 2]) for (const predation of [0.005, 0.05]) for (const death of [0.1, 1.5]) for (const capacity of [true, false])
    cases.push({ birth, predation, death, capacity, K: 200, rabbits0: 1000, foxes0: 100 });
  for (let i = 0; i < 40; i++)
    cases.push({ birth: pick(0.2, 2), predation: pick(0.005, 0.05), death: pick(0.1, 1.5), capacity: rnd() < 0.5, K: pick(200, 3000), rabbits0: pick(0, 1000), foxes0: pick(0, 100) });
  for (const c of cases) {
    const s = make(c);
    run(s, 80, DT, x => {
      assert.ok(Number.isFinite(x.rabbits) && Number.isFinite(x.foxes), JSON.stringify(c));
      assert.ok(x.rabbits >= 0 && x.foxes >= 0, JSON.stringify(c));
    });
    // the same run with ten times smaller frames ends in the same place (the integrator is converged)
    if (c.capacity) {
      const fine = run(make(c), 20, DT / 10);
      const coarse = run(make(c), 20);
      assert.ok(Math.abs(fine.rabbits - coarse.rabbits) <= 1e-3 * Math.max(1, fine.rabbits), JSON.stringify(c));
      assert.ok(Math.abs(fine.foxes - coarse.foxes) <= 1e-3 * Math.max(1, fine.foxes), JSON.stringify(c));
    }
  }
  // forged numbers are cleaned
  const forged = restart({ ...initialState(), rabbits0: -5, foxes0: NaN, birth: 1e9, death: -1, K: 0 });
  run(forged, 5);
  assert.deepEqual([forged.rabbits, forged.foxes], [0, 0]);
});

test("fox peaks are reported once per cycle, when the fox number turns down", () => {
  const s = make({ capacity: false });
  const peaks = [];
  let top = 0;
  run(s, 60, DT, (x, r) => {
    if (r.peak) peaks.push({ t: x.time, F: x.foxes });
    top = Math.max(top, x.foxes);
  });
  // classic cycle period ≈ 2π/√(a·d) near the equilibrium; larger orbits are slower
  assert.ok(peaks.length >= 5 && peaks.length <= 8, `${peaks.length}`);
  for (const p of peaks) assert.ok(p.F > 0.999 * top); // reported within a frame of the maximum
  for (let i = 1; i < peaks.length; i++) {
    assert.ok(Math.abs(peaks[i].F - peaks[0].F) < 0.01 * peaks[0].F); // the same orbit every time
  }
  // resting at the equilibrium gives no peaks
  const e = equilibrium(initialState());
  let count = 0;
  run(make({ rabbits0: e.rabbits, foxes0: e.foxes }), 50, DT, (x, r) => (count += r.peak ? 1 : 0));
  assert.equal(count, 0);
});

test("one-off events: hunting halves the foxes, a harsh winter kills 60 % of the rabbits", () => {
  const s = make({});
  assert.deepEqual(hunt(s), { before: 20, after: 10 });
  assert.equal(s.foxes, 10);
  const w = winter(s);
  assert.equal(w.before, 400);
  assert.ok(Math.abs(w.after - 400 * (1 - WINTER_LOSS)) < 1e-9);
  s.foxes = 1.5;
  hunt(s);
  assert.equal(s.foxes, 0); // 0,75 of a fox is no fox
});
