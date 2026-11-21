import test from "node:test";
import assert from "node:assert/strict";
import { initialState, validBase, power, log, increasing, nearestX, X_MIN, X_MAX } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const bases = [];
for (let a = 0.1; a <= 5.0001; a += 0.1) bases.push(Math.round(a * 10) / 10);
const valid = bases.filter(a => a !== 1);

test("log_a(aˣ) = x and a^(log_a t) = t", () => {
  near(log(2, 8), 3);
  near(log(10, 1000), 3);
  near(log(0.5, 4), -2);
  near(power(2, 1.5), 2 * Math.SQRT2);
  for (const a of valid) {
    for (let x = X_MIN; x <= X_MAX; x += 0.25) near(log(a, power(a, x)), x, 1e-9);
    for (const t of [0.01, 0.5, 1, 2, 7.5, 100]) near(power(a, log(a, t)), t, 1e-9 * Math.max(1, t));
  }
});

test("fixed points (0; 1) and (1; 0) for every base", () => {
  for (const a of valid) {
    assert.equal(power(a, 0), 1);
    assert.equal(log(a, 1), 0);
    near(log(a, a), 1);
  }
});

test("product, quotient and power rules", () => {
  for (const a of valid)
    for (const [b, c] of [[2, 3], [0.4, 9], [5, 0.2], [1.5, 1.5]]) {
      near(log(a, b * c), log(a, b) + log(a, c), 1e-9);
      near(log(a, b / c), log(a, b) - log(a, c), 1e-9);
      near(log(a, b ** 3), 3 * log(a, b), 1e-9);
    }
});

test("change of base: log_a b = log_c b / log_c a", () => {
  for (const a of valid)
    for (const c of [2, 10, Math.E, 0.3])
      for (const b of [0.2, 3, 50]) near(log(a, b), log(c, b) / log(c, a), 1e-9);
  near(log(4, 8), 1.5);
});

test("increasing iff a > 1, decreasing iff 0 < a < 1", () => {
  for (const a of valid) {
    assert.equal(increasing(a), a > 1);
    const up = power(a, 1) > power(a, 0);
    assert.equal(up, a > 1, `aˣ at a = ${a}`);
    assert.equal(log(a, 3) > log(a, 2), a > 1, `log at a = ${a}`);
  }
});

test("invalid bases (a ≤ 0 or a = 1) are rejected without NaN", () => {
  for (const a of [0, -1, -0.5, 1, NaN, Infinity]) {
    assert.equal(validBase(a), false);
    assert.equal(power(a, 2), null);
    assert.equal(log(a, 2), null);
    assert.equal(increasing(a), null);
    assert.equal(nearestX(a, 1, 1), null);
  }
});

test("log of a non-positive number is undefined (null), never NaN or ±∞", () => {
  for (const a of valid)
    for (const t of [0, -0, -1, -100, NaN]) assert.equal(log(a, t), null);
  for (const a of valid) for (let t = 0.05; t < 20; t += 0.35) assert.ok(Number.isFinite(log(a, t)));
});

test("drag: the point follows the pointer on the curve, mirrored point by swapping axes", () => {
  // on the curve, either candidate gives the same x₀
  near(nearestX(2, 1.5, 2 ** 1.5), 1.5);
  // steep part: a pointer above the curve is matched by ordinate
  near(nearestX(3, 1.9, 9), 2);
  // dragging M' at (8; 3) on log₂ is M at (3; 8)
  near(nearestX(2, 3, 8), 3);
  // pointer left of Oy with v ≤ 0 still gives a finite, clamped x₀
  assert.equal(nearestX(2, -10, -1), X_MIN);
  assert.equal(nearestX(0.5, 99, -5), X_MAX);
  for (const a of valid) for (let u = -6; u <= 8; u += 0.7) for (let v = -4; v <= 8; v += 0.9) {
    const x = nearestX(a, u, v);
    assert.ok(x >= X_MIN && x <= X_MAX);
  }
});

test("initial state is a valid, increasing case", () => {
  const s = initialState();
  assert.equal(validBase(s.a), true);
  assert.equal(increasing(s.a), true);
  near(log(s.a, power(s.a, s.x)), s.x);
});
