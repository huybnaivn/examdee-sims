import test from "node:test";
import assert from "node:assert/strict";
import { sides, ratios, deg, EXACT_VALUES, TASKS, taskAngle, taskMet } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("ratios come from the side lengths (3–4–5 triangle)", () => {
  const alpha = deg(Math.atan2(3, 4)); // AC = 3, AB = 4, BC = 5
  const s = sides(alpha, 5);
  near(s.ab, 4);
  near(s.ac, 3);
  near(s.ab ** 2 + s.ac ** 2, s.bc ** 2); // Pythagoras
  const r = ratios(alpha, 5);
  near(r.sin, 3 / 5);
  near(r.cos, 4 / 5);
  near(r.tan, 3 / 4);
  near(r.cot, 4 / 3);
  const c = ratios(alpha, 5, true); // angle C: opposite AB, adjacent AC
  near(c.sin, 4 / 5);
  near(c.tan, 4 / 3);
});

test("ratios do not depend on the size of the triangle", () => {
  for (const alpha of [10, 35, 72]) {
    const a = ratios(alpha, 2);
    const b = ratios(alpha, 7.5);
    for (const k of ["sin", "cos", "tan", "cot"]) near(a[k], b[k]);
  }
});

test("complementary angles, tan·cot = 1, sin² + cos² = 1, sin and cos below 1", () => {
  for (let alpha = 1; alpha < 90; alpha++) {
    const r = ratios(alpha, 4);
    const c = ratios(90 - alpha, 4);
    near(r.sin, c.cos);
    near(r.tan, c.cot);
    near(r.sin, ratios(alpha, 4, true).cos, 1e-12); // angle C is 90° − α in the same triangle
    near(r.tan * r.cot, 1);
    near(r.sin ** 2 + r.cos ** 2, 1);
    near(r.tan, r.sin / r.cos);
    assert.ok(r.sin > 0 && r.sin < 1 && r.cos > 0 && r.cos < 1);
  }
});

test("exact values at 30°, 45°, 60°", () => {
  for (const a of [30, 45, 60]) {
    const r = ratios(a, 3);
    for (const k of ["sin", "cos", "tan", "cot"]) near(r[k], EXACT_VALUES[a][k], 1e-12);
  }
  near(EXACT_VALUES[30].sin, 1 / 2);
  near(EXACT_VALUES[60].tan, Math.sqrt(3));
});

test("finding the angle from a ratio", () => {
  near(taskAngle(TASKS[1]), 30);
  near(taskAngle(TASKS[2]), 60);
  near(taskAngle(TASKS[3]), 45);
  assert.equal(Math.round(taskAngle(TASKS[4])), 53);
  assert.equal(Math.round(taskAngle(TASKS[5])), 63);
  assert.equal(Math.round(taskAngle(TASKS[6])), 26);
  assert.equal(Math.round(taskAngle(TASKS[7])), 18);
  assert.ok(taskMet(30, 1) && !taskMet(31, 1) && !taskMet(30, 0));
});
