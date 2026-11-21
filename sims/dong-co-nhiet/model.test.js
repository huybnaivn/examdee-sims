import test from "node:test";
import assert from "node:assert/strict";
import { initialState, cycle, pointAt, step, carnotEfficiency, temperature, R, N_MOL } from "./model.js";

const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const states = [];
for (const cyc of ["carnot", "rect"])
  for (const gas of ["mono", "di"])
    for (const [tHot, tCold] of [[600, 300], [1000, 200], [400, 390], [800, 250]])
      for (const [vMin, vMax] of [[2, 3.5], [1, 1.5], [4, 8], [1, 4]]) states.push({ ...initialState(), cycle: cyc, gas, tHot, tCold, vMin, vMax });
const valid = states.map(s => [s, cycle(s)]).filter(([, c]) => c);

/** ∮p dV along the drawn path (trapezoid rule). */
const loopIntegral = c => {
  let sum = 0;
  for (const leg of c.legs) {
    let prev = pointAt(leg, 0);
    for (let k = 1; k <= 4000; k++) {
      const q = pointAt(leg, k / 4000);
      sum += ((q.p + prev.p) / 2) * (q.V - prev.V);
      prev = q;
    }
  }
  return sum;
};

test("W = Q₁ − Q₂ and ΔU = 0 over a full cycle (energy is conserved)", () => {
  assert.ok(valid.length > 40);
  for (const [, c] of valid) {
    close(c.W, c.Q1 - c.Q2);
    close(c.legs.reduce((a, l) => a + l.dU, 0), 0, 1e-9);
    for (const l of c.legs) close(l.Q, l.dU + l.W); // first law on each leg
    close(c.eta, 1 - c.Q2 / c.Q1);
  }
});

test("the work equals the area enclosed by the loop on the p–V diagram", () => {
  for (const [, c] of valid) close(loopIntegral(c), c.W, 1e-5);
});

test("Carnot cycle: efficiency is 1 − T₂/T₁ and Q₂/Q₁ = T₂/T₁", () => {
  for (const [s, c] of valid.filter(([s]) => s.cycle === "carnot")) {
    close(c.eta, 1 - s.tCold / s.tHot, 1e-9);
    close(c.Q2 / c.Q1, s.tCold / s.tHot, 1e-9);
    close(c.W, N_MOL * R * (s.tHot - s.tCold) * Math.log(s.vMax / s.vMin), 1e-9);
  }
  close(carnotEfficiency(600, 300), 0.5);
});

test("isothermal legs keep p·V constant, adiabatic legs keep p·V^γ constant", () => {
  for (const [s, c] of valid.filter(([s]) => s.cycle === "carnot")) {
    const g = s.gas === "mono" ? 5 / 3 : 7 / 5;
    for (const leg of c.legs)
      for (const u of [0, 0.3, 0.7, 1]) {
        const q = pointAt(leg, u);
        if (leg.kind === "isoT") close(q.p * q.V, leg.a.p * leg.a.V, 1e-12);
        else close(q.p * q.V ** g, leg.a.p * leg.a.V ** g, 1e-12);
      }
    close(temperature(c.pts[0]), s.tHot, 1e-12);
    close(temperature(c.pts[2]), s.tCold, 1e-12);
    for (const leg of c.legs) if (leg.kind === "adia") assert.equal(Math.abs(leg.Q) < 1e-9, true);
  }
});

test("rectangular cycle: work = Δp·ΔV, efficiency below Carnot for the same extreme temperatures", () => {
  const rects = valid.filter(([s]) => s.cycle === "rect");
  assert.ok(rects.length > 10);
  for (const [s, c] of rects) {
    const [a, , b] = c.pts;
    close(c.W, (b.p - a.p) * (b.V - a.V), 1e-12);
    const temps = c.pts.map(temperature);
    close(Math.max(...temps), s.tHot, 1e-9);
    close(Math.min(...temps), s.tCold, 1e-9);
    assert.ok(c.eta > 0 && c.eta < 1 - s.tCold / s.tHot);
  }
  // p_high must exceed p_low: vMax/vMin ≥ T₁/T₂ cannot make a rectangle
  assert.equal(cycle({ ...initialState(), cycle: "rect", tHot: 400, tCold: 390, vMin: 1, vMax: 4 }), null);
});

test("the animation reports one completed cycle per 4 legs", () => {
  const s = initialState();
  let done = 0;
  for (let k = 0; k < 120 * 1.5 * 4 * 3; k++) if (step(s, 1 / 120)) done++;
  assert.equal(done, 3);
  assert.equal(s.cycles, 3);
  assert.ok(s.phase >= 0 && s.phase < 4);
});
