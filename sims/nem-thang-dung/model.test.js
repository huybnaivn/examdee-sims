import test from "node:test";
import assert from "node:assert/strict";
import { initialState, velocity, position, topTime, maxHeight, landTime, impactSpeed, at, hitsTarget, TOLERANCE } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const make = over => ({ ...initialState(), ...over });
const CASES = [
  { height: 5, speed: 15, gravity: 9.8 },
  { height: 0, speed: 20, gravity: 10 },
  { height: 20, speed: -8, gravity: 9.8 },
  { height: 12, speed: 0, gravity: 1.6 },
];

test("v = v0 − g·t and y = y0 + v0·t − ½·g·t² without air", () => {
  for (const c of CASES) {
    const s = make(c);
    for (const t of [0, 0.3, 1, 1.7]) {
      near(velocity(s, t), c.speed - c.gravity * t);
      near(position(s, t), c.height + c.speed * t - 0.5 * c.gravity * t * t);
    }
  }
});

test("time to the top is v0/g and the greatest height is y0 + v0²/(2g)", () => {
  const s = make({ height: 5, speed: 15, gravity: 9.8 });
  near(topTime(s), 15 / 9.8);
  near(maxHeight(s), 5 + (15 * 15) / (2 * 9.8));
  near(velocity(s, topTime(s)), 0);
  // textbook numbers: v0 = 20 m/s from the ground, g = 10 m/s²
  const t = make({ height: 0, speed: 20, gravity: 10 });
  near(topTime(t), 2);
  near(maxHeight(t), 20);
  near(landTime(t), 4);
  // thrown downwards: the start is the highest point
  const down = make({ height: 20, speed: -8 });
  assert.equal(topTime(down), 0);
  assert.equal(maxHeight(down), 20);
});

test("landing time is the positive root of the quadratic", () => {
  for (const c of CASES) {
    const s = make(c);
    const t = landTime(s);
    assert.ok(t >= 0);
    near(position(s, t), 0, 1e-9);
    near(t, (c.speed + Math.sqrt(c.speed ** 2 + 2 * c.gravity * c.height)) / c.gravity);
    near(impactSpeed(s), Math.sqrt(c.speed ** 2 + 2 * c.gravity * c.height), 1e-9); // v² = v0² + 2·g·y0
  }
  near(landTime(make({ height: 20, speed: 0, gravity: 10 })), 2); // free fall, t = √(2h/g)
});

test("without air the object passes its launch height again with speed v0", () => {
  const s = make({ height: 5, speed: 15 });
  const back = 2 * topTime(s);
  near(position(s, back), 5);
  near(velocity(s, back), -15);
});

test("air resistance: closed form obeys dv/dt = −g − k·v and dy/dt = v", () => {
  const s = make({ air: true, drag: 0.4 });
  const h = 1e-5;
  for (const t of [0.2, 1, 2.5]) {
    near((velocity(s, t + h) - velocity(s, t - h)) / (2 * h), -s.gravity - s.drag * velocity(s, t), 1e-6);
    near((position(s, t + h) - position(s, t - h)) / (2 * h), velocity(s, t), 1e-6);
  }
  near(velocity(s, 200), -s.gravity / s.drag, 1e-9); // limiting speed g/k
});

test("air resistance lowers the top, shortens the rise and slows the return", () => {
  const ideal = make({ height: 5, speed: 15 });
  const real = make({ height: 5, speed: 15, air: true, drag: 0.3 });
  assert.ok(maxHeight(real) < maxHeight(ideal));
  assert.ok(topTime(real) < topTime(ideal));
  near(velocity(real, topTime(real)), 0);
  near(position(real, landTime(real)), 0, 1e-9);
  assert.ok(impactSpeed(real) < impactSpeed(ideal));
  // back at the launch height the speed is now less than v0
  let lo = topTime(real);
  let hi = landTime(real);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (position(real, mid) > 5) lo = mid;
    else hi = mid;
  }
  assert.ok(Math.abs(velocity(real, lo)) < 15 - 0.5);
  // a tiny k tends to the ideal case
  near(maxHeight(make({ height: 5, speed: 15, air: true, drag: 1e-4 })), maxHeight(ideal), 1e-2);
  // the drag setting is ignored while air is off
  near(maxHeight(make({ height: 5, speed: 15, air: false, drag: 1 })), maxHeight(ideal));
});

test("at() stops on the ground and the initial state is a finished throw", () => {
  const s = initialState();
  assert.equal(s.time, landTime(s));
  const end = at(s, s.time + 5);
  assert.equal(end.y, 0);
  assert.equal(end.landed, true);
  near(Math.abs(end.v), impactSpeed(s));
  assert.equal(at(s, 0).y, s.height);
  // on the ground and not thrown upwards: nothing happens
  for (const air of [false, true]) assert.equal(landTime(make({ height: 0, speed: -3, air })) <= 1e-12, true);
});

test("the target is hit only when the top is within the tolerance", () => {
  const speedFor = (h, y0 = 5, g = 9.8) => Math.sqrt(2 * g * (h - y0));
  assert.equal(hitsTarget(make({ target: 20, speed: speedFor(20) })), true);
  assert.equal(hitsTarget(make({ target: 20, speed: speedFor(20 + TOLERANCE * 0.9) })), true);
  assert.equal(hitsTarget(make({ target: 20, speed: speedFor(20 + TOLERANCE * 1.5) })), false);
  assert.equal(hitsTarget(make({ target: 5, height: 5, speed: -2 })), false); // thrown down: no top to speak of
  assert.equal(hitsTarget(initialState()), false);
});
