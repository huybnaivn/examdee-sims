import test from "node:test";
import assert from "node:assert/strict";
import { initialState, area, perimeter, CHALLENGES, candidates, best, check, MAX_A, MAX_B } from "./model.js";

test("area = a·b and perimeter = 2(a + b), and the area is the number of unit squares", () => {
  for (let a = 1; a <= MAX_A; a++) {
    for (let b = 1; b <= MAX_B; b++) {
      let squares = 0;
      for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) squares++;
      assert.equal(area(a, b), squares);
      assert.equal(perimeter(a, b), a + b + a + b);
    }
  }
  assert.equal(area(8, 3), 24);
  assert.equal(perimeter(8, 3), 22);
});

test("for a fixed area the square, or the nearest whole-number rectangle, has the smallest perimeter", () => {
  for (const S of [12, 16, 24, 36, 48, 60]) {
    const top = best({ area: S, optimize: "minPerimeter" }, 100, 100);
    const others = candidates({ area: S }, 100, 100);
    for (const [a, b] of top) {
      assert.ok(others.every(([x, y]) => perimeter(a, b) <= perimeter(x, y)));
      assert.ok(others.every(([x, y]) => Math.abs(a - b) <= Math.abs(x - y)), "sides as close as possible");
      assert.ok(perimeter(a, b) >= 4 * Math.sqrt(S) - 1e-9, "never below the square's perimeter 4√S");
    }
  }
  assert.deepEqual(best({ area: 36, optimize: "minPerimeter" }), [[6, 6]]);
  assert.deepEqual(best({ area: 24, optimize: "minPerimeter" }), [[4, 6], [6, 4]]);
});

test("for a fixed perimeter the square has the largest area", () => {
  for (const P of [8, 12, 16, 20, 24]) {
    const side = P / 4;
    assert.deepEqual(best({ perimeter: P, optimize: "maxArea" }, 100, 100), [[side, side]]);
    for (const [a, b] of candidates({ perimeter: P }, 100, 100)) assert.ok(area(a, b) <= side * side);
  }
  // odd half-perimeter: no whole-number square, the nearest rectangle wins
  assert.deepEqual(best({ perimeter: 22, optimize: "maxArea" }), [[5, 6], [6, 5]]);
});

test("target checking", () => {
  assert.deepEqual(check("a24", 8, 3), { fixed: true, optimal: false, ok: false });
  assert.deepEqual(check("a24", 5, 4), { fixed: false, optimal: false, ok: false });
  assert.ok(check("a24", 4, 6).ok && check("a24", 6, 4).ok);
  assert.ok(check("a36", 6, 6).ok && !check("a36", 9, 4).ok);
  assert.ok(check("p20", 5, 5).ok && !check("p20", 6, 4).ok && check("p20", 6, 4).fixed);
  assert.ok(check("p22", 6, 5).ok && !check("p22", 7, 4).ok);
  assert.ok(check("a12p16", 2, 6).ok && check("a12p16", 6, 2).ok);
  assert.ok(!check("a12p16", 3, 4).ok && !check("a12p16", 4, 4).ok);
  assert.equal(check("free", 5, 5).ok, false);
  assert.equal(check("nonsense", 5, 5).ok, false);
});

test("every challenge can be met on the grid, and the initial state is not already solved", () => {
  for (const [id, c] of Object.entries(CHALLENGES)) {
    if (id === "free") continue;
    const [a, b] = best(c)[0];
    assert.ok(check(id, a, b).ok, id);
  }
  const s = initialState();
  assert.equal(check(s.challenge, s.a, s.b).ok, false);
  assert.equal(s.met, false);
});
