import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, launch, flightTime, range, impactSpeed, pathY, positionAt, hit, strobeInterval } from "./model.js";

const DT = 1 / 120;
const throwIt = over => {
  const s = launch({ ...initialState(), ...over });
  const samples = [];
  while (step(s, DT) !== "landed") samples.push({ t: s.time, x: s.x, y: s.y });
  return { s, samples };
};
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

test("x = v₀t (uniform) and y = ½gt² (free fall) at every step", () => {
  const { samples } = throwIt({ speed: 12, height: 30 });
  for (const p of samples) {
    near(p.x, 12 * p.t, 1e-9, "x");
    near(p.y, 0.5 * 9.81 * p.t * p.t, 1e-9, "y");
  }
  // equal horizontal gaps in equal times, growing vertical gaps (1 : 3 : 5 …)
  const a = positionAt({ speed: 12, gravity: 9.81 }, 0.5);
  const b = positionAt({ speed: 12, gravity: 9.81 }, 1);
  const c = positionAt({ speed: 12, gravity: 9.81 }, 1.5);
  near(b.x - a.x, c.x - b.x, 1e-12, "Δx");
  near((c.y - b.y) / (b.y - a.y), 5 / 3, 1e-12, "Δy ratio");
});

test("flight time is √(2h/g) whatever v₀", () => {
  for (const height of [5, 20, 45]) {
    for (const speed of [1, 10, 25]) {
      const { s } = throwIt({ speed, height });
      near(s.time, Math.sqrt((2 * height) / 9.81), 1e-9, `h=${height} v₀=${speed}`);
      near(s.time, flightTime(s), 1e-9, "flightTime()");
    }
  }
  const { s } = throwIt({ height: 20, gravity: 1.62 });
  near(s.time, Math.sqrt(40 / 1.62), 1e-9, "Moon");
});

test("range L = v₀√(2h/g) and impact speed √(v₀² + 2gh)", () => {
  for (const [speed, height] of [[10, 20], [3, 45], [25, 2]]) {
    const { s } = throwIt({ speed, height });
    near(s.x, speed * Math.sqrt((2 * height) / 9.81), 1e-9, "range");
    near(s.x, range(s), 1e-9, "range()");
    near(Math.hypot(s.vx, s.vy), impactSpeed(s), 1e-9, "impact speed");
  }
});

test("the dropped ball (v₀ = 0) lands together with the launched one", () => {
  const launched = throwIt({ speed: 18, height: 25 }).s;
  const dropped = throwIt({ speed: 0, height: 25 }).s;
  near(dropped.time, launched.time, 1e-9, "landing time");
  assert.equal(dropped.x, 0);
});

test("trajectory is the parabola y = g·x²/(2v₀²)", () => {
  const { s, samples } = throwIt({ speed: 7, height: 40 });
  for (const p of samples) near(p.y, pathY(s, p.x), 1e-9, `x=${p.x}`);
});

test("target hit within ±1 m, strobe gives at most 12 images", () => {
  const { s } = throwIt({ speed: 10, height: 20, target: 20.6 });
  assert.ok(hit(s));
  assert.ok(!hit({ ...s, target: 22 }));
  for (const height of [2, 20, 45]) assert.ok(flightTime({ height, gravity: 1.62 }) / strobeInterval({ height, gravity: 1.62 }) <= 12);
});

test("initial state is a finished throw that misses the basket", () => {
  const s = initialState();
  assert.equal(s.phase, "landed");
  near(s.time, flightTime(s), 1e-9, "time");
  assert.ok(!hit(s));
});
