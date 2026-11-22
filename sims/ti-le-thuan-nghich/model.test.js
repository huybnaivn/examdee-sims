import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS, SCENARIO_KEYS, initialState, classify, table, missing, answerOf, graphKind, situationType, DIRECT, INVERSE, NEITHER, UNKNOWN } from "./model.js";

const xsets = [[1, 2, 4, 5], [3, 6, 9, 12], [1, 7, 11, 12], [2, 2, 5, 10]];

test("k = y/x is constant for a direct proportion", () => {
  for (const key of ["gia-tien", "quang-duong"]) {
    for (const [x1, x2, x3, x4] of xsets) {
      const t = table({ ...initialState(), scenario: key, x1, x2, x3, x4 });
      assert.equal(t.type, DIRECT);
      for (const r of t.ratio) assert.equal(r, t.constant);
    }
  }
  assert.equal(situationType("gia-tien").constant, 8);
  assert.equal(situationType("quang-duong").constant, 12);
});

test("a = x·y is constant for an inverse proportion", () => {
  for (const [x1, x2, x3, x4] of xsets) {
    const t = table({ ...initialState(), scenario: "cong-nhan", x1, x2, x3, x4 });
    assert.equal(t.type, INVERSE);
    for (const p of t.product) assert.ok(Math.abs(p - 60) < 1e-9);
  }
});

test("classification: direct, inverse, neither, not enough data", () => {
  assert.deepEqual(classify([1, 2, 3], [5, 10, 15]), { type: DIRECT, constant: 5 });
  assert.deepEqual(classify([1, 2, 4], [8, 4, 2]), { type: INVERSE, constant: 8 });
  assert.equal(classify([1, 2, 3], [3, 5, 7]).type, NEITHER);
  assert.equal(classify([2, 2, 2], [4, 4, 4]).type, UNKNOWN);
  for (const [x1, x2, x3, x4] of xsets) assert.equal(table({ ...initialState(), scenario: "taxi", x1, x2, x3, x4 }).type, NEITHER);
  // with only two distinct x, y = 12x + 10 is still neither (22/1 ≠ 34/2 and 22 ≠ 68)
  assert.equal(classify([1, 2], [22, 34]).type, NEITHER);
});

test("missing value from one known pair", () => {
  assert.equal(missing(DIRECT, 3, 24, 15), 120);
  assert.equal(missing(INVERSE, 4, 15, 20), 3);
  assert.ok(Number.isNaN(missing(NEITHER, 1, 2, 3)));
  for (const key of SCENARIO_KEYS) {
    const sc = SCENARIOS[key];
    assert.ok(Math.abs(answerOf(key) - sc.f(sc.ask)) < 1e-9, key);
    assert.ok(Number.isInteger(answerOf(key)) && answerOf(key) <= 200, key); // reachable on the slider
    assert.ok(sc.ask > 12, key); // not readable from the table
  }
});

test("graph type follows the proportion", () => {
  assert.equal(graphKind("gia-tien"), "line-origin");
  assert.equal(graphKind("quang-duong"), "line-origin");
  assert.equal(graphKind("cong-nhan"), "hyperbola");
  assert.equal(graphKind("taxi"), "line");
  // a line through the origin passes through (0, 0); the taxi line does not
  assert.equal(SCENARIOS["gia-tien"].f(0), 0);
  assert.notEqual(SCENARIOS.taxi.f(0), 0);
});
