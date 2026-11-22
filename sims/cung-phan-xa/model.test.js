import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPONENTS, PATHS, checkOrder, pathLength, conductionTime, totalTime, centralDelay, signalAt, stageTime,
  rulerDistance, rulerTime, readRuler, stats, classifyTap, initialState, startTrial, tap, timeout, waitFor, RULER, G, MIN_RT,
} from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("the arc runs receptor → afferent neuron → CNS → efferent neuron → effector", () => {
  assert.deepEqual(COMPONENTS, ["receptor", "afferent", "centre", "efferent", "effector"]);
  assert.ok(checkOrder(["receptor", "afferent", "centre", "efferent", "effector"]));
  assert.ok(!checkOrder(["receptor", "efferent", "centre", "afferent", "effector"]));
  assert.ok(!checkOrder(["receptor", "afferent", "centre", "efferent"]));
  const s = initialState();
  assert.ok(!checkOrder([s.o1, s.o2, s.o3, s.o4, s.o5]), "the starting order must be wrong");
  // both paths pass the components in that order
  for (const kind of Object.keys(PATHS)) {
    const parts = PATHS[kind].map(st => st.part).filter((p, i, a) => p !== a[i - 1]);
    assert.deepEqual(parts, ["afferent", "centre", "efferent"], kind);
  }
});

test("signal time = path length / speed (+ time in the CNS)", () => {
  assert.equal(pathLength("spinal"), 1.5);
  close(pathLength("conscious"), 2.5);
  for (const v of [1, 10, 60, 120]) {
    close(conductionTime("spinal", v), 1.5 / v);
    close(totalTime("spinal", v), 1.5 / v + centralDelay("spinal"));
    close(totalTime("conscious", v), 2.5 / v + 0.15);
  }
  close(totalTime("spinal", 60), 0.027); // 25 ms conduction + 2 ms synapses
  assert.ok(totalTime("spinal", 60) < totalTime("conscious", 60) / 5, "the spinal reflex is much faster");
});

test("the impulse position follows t = s / v", () => {
  const v = 60;
  assert.deepEqual(signalAt("spinal", v, 0), { index: 0, frac: 0, done: false });
  const half = signalAt("spinal", v, 0.45 / v); // half of the 0,9 m afferent fibre
  assert.equal(half.index, 0);
  close(half.frac, 0.5);
  assert.equal(signalAt("spinal", v, 0.9 / v + 0.001).index, 1);
  assert.equal(signalAt("spinal", v, 1).done, true);
  close(stageTime(PATHS.conscious[2], 1), 0.15);
});

test("ruler drop: d = g t² / 2 and t = √(2d/g)", () => {
  close(rulerDistance(0.2), (G * 0.04) / 2);
  close(rulerTime(0.2), Math.sqrt(0.4 / G));
  for (const t of [0.1, 0.17, 0.25, 0.3]) close(rulerTime(rulerDistance(t)), t);
  close(rulerTime(0.196), 0.19990, 1e-4); // 19,6 cm ≈ 0,2 s
  assert.equal(readRuler(0.19637), 0.196);
  assert.equal(rulerTime(-1), 0);
});

test("mean and sample standard deviation of trials", () => {
  assert.deepEqual(stats([]), { n: 0, mean: 0, sd: 0 });
  assert.deepEqual(stats([250]), { n: 1, mean: 250, sd: 0 });
  const r = stats([200, 220, 240, 260, 280]);
  assert.equal(r.mean, 240);
  close(r.sd, Math.sqrt(4000 / 4));
  close(stats([2, 4, 4, 4, 5, 5, 7, 9]).sd, Math.sqrt(32 / 7));
});

test("early taps are rejected as false starts", () => {
  assert.equal(classifyTap("waiting", 0), "false-start");
  assert.equal(classifyTap("go", MIN_RT - 1), "false-start");
  assert.equal(classifyTap("go", 250), "valid");
  assert.equal(classifyTap("idle", 250), "ignore");
  const s = initialState();
  s.part = "game";
  startTrial(s);
  assert.equal(s.phase, "waiting");
  assert.equal(tap(s, 0), "false-start");
  assert.equal(s.falseStarts, 1);
  assert.deepEqual(s.trials, []);
});

test("a set of trials", () => {
  const s = { ...initialState(), setSize: 3 };
  for (const rt of [210, 250, 290]) {
    startTrial(s);
    assert.ok(s.waitUntil >= 1.5 && s.waitUntil <= 4);
    s.phase = "go";
    assert.equal(tap(s, rt), "valid");
  }
  assert.equal(s.phase, "set");
  assert.deepEqual(s.trials, [210, 250, 290]);
  startTrial(s); // a new set starts empty
  assert.deepEqual(s.trials, []);
  assert.equal(waitFor(5), waitFor(5));
});

test("ruler mode records the time computed from the reading, and misses past the end", () => {
  const s = { ...initialState(), mode: "ruler" };
  startTrial(s);
  s.phase = "go";
  tap(s, 200);
  assert.equal(s.lastDistance, readRuler(rulerDistance(0.2)));
  close(s.lastRt, rulerTime(s.lastDistance) * 1000);
  assert.ok(Math.abs(s.lastRt - 200) < 1); // rounding the reading to 1 mm changes t by < 1 ms here
  startTrial(s);
  s.phase = "go";
  assert.equal(timeout(s, rulerTime(RULER) * 1000 - 1), false);
  assert.equal(timeout(s, rulerTime(RULER) * 1000 + 1), true);
  assert.equal(s.phase, "missed");
});
