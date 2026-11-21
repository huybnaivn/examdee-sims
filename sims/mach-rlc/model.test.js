import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, atResonance, instant } from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const at = over => ({ ...initialState(), ...over });

test("Z_L = ωL, Z_C = 1/(ωC), Z = √(R² + (Z_L − Z_C)²)", () => {
  for (const [f, L, C, R] of [[50, 0.4, 50, 40], [120, 0.1, 10, 100], [10, 1, 200, 10]]) {
    const c = solve(at({ frequency: f, inductance: L, capacitance: C, resistance: R }));
    const w = 2 * Math.PI * f;
    near(c.zL, w * L);
    near(c.zC, 1 / (w * C * 1e-6));
    near(c.z, Math.sqrt(R ** 2 + (w * L - 1 / (w * C * 1e-6)) ** 2));
  }
  // textbook numbers: 50 Hz, 0,4 H, 50 µF → Z_L ≈ 125,66 Ω, Z_C ≈ 63,66 Ω
  const c = solve(initialState());
  near(c.zL, 125.6637, 1e-6);
  near(c.zC, 63.6620, 1e-6);
});

test("tan φ = (Z_L − Z_C)/R, I = U/Z, P = U·I·cos φ = I²R", () => {
  const s = at({ voltage: 150, frequency: 80, resistance: 60 });
  const c = solve(s);
  near(Math.tan(c.phi), (c.zL - c.zC) / 60);
  near(c.current, 150 / c.z);
  near(c.power, 150 * c.current * Math.cos(c.phi));
  near(c.power, c.current ** 2 * 60);
  near(c.cosPhi, 60 / c.z);
});

test("removing L or C: their reactance drops out", () => {
  const noL = solve(at({ useL: false }));
  assert.equal(noL.zL, 0);
  near(noL.z, Math.hypot(40, noL.zC));
  const noC = solve(at({ useC: false }));
  assert.equal(noC.zC, 0);
  near(noC.z, Math.hypot(40, noC.zL));
  const onlyR = solve(at({ useL: false, useC: false }));
  near(onlyR.z, 40);
  assert.equal(onlyR.phi, 0);
  assert.ok(Number.isNaN(noL.f0) && Number.isNaN(noC.f0));
});

test("resonance at f₀ = 1/(2π√(LC)): Z = R, φ = 0, I is largest", () => {
  const s = initialState();
  const f0 = 1 / (2 * Math.PI * Math.sqrt(0.4 * 50e-6));
  near(solve(s).f0, f0);
  const r = solve(at({ frequency: f0 }));
  near(r.z, 40);
  near(r.phi, 0, 1e-9);
  near(r.current, 100 / 40);
  for (const f of [f0 * 0.8, f0 * 1.2]) assert.ok(solve(at({ frequency: f })).current < r.current);
  assert.ok(atResonance(at({ frequency: f0 * 1.005 })));
  assert.ok(!atResonance(at({ frequency: f0 * 1.05 })));
  assert.ok(!atResonance(at({ frequency: f0, useC: false })));
});

test("capacitive: i leads u (φ < 0); inductive: i lags u (φ > 0)", () => {
  const f0 = solve(initialState()).f0;
  const cap = at({ frequency: f0 / 2 });
  const ind = at({ frequency: f0 * 2 });
  assert.ok(solve(cap).zC > solve(cap).zL && solve(cap).phi < 0);
  assert.ok(solve(ind).zL > solve(ind).zC && solve(ind).phi > 0);
  // i reaches its peak before u when it leads: peak of i is at ωt = φ < 0
  const c = solve(cap);
  const tPeak = c.phi / c.omega;
  near(instant(cap, tPeak).i, c.current * Math.SQRT2);
  assert.ok(tPeak < 0);
  near(instant(cap, 0).u, 100 * Math.SQRT2);
});
