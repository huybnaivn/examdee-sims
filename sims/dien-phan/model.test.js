import test from "node:test";
import assert from "node:assert/strict";
import { initialState, electrolyze, discharged, faradayMass, gasVolume, step, F, VM, A_CU, SETUPS } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const run = (setup, conc, current, t) => electrolyze({ ...initialState(), setup, conc, current }, t);

test("Faraday's law m = A·I·t/(n·F)", () => {
  near(faradayMass(64, 1, F, 2), 32); // one faraday deposits half a mole of Cu
  near(faradayMass(64, 2, 1800, 2), (64 * 2 * 1800) / (2 * 96485));
  const r = run("cuso4-inert", 0.5, 2, 1800);
  near(r.cathodeMass, faradayMass(A_CU, 2, 1800, 2));
  near(r.q, 3600);
});

test("gas volume at standard conditions is n × 24,79 L/mol", () => {
  near(gasVolume(1), 24.79);
  near(gasVolume(0.05), 1.2395);
  const r = run("cuso4-inert", 0.5, 2, 1800);
  near(r.gasAnode, (3600 / F / 4) * VM); // O₂: 4 e per molecule
  near(r.gasCathode, 0);
});

test("which species is discharged at each electrode", () => {
  assert.deepEqual([discharged("cuso4-inert", 1).cathode.species, discharged("cuso4-inert", 1).anode.species], ["Cu2+", "H2O"]);
  assert.deepEqual([discharged("cuso4-inert", 2).cathode.species, discharged("cuso4-inert", 2).anode.species], ["H2O", "H2O"]);
  assert.deepEqual([discharged("cuso4-copper").cathode.species, discharged("cuso4-copper").anode.species], ["Cu2+", "Cu"]);
  for (const setup of ["nacl-membrane", "nacl-open"]) {
    assert.deepEqual([discharged(setup, 1).cathode.species, discharged(setup, 1).anode.species], ["H2O", "Cl-"]); // Na⁺ stays in solution
    assert.deepEqual([discharged(setup, 2).cathode.species, discharged(setup, 2).anode.species], ["H2O", "H2O"]);
  }
});

test("CuSO₄ with inert electrodes: Cu until Cu²⁺ runs out, then H₂ at the cathode", () => {
  const n0 = 0.1 * 0.2; // 0.02 mol Cu²⁺
  const tEnd = (2 * n0 * F) / 5; // time to discharge all Cu²⁺ at 5 A
  const before = run("cuso4-inert", 0.1, 5, tEnd * 0.5);
  assert.equal(before.stage, 1);
  near(before.cuLeft, n0 / 2);
  near(before.h2so4, n0 / 2);
  const after = run("cuso4-inert", 0.1, 5, tEnd * 1.5);
  assert.equal(after.stage, 2);
  near(after.cu, n0);
  near(after.cuLeft, 0);
  near(after.h2, n0 / 2); // the extra 0.02 mol e make 0.01 mol H₂
  near(after.cathodeMass, n0 * 64);
});

test("copper anode dissolves as much as the cathode gains; the colour stays", () => {
  const r = run("cuso4-copper", 0.5, 3, 2400);
  near(r.anodeMass, -r.cathodeMass);
  near(r.cathodeMass, faradayMass(64, 3, 2400, 2));
  near(r.cuLeft, r.n0); // [Cu²⁺] unchanged
  near(r.gasCathode + r.gasAnode, 0);
});

test("NaCl: H₂ at the cathode, Cl₂ at the anode; without a membrane Cl₂ turns into NaClO", () => {
  const m = run("nacl-membrane", 1, 2, 1800);
  const ne = 3600 / F;
  near(m.h2, ne / 2);
  near(m.cl2, ne / 2);
  near(m.naoh, ne);
  near(m.gasCathode, m.gasAnode); // equal volumes of H₂ and Cl₂
  const o = run("nacl-open", 1, 2, 1800);
  near(o.cl2, 0);
  near(o.gasAnode, 0);
  near(o.naclo, ne / 2);
  near(o.clLeft, o.n0 - ne / 2);
  // once Cl⁻ is used up the anode gives O₂
  const late = run("nacl-membrane", 0.1, 5, 3600); // 0.187 mol e > 0.02 mol Cl⁻
  assert.equal(late.stage, 2);
  near(late.cl2, 0.01);
  near(late.o2, (18000 / F - 0.02) / 4);
});

test("charge balance: electrons taken at the cathode = given at the anode = I·t/F", () => {
  for (const { id } of SETUPS) {
    for (const [conc, I, t] of [[0.1, 5, 3600], [0.5, 2, 1800], [1, 0.5, 60], [0.1, 1, 0]]) {
      const r = run(id, conc, I, t);
      near(r.eCathode, (I * t) / F);
      near(r.eAnode, (I * t) / F);
    }
  }
});

test("the run stops at the set duration and forged input is clamped", () => {
  const s = { ...initialState(), duration: 60 };
  let done = 0;
  for (let i = 0; i < 100; i++) done += step(s, 1) ? 1 : 0;
  assert.equal(done, 1);
  assert.equal(s.t, 60);
  const r = electrolyze({ setup: "x", conc: -5, current: Infinity, t: 10 });
  assert.equal(r.setup, "cuso4-inert");
  assert.equal(r.q, 0);
});
