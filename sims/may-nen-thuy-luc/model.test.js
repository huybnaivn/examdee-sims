import test from "node:test";
import assert from "node:assert/strict";
import { initialState, pressure, force2, weight, required, lifts, lift, travel, work1, work2, push, letGo, lower, STROKE, MAX_LIFT, G } from "./model.js";

const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const make = patch => ({ ...initialState(), ...patch });

test("p = F₁/S₁ = F₂/S₂ and F₂/F₁ = S₂/S₁", () => {
  for (const [area1, area2, force1] of [[5, 250, 300], [1, 1000, 50], [20, 60, 999]]) {
    const s = make({ area1, area2, force1 });
    close(pressure(s), force1 / (area1 * 1e-4));
    close(force2(s) / (area2 * 1e-4), pressure(s));
    close(force2(s) / force1, area2 / area1);
  }
  close(pressure(make({})), 600000); // 300 N on 5 cm²
});

test("volume conservation S₁h₁ = S₂h₂ over several strokes", () => {
  const s = make({ area1: 4, area2: 400 });
  for (let i = 0; i < 7; i++) {
    push(s, 3);
    close(s.area1 * travel(s), s.area2 * lift(s));
    letGo(s);
  }
  close(lift(s), (7 * 3 * 4) / 400);
  close(travel(s), 21);
  assert.equal(s.strokes, 7);
});

test("work in equals work out: F₁·h₁ = F₂·h₂", () => {
  const s = make({ area1: 3, area2: 600, force1: 120 });
  for (let i = 0; i < 4; i++) push(s, STROKE), letGo(s);
  push(s, 2.5);
  close(work1(s), work2(s));
  assert.ok(work1(s) > 0);
});

test("the load lifts only when F₁ ≥ P·S₁/S₂", () => {
  const s = make({ area1: 5, area2: 250, load: "car" });
  close(required(s), (1200 * G * 5) / 250);
  s.force1 = required(s) - 0.5;
  assert.equal(lifts(s), false);
  assert.equal(push(s, 5), 0);
  assert.equal(lift(s), 0);
  s.force1 = required(s);
  assert.equal(lifts(s), true);
  assert.ok(push(s, 5) > 0 && lift(s) > 0);
  close(force2(s), weight(s));
});

test("travel stops at full stroke and at the top of the large cylinder; forged values are clamped", () => {
  const s = make({ area1: 20, area2: 60, force1: 1000, load: "bike" });
  push(s, 100);
  assert.equal(s.h1, STROKE);
  for (let i = 0; i < 10; i++) letGo(s), push(s, STROKE);
  close(lift(s), MAX_LIFT);
  lower(s);
  assert.equal(lift(s), 0);
  assert.equal(lift(make({ pumped: -5, h1: 1e9 })), (STROKE * 5) / 250);
  assert.equal(weight(make({ load: "boat" })), 1200 * G);
});
