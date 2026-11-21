import test from "node:test";
import assert from "node:assert/strict";
import { TUBES, DAYS, TOP3, E0, ironRate, partnerRate, rust, zincLoss, ranking, ranks, predictionCorrect, initialState, step } from "./model.js";

const idx = short => TUBES.findIndex(t => t.short === short);

test("rust needs both water and oxygen", () => {
  assert.equal(rust(idx("Dầu"), DAYS), 0); // water, no oxygen
  assert.equal(rust(idx("Khô"), DAYS), 0); // oxygen, no water
  assert.ok(rust(idx("Nước"), DAYS) > 0); // both
  for (let i = 0; i < TUBES.length; i++) {
    if (!TUBES[i].water || !TUBES[i].oxygen) assert.equal(ironRate(i), 0);
  }
});

test("salt water speeds rusting up", () => {
  assert.ok(rust(idx("Muối"), DAYS) > rust(idx("Nước"), DAYS));
});

test("iron joined to zinc is protected and the zinc corrodes", () => {
  const i = idx("Fe–Zn");
  assert.ok(E0.Zn < E0.Fe); // zinc is more active, so it is the anode
  assert.equal(rust(i, DAYS), 0);
  assert.ok(partnerRate(i) > 0);
  assert.ok(zincLoss(i, DAYS) > 0);
});

test("iron joined to copper rusts faster than iron alone in the same solution", () => {
  assert.ok(E0.Cu > E0.Fe); // copper is less active, iron is the anode
  assert.ok(rust(idx("Fe–Cu"), DAYS) > rust(idx("Muối"), DAYS));
  assert.equal(zincLoss(idx("Fe–Cu"), DAYS), 0);
});

test("a paint coating prevents rusting", () => {
  assert.equal(rust(idx("Sơn"), DAYS), 0);
});

test("ordering of tubes by rate", () => {
  assert.deepEqual(ranking().slice(0, 3), TOP3);
  assert.deepEqual(TOP3, [idx("Fe–Cu"), idx("Muối"), idx("Nước")]);
  const r = ranks();
  assert.deepEqual([r[5], r[3], r[2]], [1, 2, 3]);
  for (const i of [0, 1, 4, 6]) assert.equal(r[i], 4); // the four that do not rust tie
  // rust grows with time and never exceeds the whole surface
  assert.ok(rust(5, 2) < rust(5, 6) && rust(5, 6) < rust(5, DAYS) && rust(5, DAYS) < 1);
});

test("prediction is judged on the top three in order", () => {
  assert.ok(predictionCorrect({ p1: 5, p2: 3, p3: 2 }));
  assert.ok(!predictionCorrect({ p1: 3, p2: 5, p3: 2 }));
  assert.ok(!predictionCorrect(initialState()));
});

test("time stops at the last day, and a forged negative day is clamped", () => {
  const s = { ...initialState(), day: -5 };
  assert.equal(step(s, 0), false);
  assert.equal(s.day, 0);
  let done = false;
  for (let k = 0; k < DAYS * 120 + 10 && !done; k++) done = step(s, 1 / 120);
  assert.ok(done);
  assert.equal(s.day, DAYS);
});
