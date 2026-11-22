import test from "node:test";
import assert from "node:assert/strict";
import { initialState, runners, position, finishTime, averageSpeed, step, winners, fastest, check, toKmh, toMs } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const run = s => {
  let n = 0;
  while (!s.finished && n++ < 1e6) step(s, 1 / 120);
  return s;
};

test("v = s / t for a runner without a stop", () => {
  const s = { ...initialState(), stop: false, vB: 5, length: 100 };
  const [, b] = runners(s);
  for (const t of [1, 4, 7.5, 19]) near(position(b, s.length, t) / t, 5);
  near(finishTime(b, 100), 20);
  near(position(b, 100, 30), 100); // stays at the finish line
});

test("km/h and m/s: 1 m/s = 3,6 km/h", () => {
  near(toKmh(10), 36);
  near(toMs(72), 20);
  near(toMs(toKmh(7.3)), 7.3);
});

test("the s–t graph is steeper for the faster runner", () => {
  const s = { ...initialState(), stop: false, vA: 8, vB: 5, vC: 6 };
  const slope = r => (position(r, s.length, 3) - position(r, s.length, 1)) / 2;
  const [a, b, c] = runners(s);
  near(slope(a), 8);
  near(slope(b), 5);
  near(slope(c), 6);
  assert.ok(slope(a) > slope(c) && slope(c) > slope(b));
  assert.deepEqual(fastest(s), ["A"]);
});

test("a horizontal segment means standing still", () => {
  const s = initialState(); // A: 8 m/s, stops at 50 m for 4 s
  const [a] = runners(s);
  near(position(a, 100, 6.25), 50);
  near(position(a, 100, 8), 50);
  near(position(a, 100, 10.25), 50);
  near((position(a, 100, 9) - position(a, 100, 7)) / 2, 0);
  near(position(a, 100, 12.25), 66); // moving again at 8 m/s
});

test("who arrives first, and the stopwatch stops when the last runner arrives", () => {
  const s = run({ ...initialState(), time: 0 });
  near(s.time, 20); // B is last: 100 m / 5 m/s
  assert.deepEqual(winners(s), ["A"]); // 16,5 s against C's 16,67 s
  assert.deepEqual(winners({ ...s, stopTime: 5 }), ["C"]); // 17,5 s: now C wins
  assert.deepEqual(winners({ ...s, stop: false, vA: 6 }).sort(), ["A", "C"]); // tie
});

test("average speed over a trip with a stop is total distance over total time", () => {
  const s = initialState();
  const [a] = runners(s);
  near(finishTime(a, 100), 100 / 8 + 4);
  near(averageSpeed(a, 100), 100 / 16.5);
  assert.ok(averageSpeed(a, 100) < s.vA);
  near(averageSpeed(runners({ ...s, stop: false })[0], 100), 8);
});

test("graph-reading questions", () => {
  const s = initialState();
  assert.ok(check({ ...s, question: "fastest", answer: "A" }));
  assert.ok(!check({ ...s, question: "fastest", answer: "C" }));
  assert.ok(check({ ...s, question: "first", answer: "A" }));
  assert.ok(check({ ...s, question: "still", answer: "A" }));
  assert.ok(check({ ...s, stop: false, question: "still", answer: "none" }));
  assert.ok(check({ ...s, question: "speedB", guess: 5 }));
  assert.ok(!check({ ...s, question: "speedB", guess: 5.5 }));
  assert.ok(check({ ...s, question: "avgA", guess: 6.1 })); // 100 / 16,5 = 6,06 m/s
  assert.ok(!check({ ...s, question: "avgA", guess: 8 }));
});
