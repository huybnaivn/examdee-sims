import test from "node:test";
import assert from "node:assert/strict";
import { initialState, rheostatR, rheostat, divider, brightness, isRated, R_BULB, I_RATED } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const at = (o = {}) => ({ ...initialState(), ...o });

test("rheostat resistance is proportional to the coil length in use", () => {
  near(rheostatR(at({ position: 0 })), 0);
  near(rheostatR(at({ position: 25 })), 5);
  near(rheostatR(at({ position: 50, rMax: 80 })), 40);
  near(rheostatR(at({ position: 100 })), 20);
  near(rheostatR(at({ position: 150 })), 20); // forged state is clamped
});

test("I = U / (R_đ + R_b), and the voltages add up", () => {
  for (const position of [0, 30, 100]) {
    const s = at({ position });
    const r = rheostat(s);
    near(r.i, 9 / (12 + 0.2 * position));
    near(r.uBulb + r.uRheostat, 9);
  }
  near(R_BULB, 12);
  near(I_RATED, 0.5);
  // end positions are the extremes
  assert.ok(rheostat(at({ position: 0 })).i > rheostat(at({ position: 1 })).i);
  assert.ok(rheostat(at({ position: 100 })).i < rheostat(at({ position: 99 })).i);
});

test("rated brightness: R_b = (U − U_đm)/I_đm", () => {
  assert.equal(isRated(at()), false);
  assert.equal(isRated(at({ position: 30 })), true); // 6 Ω → 9 V / 18 Ω = 0,5 A
  near(brightness(rheostat(at({ position: 30 })).pBulb), 1);
  assert.equal(isRated(at({ position: 40 })), false);
  assert.ok(brightness(rheostat(at({ position: 0 })).pBulb) > 1); // overdriven
  assert.equal(isRated(at({ mode: "divider", position: 30 })), false);
});

test("divider: U_ra = U·R₂/(R₁ + R₂) unloaded, ends give 0 and U", () => {
  for (const position of [0, 10, 50, 75, 100]) {
    const d = divider(at({ mode: "divider", position }));
    near(d.uOut, (9 * d.r2) / (d.r1 + d.r2));
    near(d.uOut, d.unloaded);
    near(d.i, 9 / 20);
  }
  near(divider(at({ mode: "divider", position: 0 })).uOut, 0);
  near(divider(at({ mode: "divider", position: 100 })).uOut, 9);
});

test("a load lowers the output, except at the ends", () => {
  const d = divider(at({ mode: "divider", position: 50, loaded: true, rLoad: 10 }));
  near(d.uOut, (9 * 5) / (10 + 5)); // R₂∥R_t = 5 Ω against R₁ = 10 Ω
  assert.ok(d.uOut < d.unloaded);
  near(d.iLoad, d.uOut / 10);
  const heavier = divider(at({ mode: "divider", position: 50, loaded: true, rLoad: 5 }));
  assert.ok(heavier.uOut < d.uOut);
  near(divider(at({ mode: "divider", position: 100, loaded: true, rLoad: 5 })).uOut, 9);
  near(divider(at({ mode: "divider", position: 0, loaded: true, rLoad: 5 })).uOut, 0);
});
