import test from "node:test";
import assert from "node:assert/strict";
import { initialState, sum, magnitude, direction, angleBetween } from "./model.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
const make = (ax, ay, bx, by) => ({ ...initialState(), ax, ay, bx, by });

test("sum adds components", () => {
  assert.deepEqual(sum(make(4, 1, 1, 3)), { x: 5, y: 4 });
  assert.deepEqual(sum(make(3, -2, -3, 2)), { x: 0, y: 0 });
});

test("perpendicular vectors: |a + b| = √(a² + b²)", () => {
  const s = make(3, 0, 0, 4);
  near(angleBetween(s), 90);
  near(magnitude(sum(s).x, sum(s).y), 5);
});

test("law of cosines holds for any pair", () => {
  for (const s of [make(4, 1, 1, 3), make(-2, 5, 6, -1), make(1, 1, 2, 2)]) {
    const a = magnitude(s.ax, s.ay);
    const b = magnitude(s.bx, s.by);
    const r = magnitude(sum(s).x, sum(s).y);
    near(r * r, a * a + b * b + 2 * a * b * Math.cos((angleBetween(s) * Math.PI) / 180));
  }
});

test("parallel and opposite vectors", () => {
  near(angleBetween(make(1, 1, 2, 2)), 0);
  near(angleBetween(make(1, 0, -3, 0)), 180);
  assert.ok(Number.isNaN(angleBetween(make(0, 0, 1, 1))));
});

test("direction is measured counter-clockwise in [0, 360)", () => {
  near(direction(1, 0), 0);
  near(direction(0, 2), 90);
  near(direction(-1, 0), 180);
  near(direction(1, -1), 315);
  near(direction(0, 0), 0);
});
