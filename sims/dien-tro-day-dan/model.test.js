import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, resistance0, atTemperature, MATERIALS, T0 } from "./model.js";

const near = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const with_ = patch => solve({ ...initialState(), ...patch });

test("R = ρ·l/S", () => {
  for (const m of MATERIALS) {
    for (const [length, area] of [[1, 0.5], [0.1, 0.1], [5, 2], [2.3, 0.75]]) {
      near(with_({ material: m.key, length, area }).r, (m.rho * length) / (area * 1e-6));
    }
  }
  // nicrom, 2 m, 0,5 mm²: 1,1·10⁻⁶ · 2 / 0,5·10⁻⁶ = 4,4 Ω
  near(solve(initialState()).r, 4.4);
  near(resistance0(1.7e-8, 100, 1), 1.7); // 100 m of 1 mm² copper
});

test("doubling l doubles R, doubling S halves R", () => {
  for (const m of MATERIALS) {
    const base = with_({ material: m.key, length: 1.2, area: 0.4 }).r;
    near(with_({ material: m.key, length: 2.4, area: 0.4 }).r, 2 * base);
    near(with_({ material: m.key, length: 1.2, area: 0.8 }).r, base / 2);
    near(with_({ material: m.key, length: 2.4, area: 0.8 }).r, base);
  }
});

test("materials order: đồng < nhôm < sắt < constantan < nicrom", () => {
  const r = Object.fromEntries(MATERIALS.map(m => [m.key, with_({ material: m.key }).r]));
  assert.ok(r.copper < r.aluminium && r.aluminium < r.iron && r.iron < r.constantan && r.constantan < r.nichrome);
  // nicrom has about 65 times the resistance of the same copper wire
  near(r.nichrome / r.copper, 1.1e-6 / 1.7e-8);
  // an unknown material falls back to the first one
  near(with_({ material: "gold" }).r, with_({ material: "copper" }).r);
});

test("temperature: R = R₀(1 + α(t − 20 °C))", () => {
  for (const m of MATERIALS) {
    for (const t of [0, 20, 100, 350, 500]) {
      const out = with_({ material: m.key, useTemp: true, temperature: t });
      near(out.r, out.r0 * (1 + m.alpha * (t - T0)));
      near(atTemperature(out.r0, m.alpha, t), out.r);
    }
    near(with_({ material: m.key, useTemp: true, temperature: 20 }).r, with_({ material: m.key }).r);
    // ignored unless switched on
    near(with_({ material: m.key, useTemp: false, temperature: 500 }).r, with_({ material: m.key }).r);
  }
  // metals: hotter wire, larger R; constantan barely changes
  assert.ok(with_({ material: "copper", useTemp: true, temperature: 220 }).r > 1.8 * with_({ material: "copper" }).r);
  assert.ok(with_({ material: "constantan", useTemp: true, temperature: 220 }).r < 1.003 * with_({ material: "constantan" }).r);
});

test("I = U/R from the ammeter", () => {
  for (const voltage of [0, 1.5, 3, 12]) {
    for (const m of MATERIALS) {
      const out = with_({ material: m.key, voltage, length: 3, area: 0.2, useTemp: true, temperature: 80 });
      near(out.current, voltage / out.r);
    }
  }
  near(solve(initialState()).current, 3 / 4.4);
  near(with_({ area: 1 }).diameter, Math.sqrt(4 / Math.PI));
});
