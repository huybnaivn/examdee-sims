import test from "node:test";
import assert from "node:assert/strict";
import { EPS0, DIELECTRICS, initialState, epsilon, capacitance, solve, setConnected, si, signUnit } from "./model.js";

const near = (a, b, rel = 1e-12) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b)), `${a} ≠ ${b}`);

test("C = ε·ε₀·S/d", () => {
  // 200 cm², 4 mm, air: 8,854e-12 · 0,02 / 0,004 = 44,27 pF
  near(capacitance(initialState()), 44.27e-12, 1e-9);
  for (const [area, distance, dielectric] of [[50, 1, "air"], [400, 10, "mica"], [120, 2.5, "glass"], [300, 7, "paper"]]) {
    const s = { ...initialState(), area, distance, dielectric };
    near(capacitance(s), (DIELECTRICS[dielectric] * EPS0 * area * 1e-4) / (distance * 1e-3));
  }
  near(capacitance({ ...initialState(), dielectric: "custom", epsCustom: 3.5 }), 3.5 * capacitance(initialState()));
});

test("dielectric constants and the custom value", () => {
  assert.deepEqual(DIELECTRICS, { air: 1, paper: 2, mica: 6, glass: 7 });
  assert.equal(epsilon({ ...initialState(), dielectric: "mica" }), 6);
  assert.equal(epsilon({ ...initialState(), dielectric: "custom", epsCustom: 8.5 }), 8.5);
});

test("doubling d halves C; doubling S or ε doubles it", () => {
  const s = initialState();
  near(capacitance({ ...s, distance: 8 }), capacitance(s) / 2);
  near(capacitance({ ...s, area: 400 }), capacitance(s) * 2);
  near(capacitance({ ...s, dielectric: "paper" }), capacitance(s) * 2);
});

test("Q = C·U, E = U/d, W = C·U²/2", () => {
  const s = { ...initialState(), voltage: 9, distance: 3, dielectric: "glass" };
  const r = solve(s);
  near(r.C, capacitance(s));
  near(r.Q, r.C * 9);
  near(r.E, 9 / 0.003); // 3000 V/m
  near(r.W, (r.C * 81) / 2);
  near(r.W, (r.Q * r.U) / 2);
  near(r.W, r.Q ** 2 / (2 * r.C));
  assert.deepEqual(solve({ ...s, voltage: 0 }), { eps: 7, C: r.C, Q: 0, U: 0, E: 0, W: 0 });
});

test("connected: U stays at the battery voltage and Q follows C", () => {
  const s = initialState();
  const before = solve(s);
  for (const change of [{ distance: 8 }, { area: 100 }, { dielectric: "mica" }]) {
    const after = solve({ ...s, ...change });
    assert.equal(after.U, s.voltage);
    near(after.Q / before.Q, after.C / before.C);
  }
  near(solve({ ...s, distance: 8 }).E, before.E / 2); // E = U/d falls
  near(solve({ ...s, distance: 8 }).W, before.W / 2);
});

test("disconnected: Q is fixed and U = Q/C", () => {
  const s = initialState();
  const before = solve(s);
  setConnected(s, false);
  assert.equal(s.connected, false);
  near(s.charge, before.Q);
  assert.deepEqual(solve(s), before); // nothing changes at the moment of disconnecting
  s.voltage = 24; // the battery no longer matters
  near(solve(s).U, before.U);

  s.distance = 8; // pull the plates apart: C halves, U doubles, E stays, W doubles
  let r = solve(s);
  near(r.Q, before.Q);
  near(r.U, r.Q / r.C);
  near(r.U, 2 * before.U);
  near(r.E, before.E);
  near(r.W, 2 * before.W);

  s.distance = 4;
  s.dielectric = "mica"; // slide a dielectric in: C × 6, U ÷ 6, W ÷ 6
  r = solve(s);
  near(r.Q, before.Q);
  near(r.U, before.U / 6);
  near(r.W, before.W / 6);
});

test("reconnecting brings U back to the battery voltage", () => {
  const s = setConnected(initialState(), false);
  s.distance = 8;
  setConnected(s, true);
  const r = solve(s);
  assert.equal(r.U, 12);
  near(r.Q, capacitance(s) * 12);
  // disconnecting again holds the new charge, not the old one
  near(setConnected(s, false).charge, r.Q);
});

test("unit prefixes and charge-sign unit", () => {
  assert.deepEqual(si(0), { value: 0, prefix: "" });
  near(si(44.27e-12).value, 44.27);
  assert.equal(si(44.27e-12).prefix, "p");
  assert.equal(si(1.06e-9).prefix, "n");
  assert.equal(si(3000).prefix, "k");
  assert.equal(si(12).prefix, "");
  assert.equal(si(-2.5e-6).prefix, "µ");
  assert.equal(si(5e-13).prefix, "p");
  for (const q of [0, 3e-12, 5.31e-10, 4.2e-8, 1e-6]) {
    for (const max of [4, 25, 40]) {
      const unit = signUnit(q, max);
      assert.ok(Math.round(q / unit) <= max, `${q} ${max}`);
      assert.ok([1, 2, 5].some(m => Math.abs(Math.log10(unit / m) - Math.round(Math.log10(unit / m))) < 1e-9));
    }
  }
  near(signUnit(5.31e-10, 25), 5e-11, 1e-9);
});

test("a forged charge from a restored state is kept physical", async () => {
  const { solve, initialState, MAX_CHARGE } = await import("./model.js");
  const off = { ...initialState(), connected: false };
  assert.equal(solve({ ...off, charge: -1 }).Q, 0);
  assert.equal(solve({ ...off, charge: 1e9 }).Q, MAX_CHARGE);
});
