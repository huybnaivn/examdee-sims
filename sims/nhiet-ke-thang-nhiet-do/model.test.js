import test from "node:test";
import assert from "node:assert/strict";
import { K_OFFSET, FIXED, SITUATIONS, QUIZ_RANGE, initialState, toF, fromF, toK, fromK, snap, apparent, quizTemp, quizOf, check, shownC } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);

test("°F = 1,8·°C + 32", () => {
  near(toF(0), 32);
  near(toF(100), 212);
  near(toF(37), 98.6);
  near(toF(-40), -40); // the two scales meet at −40
  near(toF(35), 95);
});

test("K = °C + 273 (textbook), exact offset 273,15 documented", () => {
  assert.equal(K_OFFSET, 273);
  near(toK(0), 273);
  near(toK(100), 373);
  near(toK(37), 310);
  near(toK(-273), 0);
  assert.ok(Math.abs(toK(25) - (25 + 273.15)) < 0.2); // differs from the exact value by 0,15 K only
});

test("fixed points: melting ice 0 °C, boiling water 100 °C", () => {
  assert.equal(FIXED.ice, 0);
  assert.equal(FIXED.steam, 100);
  assert.equal(SITUATIONS.ice.c, FIXED.ice);
  assert.equal(SITUATIONS.boil.c, FIXED.steam);
  near(toF(FIXED.steam) - toF(FIXED.ice), 180); // 100 °C span = 180 °F span
  near(toK(FIXED.steam) - toK(FIXED.ice), 100); // and 100 K
});

test("conversions round trip", () => {
  for (let c = -20; c <= 110; c += 0.5) {
    near(fromF(toF(c)), c);
    near(fromK(toK(c)), c);
    near(toK(fromF(toF(c))), toK(c));
  }
});

test("reading to the smallest division", () => {
  assert.equal(snap(23.4), 23);
  assert.equal(snap(23.6), 24);
  assert.equal(snap(36.8, 2), 36);
  assert.equal(snap(37.2, 0.1), 37.2);
  assert.equal(check(23, 23, "level"), "ok");
  assert.equal(check(23.3, 23, "level"), "ok"); // within half a division
  assert.equal(check(24, 23, "level"), "value");
  assert.equal(check(23, 23, "above"), "eye"); // right number but wrong technique
  assert.ok(apparent(23, "above") < 23 && apparent(23, "below") > 23);
  assert.equal(apparent(23, "level"), 23);
});

test("quiz temperatures stay on whole degrees inside the range", () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const t = quizTemp(i / 1000);
    assert.ok(Number.isInteger(t) && t >= QUIZ_RANGE[0] && t <= QUIZ_RANGE[1]);
    seen.add(t);
  }
  assert.equal(seen.size, QUIZ_RANGE[1] - QUIZ_RANGE[0] + 1);
  assert.equal(quizTemp(1), QUIZ_RANGE[1]);
  assert.equal(quizOf({ quizT: 1e9 }), QUIZ_RANGE[1]);
  assert.equal(quizOf({ quizT: 12.7 }), 13);
  assert.equal(shownC({ ...initialState(), tempC: -500 }), -20);
  assert.equal(shownC(initialState()), 37);
});
