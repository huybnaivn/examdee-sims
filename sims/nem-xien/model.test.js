import test from "node:test";
import assert from "node:assert/strict";
import { initialState, fly, ideal, trajectory, launch, step, DT } from "./model.js";

const shot = params => fly({ ...initialState(), ...params });
const close = (actual, expected, rel = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= rel * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

test("range, max height and flight time match the formulas without drag", () => {
  for (const params of [
    { speed: 18, angle: 50, height: 0, gravity: 9.81 },
    { speed: 30, angle: 15, height: 20, gravity: 9.81 },
    { speed: 7, angle: 80, height: 3.5, gravity: 1.62 },
    { speed: 12, angle: 0, height: 10, gravity: 24.79 },
    { speed: 25, angle: 90, height: 0, gravity: 3.71 },
  ]) {
    const s = shot(params);
    const expected = ideal(s);
    close(s.x, expected.range);
    close(s.maxHeight, expected.maxHeight);
    close(s.time, expected.flightTime);
    assert.equal(s.y, 0);
  }
});

test("from the ground: L = v²·sin2α/g, H = v²·sin²α/(2g), t = 2v·sinα/g", () => {
  const s = shot({ speed: 20, angle: 30 });
  close(s.x, (400 * Math.sin(Math.PI / 3)) / 9.81);
  close(s.maxHeight, (400 * 0.25) / (2 * 9.81));
  close(s.time, (2 * 20 * 0.5) / 9.81);
});

test("45° gives the longest range from ground level", () => {
  const best = shot({ angle: 45 }).x;
  for (let angle = 0; angle <= 90; angle++) {
    if (angle !== 45) assert.ok(shot({ angle }).x < best, `angle ${angle}`);
  }
});

test("complementary angles give equal range, the steeper one flies higher", () => {
  for (const angle of [10, 20, 30, 40]) {
    const low = shot({ angle });
    const high = shot({ angle: 90 - angle });
    close(low.x, high.x);
    assert.ok(high.maxHeight > low.maxHeight);
  }
});

test("air drag shortens range and height, and slows the projectile", () => {
  const free = shot({});
  const dragged = shot({ drag: true });
  assert.ok(dragged.x < free.x * 0.9);
  assert.ok(dragged.maxHeight < free.maxHeight);
  assert.ok(Math.hypot(dragged.vx, dragged.vy) < Math.hypot(free.vx, free.vy));
});

test("the drawn trajectory ends where the projectile is", () => {
  const s = launch({ ...initialState(), drag: true, height: 5 });
  for (let i = 0; i < 100; i++) step(s, DT);
  const points = trajectory(s, s.time);
  assert.deepEqual(points.at(-1), [s.x, s.y]);
  const landed = fly({ ...s });
  assert.deepEqual(trajectory(landed, landed.time).at(-1), [landed.x, 0]);
});
