import test from "node:test";
import assert from "node:assert/strict";
import {
  U_MEV, M_N, NUCLIDES, REACTANTS, CURVE, PRESETS, G_MAX, CAP, GEN_TIME, initialState, nuclide, loadPreset, missing, balance,
  energy, binding, mostStable, classify, expected, gensOf, nextSeed, runChain, chainView, step,
} from "./model.js";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} ± ${tol}`);

test("the nuclide table is consistent", () => {
  assert.equal(U_MEV, 931.5);
  assert.equal(new Set(NUCLIDES.map(p => p.id)).size, NUCLIDES.length);
  for (const p of NUCLIDES) {
    assert.ok(Number.isInteger(p.A) && Number.isInteger(p.Z) && p.Z <= p.A);
    near(p.m, p.A, 0.1); // atomic mass in u is close to the mass number
  }
  assert.deepEqual([nuclide("U235").A, nuclide("U235").Z], [235, 92]);
  assert.deepEqual([nuclide("He4").A, nuclide("He4").Z], [4, 2]);
  assert.equal(nuclide("nope"), null);
});

test("every documented reaction conserves A and Z", () => {
  for (const [name, r] of Object.entries(PRESETS)) {
    const b = balance(r);
    assert.ok(b.ok, name);
    assert.equal(b.left.A, b.right.A);
    assert.equal(b.left.Z, b.right.Z);
  }
  assert.deepEqual(balance(PRESETS.fbk).left, { A: 236, Z: 92 });
  assert.deepEqual(balance(PRESETS.fbk).right, { A: 236, Z: 92 }); // 141 + 92 + 3·1, 56 + 36
});

test("a wrong product breaks conservation and gives no energy", () => {
  const wrongA = { ...PRESETS.dt, d: "H1" }; // D + T → He4 + p: A fits, Z does not
  assert.deepEqual([balance(wrongA).okA, balance(wrongA).okZ, balance(wrongA).ok], [true, false, false]);
  const wrongBoth = { ...PRESETS.dt, d: "H2" };
  assert.deepEqual([balance(wrongBoth).okA, balance(wrongBoth).okZ], [false, false]);
  assert.equal(energy(wrongA), null);
  const fewer = { ...PRESETS.fbk, extra: 2 }; // one neutron short
  assert.equal(balance(fewer).okA, false);
  assert.equal(balance(fewer).okZ, true);
  const open = { ...PRESETS.dt, d: "?" };
  assert.equal(balance(open).complete, false);
  assert.equal(balance(open).ok, false);
  assert.equal(energy(open), null);
});

test("the missing particle is deduced from conservation of A and Z", () => {
  for (const [name, r] of Object.entries(PRESETS)) {
    const s = loadPreset({ ...initialState(), preset: name });
    assert.equal(s.d, "?");
    const x = missing(s);
    assert.equal(x.id, r.d, name);
    assert.deepEqual([x.A, x.Z], [nuclide(r.d).A, nuclide(r.d).Z]);
  }
  assert.deepEqual(missing({ a: "He4", b: "N14", c: "O17", extra: 0 }), { A: 1, Z: 1, id: "H1" });
  assert.deepEqual(missing({ a: "n", b: "U235", c: "Ba141", extra: 3 }), { A: 92, Z: 36, id: "Kr92" });
  assert.equal(missing({ a: "n", b: "U235", c: "Ba141", extra: 0 }).id, null); // A = 95, Z = 36 is not in the table
  assert.equal(missing({ a: "n", b: "n", c: "U235", extra: 0 }).id, null); // negative A
  assert.equal(missing({ a: "zz", b: "n", c: "n" }).id, null);
  // only nuclides offered in the builder are proposed
  for (const r of Object.values(PRESETS)) assert.ok(REACTANTS.includes(nuclide(missing(r).id)));
});

test("energy W = Δm·c² with 931,5 MeV/u for the documented examples", () => {
  const W = name => energy(PRESETS[name]).W;
  near(W("dt"), 17.6, 0.05);
  near(W("dd"), 3.27, 0.02);
  near(W("pli"), 17.35, 0.05);
  near(W("an"), -1.19, 0.02); // absorbs energy
  near(W("abe"), 5.7, 0.02);
  near(W("aal"), -2.64, 0.03); // absorbs energy
  near(W("nli"), 4.78, 0.02);
  near(W("fbk"), 173.3, 0.5);
  near(W("fxs"), 184.7, 0.5);
  const e = energy(PRESETS.dt);
  near(e.before, 2.014102 + 3.016049, 1e-12);
  near(e.after, 4.002603 + M_N, 1e-12);
  near(e.W, e.dm * 931.5, 1e-12);
  near(e.dm, 0.018883, 1e-6);
  // a fission releases far more per event, a fusion more per nucleon
  assert.ok(W("fbk") > 9 * W("dt"));
  assert.ok(W("dt") / 5 > W("fbk") / 236);
});

test("binding energy per nucleon: known values, peak near Fe-56", () => {
  near(binding(nuclide("H2")).W, 2.224, 0.005);
  near(binding(nuclide("He4")).perNucleon, 7.07, 0.01);
  near(binding(nuclide("C12")).perNucleon, 7.68, 0.01);
  near(binding(nuclide("Fe56")).perNucleon, 8.79, 0.01);
  near(binding(nuclide("U235")).perNucleon, 7.59, 0.01);
  near(binding(nuclide("U235")).dm, 1.915065, 1e-6);
  const top = mostStable();
  assert.ok(top.A >= 50 && top.A <= 70, `peak at A = ${top.A}`);
  near(binding(top).perNucleon, binding(nuclide("Fe56")).perNucleon, 0.01);
  for (const p of CURVE) {
    const e = binding(p).perNucleon;
    assert.ok(e > 1 && e < 8.9, `${p.id}: ${e}`);
    if (p.A < 12 || p.A > 150) assert.ok(e < binding(nuclide("Fe56")).perNucleon - 0.3, p.id);
  }
  // heavy nuclei fall off steadily: fission fragments are more tightly bound than uranium
  assert.ok(binding(nuclide("Ba141")).perNucleon > binding(nuclide("U235")).perNucleon);
  assert.ok(binding(nuclide("Kr92")).perNucleon > binding(nuclide("U235")).perNucleon);
});

test("classification of the chain by k", () => {
  assert.equal(classify(0.95), "subcritical");
  assert.equal(classify(1), "critical");
  assert.equal(classify(0.1 + 0.9), "critical"); // slider rounding
  assert.equal(classify(1.05), "supercritical");
  assert.equal(expected(1, 20, 7), 20);
  near(expected(1.3, 20, 3), 43.94, 1e-9);
});

const meanAt = (k, g, runs = 4000) => {
  let sum = 0;
  let seed = 7;
  for (let i = 0; i < runs; i++) {
    seed = nextSeed(seed);
    sum += runChain(seed, k, 20).counts[g] ?? 0;
  }
  return sum / runs;
};

test("k < 1 dies away, k = 1 holds steady, k > 1 grows (averaged over many runs)", () => {
  for (const g of [3, 8, G_MAX]) {
    near(meanAt(0.7, g) / expected(0.7, 20, g), 1, 0.15);
    near(meanAt(1, g) / 20, 1, 0.1);
    near(meanAt(1.3, g) / expected(1.3, 20, g), 1, 0.1);
  }
  assert.ok(meanAt(0.7, G_MAX) < 1);
  assert.ok(meanAt(1.3, G_MAX) > 300);
  assert.ok(meanAt(0.7, 4) < meanAt(1, 4) && meanAt(1, 4) < meanAt(1.3, 4));
  // k = 0: no neutron ever causes another fission
  assert.deepEqual(runChain(3, 0, 20).counts, [20, 0]);
});

test("a run is fully determined by seed, k and n0", () => {
  const a = runChain(12345, 1.1, 20);
  const b = runChain(999, 1.1, 20); // different call in between defeats the cache
  const c = runChain(12345, 1.1, 20);
  assert.deepEqual(a.counts, c.counts);
  assert.notDeepEqual(a.counts, b.counts);
  assert.equal(a.counts[0], 20);
  assert.ok(a.counts.length <= G_MAX + 1);
  for (const n of a.counts) assert.ok(Number.isInteger(n) && n >= 0);
  assert.notEqual(nextSeed(1), nextSeed(2));
});

test("runaway growth is capped and forged values are harmless", () => {
  const big = runChain(1, 1.5, 50);
  assert.ok(big.capped);
  assert.ok(big.counts.at(-1) > CAP && big.counts.length <= G_MAX + 1);
  assert.equal(runChain(1, 1.5, 1e12).counts[0], CAP);
  assert.deepEqual(runChain(1, 1, -5).counts, [0]);
  assert.ok(runChain(NaN, NaN, NaN).counts.length >= 1);
  assert.equal(gensOf({ gens: -4 }), 0);
  assert.equal(gensOf({ gens: 1e9 }), G_MAX);
  assert.equal(gensOf({ gens: "x" }), 0);
  assert.ok(balance({ ...PRESETS.fbk, extra: 99 }).right.A === 141 + 92 + 3);
});

test("the chain animation adds one generation per GEN_TIME and ends once", () => {
  const s = { ...initialState(), k: 1, gens: 0 };
  const total = chainView({ ...s, gens: G_MAX });
  let ends = 0;
  let steps = 0;
  while (!ends && steps < 1e5) {
    if (step(s, 1 / 120)) ends++;
    steps++;
  }
  assert.equal(ends, 1);
  assert.equal(chainView(s).generations, total.generations);
  assert.equal(chainView(s).fissions, total.fissions);
  near(steps / 120, total.generations * GEN_TIME, 0.2);
  assert.equal(step(s, 1), false); // a finished run does not finish again
  const v = chainView({ ...initialState(), gens: 2 });
  assert.equal(v.counts.length, 3);
  assert.equal(v.fissions, v.counts[0] + v.counts[1] + v.counts[2]);
  assert.equal(v.done, false);
});
