import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, moments, isBalanced, tiltDirection, G, MAX_TILT } from "./model.js";

const with_ = (m1, d1, m2, d2) => ({ ...initialState(), m1, d1, m2, d2 });
const settle = s => {
  for (let i = 0; i < 120 * 5; i++) step(s, 1 / 120);
  return s;
};

test("moment of each side is M = m·g·d", () => {
  const m = moments(with_(4, 1, 2, 1.5));
  assert.equal(m.left, 4 * G * 1);
  assert.equal(m.right, 2 * G * 1.5);
  assert.equal(m.net, m.right - m.left);
});

test("balance if and only if m1·d1 = m2·d2", () => {
  const masses = [0.5, 1, 2.5, 4, 10];
  const dists = [0.1, 0.15, 0.5, 1, 1.25, 2];
  for (const m1 of masses) for (const d1 of dists) for (const m2 of masses) for (const d2 of dists) {
    const equal = Math.abs(m1 * d1 - m2 * d2) < 1e-9;
    assert.equal(isBalanced(with_(m1, d1, m2, d2)), equal, `${m1}·${d1} vs ${m2}·${d2}`);
  }
  // slider steps that are not exact in binary still balance
  assert.ok(isBalanced(with_(3, 0.1, 1, 0.3)));
  assert.ok(isBalanced(with_(1.5, 0.7, 3, 0.35)));
  // the smallest step away from balance does not
  assert.ok(!isBalanced(with_(10, 2, 10, 1.95)));
});

test("tilt direction follows the sign of the net moment", () => {
  assert.equal(tiltDirection(with_(4, 1, 2, 1.5)), -1); // left moment larger
  assert.equal(tiltDirection(with_(1, 1, 2, 1.5)), 1); // right moment larger
  assert.equal(tiltDirection(with_(4, 1, 2, 2)), 0);
  const left = settle(with_(4, 1, 2, 1.5));
  assert.ok(Math.abs(left.angle + MAX_TILT) < 1e-6);
  const right = settle(with_(1, 1, 2, 1.5));
  assert.ok(Math.abs(right.angle - MAX_TILT) < 1e-6);
  assert.equal(left.balanced, false);
  assert.equal(right.balanced, false);
});

test("a balanced beam settles level and is then reported as balanced", () => {
  const s = with_(4, 1, 2, 2);
  step(s, 1 / 120);
  assert.equal(s.balanced, false); // still swinging back from the tilted start
  settle(s);
  assert.ok(Math.abs(s.angle) < 1e-6);
  assert.equal(s.balanced, true);
  s.d2 = 1.95;
  step(s, 1 / 120);
  assert.equal(s.balanced, false);
});
