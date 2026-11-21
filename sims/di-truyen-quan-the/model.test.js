import test from "node:test";
import assert from "node:assert/strict";
import { initialState, history, current, next, settings, hardyWeinberg, alleleA, fixation, reseed, startOf, GEN_MAX } from "./model.js";

const at = extra => ({ ...initialState(), drift: false, generation: 0, ...extra });
const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const sum = f => f[0] + f[1] + f[2];

test("p² + 2pq + q² = 1, and every generation sums to 1", () => {
  for (const p of [0, 0.1, 0.37, 0.5, 0.9, 1]) {
    close(sum(hardyWeinberg(p)), 1);
    close(alleleA(hardyWeinberg(p)), p);
  }
  const busy = at({ selection: true, sel: 0.7, migration: true, m: 0.1, pm: 0.8, drift: true, N: 50, generation: 100 });
  for (const f of history(busy)) close(sum(f), 1, 1e-9);
});

test("no evolutionary forces: frequencies stay at Hardy–Weinberg equilibrium", () => {
  const s = at({ start: "hw", p0: 0.3, generation: GEN_MAX });
  for (const f of history(s)) {
    close(alleleA(f), 0.3, 1e-12);
    hardyWeinberg(0.3).forEach((x, i) => close(f[i], x, 1e-12));
  }
  // a large population drifts only a little: within 0,06 of p₀ after 20 generations, for every seed tried
  for (let seed = 1; seed <= 10; seed++) {
    const big = at({ start: "hw", p0: 0.3, drift: true, N: 10000, seed, generation: 20 });
    for (const f of history(big)) assert.ok(Math.abs(alleleA(f) - 0.3) < 0.06);
    const [D, H, R] = current(big);
    const p = alleleA(current(big));
    hardyWeinberg(p).forEach((x, i) => assert.ok(Math.abs([D, H, R][i] - x) < 0.02));
  }
});

test("one generation of random mating reaches Hardy–Weinberg proportions from any start", () => {
  for (const start of [[0.6, 0, 0.4], [0, 1, 0], [0.5, 0.1, 0.4], [0.2, 0.2, 0.6]]) {
    const p = alleleA(start);
    const f = next(start, settings(at({})));
    hardyWeinberg(p).forEach((x, i) => close(f[i], x));
    close(alleleA(f), p); // mating alone does not change p
  }
  const s = at({ start: "homo", p0: 0.6, generation: 1 });
  assert.deepEqual(history(s)[0], [0.6, 0, 0.4]);
  [0.36, 0.48, 0.16].forEach((x, i) => close(current(s)[i], x));
});

test("self-fertilisation halves the heterozygotes each generation, p unchanged", () => {
  const s = at({ start: "hw", p0: 0.5, randomMating: false, generation: 5 });
  history(s).forEach((f, n) => {
    close(f[1], 0.5 / 2 ** n);
    close(alleleA(f), 0.5);
  });
});

test("selection against aa follows q' = q(1 − sq)/(1 − sq²)", () => {
  for (const sel of [0.2, 0.5, 1]) {
    const s = at({ start: "hw", p0: 0.4, selection: true, sel, generation: 30 });
    const h = history(s);
    let q = 0.6;
    for (let n = 1; n < h.length; n++) {
      q = (q * (1 - sel * q)) / (1 - sel * q * q);
      close(1 - alleleA(h[n]), q, 1e-12);
      assert.ok(1 - alleleA(h[n]) < 1 - alleleA(h[n - 1]));
    }
  }
  // complete selection (s = 1): q_n = q₀/(1 + n·q₀)
  const h = history(at({ start: "hw", p0: 0.4, selection: true, sel: 1, generation: 50 }));
  h.forEach((f, n) => close(1 - alleleA(f), 0.6 / (1 + n * 0.6), 1e-12));
});

test("gene flow: p' = (1 − m)·p + m·p_m", () => {
  const h = history(at({ start: "hw", p0: 0.2, migration: true, m: 0.1, pm: 0.9, generation: 40 }));
  let p = 0.2;
  for (let n = 1; n < h.length; n++) {
    p = 0.9 * p + 0.1 * 0.9;
    close(alleleA(h[n]), p, 1e-12);
  }
});

test("drift is stronger in small populations; the run is deterministic", () => {
  const spread = N => {
    const ps = Array.from({ length: 60 }, (_, seed) => alleleA(current(at({ start: "hw", p0: 0.5, drift: true, N, seed: seed + 1, generation: 20 }))));
    const mean = ps.reduce((a, b) => a + b) / ps.length;
    return ps.reduce((a, b) => a + (b - mean) ** 2, 0) / ps.length;
  };
  const small = spread(20);
  const large = spread(1000);
  assert.ok(small > 10 * large, `${small} vs ${large}`);
  // theory: Var(p_t) ≈ p q (1 − (1 − 1/2N)^t)
  const theory = N => 0.25 * (1 - (1 - 1 / (2 * N)) ** 20);
  assert.ok(large > theory(1000) / 3 && large < theory(1000) * 3);

  const a = at({ drift: true, N: 50, seed: 7, generation: 80 });
  const first = history(a);
  history(at({ drift: true, N: 50, seed: 8, generation: 80 })); // another run in between
  assert.deepEqual(history({ ...a }), first);
  // a later generation only extends the earlier ones
  assert.deepEqual(history({ ...a, generation: 120 }).slice(0, 81), first);
  const b = { ...a };
  reseed(b);
  assert.equal(b.generation, 0);
  assert.notDeepEqual(history({ ...b, generation: 80 }), first);
});

test("fixation and loss in a small population; forged values are harmless", () => {
  const s = at({ drift: true, N: 10, p0: 0.5, generation: GEN_MAX });
  const end = fixation(current(s));
  assert.notEqual(end, 0); // with 10 individuals one allele is fixed within 200 generations
  assert.equal(alleleA(current(s)), end === 1 ? 1 : 0);
  assert.equal(fixation([1, 0, 0]), 1);
  assert.equal(fixation([0, 0, 1]), -1);
  assert.equal(fixation(hardyWeinberg(0.5)), 0);
  const forged = { ...s, N: -4, p0: 7, generation: 1e9, sel: NaN, seed: "x" };
  assert.equal(history(forged).length, GEN_MAX + 1);
  assert.ok(settings(forged).N >= 2);
  assert.deepEqual(startOf(settings(forged)), [1, 0, 0]);
});
