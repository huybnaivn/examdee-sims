import test from "node:test";
import assert from "node:assert/strict";
import { initialState, START_ANGLE, kinematics, vectors, laps, step, cut, reattach } from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const make = over => ({ ...initialState(), ...over });
const run = (s, seconds, dt = 1 / 120) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) step(s, dt);
  return s;
};
const CASES = [
  { input: "period", period: 4, radius: 1.5 },
  { input: "period", period: 1, radius: 0.5 },
  { input: "frequency", frequency: 0.25, radius: 2 },
  { input: "speed", speed: 3, radius: 1.2, mass: 2.5 },
];

test("v = ω·r, T = 2π/ω, f = 1/T, a_ht = v²/r = ω²·r, F_ht = m·a_ht for every input mode", () => {
  for (const over of CASES) {
    const s = make(over);
    const k = kinematics(s);
    near(k.speed, k.omega * s.radius);
    near(k.period, (2 * Math.PI) / k.omega);
    near(k.frequency, 1 / k.period);
    near(k.accel, (k.speed * k.speed) / s.radius);
    near(k.accel, k.omega * k.omega * s.radius);
    near(k.force, s.mass * k.accel);
  }
});

test("the chosen input is respected: T, f or v is exactly what was set", () => {
  near(kinematics(make({ input: "period", period: 2.5 })).period, 2.5);
  near(kinematics(make({ input: "frequency", frequency: 0.8 })).frequency, 0.8);
  near(kinematics(make({ input: "speed", speed: 4.2, radius: 0.7 })).speed, 4.2);
  // T = 4 s, r = 1,5 m: v = 2πr/T
  near(kinematics(make({ input: "period", period: 4, radius: 1.5 })).speed, (2 * Math.PI * 1.5) / 4);
  // same speed on half the radius: twice the centripetal acceleration
  near(kinematics(make({ input: "speed", radius: 1 })).accel, 2 * kinematics(make({ input: "speed", radius: 2 })).accel);
});

test("on the circle: |r| stays R, velocity ⟂ radius, |v| constant, acceleration points to the centre", () => {
  for (const over of CASES) {
    const s = make(over);
    const k = kinematics(s);
    for (let i = 0; i < 50; i++) {
      run(s, 0.13);
      const p = vectors(s);
      near(Math.hypot(p.x, p.y), s.radius);
      near(p.x * p.vx + p.y * p.vy, 0); // v ⟂ r
      near(Math.hypot(p.vx, p.vy), k.speed);
      near(Math.hypot(p.ax, p.ay), k.accel);
      near(p.ax * p.y - p.ay * p.x, 0); // a ∥ r …
      assert.ok(p.ax * p.x + p.ay * p.y < 0); // … and towards the centre
      near(p.x * p.vy - p.y * p.vx, s.radius * k.speed); // counter-clockwise
    }
  }
});

test("one period later the object is back where it started and has completed one revolution", () => {
  const s = make({ input: "period", period: 2 });
  const start = vectors(s);
  assert.equal(laps(s), 0);
  run(s, 1.9);
  assert.equal(laps(s), 0);
  run(s, 0.1);
  assert.equal(laps(s), 1);
  near(s.angle - START_ANGLE, 2 * Math.PI, 1e-9);
  near(vectors(s).x, start.x, 1e-9);
  near(vectors(s).y, start.y, 1e-9);
  run(s, 5);
  assert.equal(laps(s), 3);
});

test("after the string is cut: straight line along the tangent, constant speed, no acceleration", () => {
  for (const over of CASES) {
    const s = run(make(over), 0.7);
    const k = kinematics(s);
    const at = vectors(s); // release point and velocity
    cut(s);
    near(vectors(s).x, at.x);
    near(vectors(s).y, at.y);
    for (let i = 1; i <= 20; i++) {
      run(s, 0.1);
      const p = vectors(s);
      const dx = p.x - at.x;
      const dy = p.y - at.y;
      near(dx * at.vy - dy * at.vx, 0); // collinear with the release velocity
      near(Math.hypot(dx, dy), k.speed * 0.1 * i, 1e-9); // uniform
      assert.ok(dx * at.vx + dy * at.vy > 0); // forwards
      near(p.vx, at.vx);
      near(p.vy, at.vy);
      assert.equal(p.ax, 0);
      assert.equal(p.ay, 0);
      near(dx * at.x + dy * at.y, 0); // the tangent is perpendicular to the radius at the release point
    }
    assert.ok(Math.hypot(vectors(s).x, vectors(s).y) > s.radius);
  }
});

test("cutting freezes the angle and the lap count; reattaching resumes the circle", () => {
  const s = run(make({}), 1);
  const angle = s.angle;
  run(cut(s), 3);
  assert.equal(s.angle, angle);
  near(s.flight, 3);
  reattach(s);
  near(Math.hypot(vectors(s).x, vectors(s).y), s.radius);
  run(s, 1);
  assert.ok(s.angle > angle);
});
