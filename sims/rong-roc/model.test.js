import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, pull, step, G } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const at = (system, extra = {}) => ({ ...initialState(), system, height: 0.5, ...extra });

test("fixed pulley: F = P and s = h", () => {
  const r = solve(at("fixed", { mass: 30 }));
  near(r.force, 30 * G);
  near(r.rope, 0.5);
});

test("one movable pulley: F = P/2 and s = 2h", () => {
  const r = solve(at("movable1", { mass: 30 }));
  near(r.force, (30 * G) / 2);
  near(r.rope, 1);
});

test("n movable pulleys: F = P/(2n) and s = 2n·h", () => {
  for (const [system, n] of [["movable2", 2], ["movable3", 3]]) {
    const r = solve(at(system, { mass: 48 }));
    near(r.force, (48 * G) / (2 * n));
    near(r.rope, 2 * n * 0.5);
  }
});

test("ideal machine: F·s = P·h, no gain in work, H = 100 %", () => {
  for (const system of ["fixed", "movable1", "movable2", "movable3"]) {
    const r = solve(at(system, { mass: 17, height: 0.73 }));
    near(r.workIn, r.workOut);
    near(r.workOut, 17 * G * 0.73);
    near(r.efficiency, 1);
  }
});

test("pulley weight and friction raise the force", () => {
  const r = solve(at("movable2", { mass: 40, pulleyMass: 2 }));
  near(r.force, (40 * G + 2 * 2 * G) / 4);
  near(r.efficiency, 400 / 440);
  near(r.workOut / r.workIn, r.efficiency);
  const f = solve(at("movable2", { mass: 40, efficiency: 80 }));
  near(f.force, (40 * G) / 4 / 0.8);
  near(f.efficiency, 0.8);
  // A fixed pulley's own weight is carried by its support.
  near(solve(at("fixed", { mass: 40, pulleyMass: 2 })).force, 40 * G);
});

test("pulling: load rises s/k, stops at the target and reports it once", () => {
  const s = at("movable3", { height: 0, target: 1 });
  assert.equal(pull(s, 3), false);
  near(s.height, 0.5);
  assert.equal(pull(s, 10), true);
  near(s.height, 1);
  assert.equal(pull(s, 1), false);
  pull(s, -60);
  assert.equal(s.height, 0);
  let hits = 0;
  for (let i = 0; i < 2000; i++) hits += step(s, 1 / 120);
  assert.equal(hits, 1);
});

test("forged state stays sane", () => {
  const r = solve({ ...initialState(), system: "bogus", height: 99, efficiency: 0 });
  near(r.height, 1);
  assert.ok(Number.isFinite(r.force));
});
