import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, segment, equationKind } from "./model.js";

const sys = (a1, b1, c1, a2, b2, c2) => ({ a1, b1, c1, a2, b2, c2 });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("Cramer's rule: x = Dx/D, y = Dy/D, and the solution satisfies both equations", () => {
  const r = solve(initialState()); // 2x + y = 4, x − y = −1
  assert.equal(r.kind, "unique");
  assert.deepEqual([r.D, r.Dx, r.Dy, r.x, r.y], [-3, -3, -6, 1, 2]);
  for (let a1 = -4; a1 <= 4; a1++) {
    for (let b1 = -4; b1 <= 4; b1++) {
      for (const [c1, a2, b2, c2] of [[3, 2, -5, 7], [-6, 1, 1, 0], [0, -3, 4, 9]]) {
        const s = sys(a1, b1, c1, a2, b2, c2);
        const r = solve(s);
        assert.equal(r.kind === "unique", a1 * b2 - a2 * b1 !== 0);
        if (r.kind !== "unique") continue;
        near(a1 * r.x + b1 * r.y, c1);
        near(a2 * r.x + b2 * r.y, c2);
      }
    }
  }
});

test("parallel lines: D = 0 but Dx or Dy ≠ 0, no solution", () => {
  for (const s of [sys(1, 2, 3, 2, 4, 5), sys(1, -1, 0, -3, 3, 1), sys(2, 0, 4, 1, 0, 3), sys(0, 3, 6, 0, -1, 5)]) {
    const r = solve(s);
    assert.equal(r.kind, "none");
    assert.equal(r.D, 0);
    assert.ok(r.Dx !== 0 || r.Dy !== 0);
    assert.equal(r.degenerate, false);
  }
});

test("coincident lines: D = Dx = Dy = 0, infinitely many solutions", () => {
  for (const s of [sys(1, 2, 3, 2, 4, 6), sys(1, -1, 0, -3, 3, 0), sys(2, 0, 4, 1, 0, 2), sys(0, 3, 6, 0, -1, -2), sys(2, 1, 4, 2, 1, 4)]) {
    const r = solve(s);
    assert.equal(r.kind, "infinite");
    assert.deepEqual([r.D, r.Dx, r.Dy], [0, 0, 0]);
    assert.equal(r.degenerate, false);
  }
});

test("vertical and horizontal lines (b = 0 or a = 0)", () => {
  let r = solve(sys(1, 0, 3, 0, 1, -2)); // x = 3, y = −2
  assert.deepEqual([r.kind, r.x, r.y], ["unique", 3, -2]);
  r = solve(sys(0, 2, 8, 3, 0, -6)); // y = 4, x = −2
  assert.deepEqual([r.kind, r.x, r.y], ["unique", -2, 4]);
  r = solve(sys(2, 0, 4, 1, 1, 5)); // x = 2 and x + y = 5
  assert.deepEqual([r.kind, r.x, r.y], ["unique", 2, 3]);
  assert.deepEqual(segment(1, 0, 3, 10), [[3, -10], [3, 10]]);
  assert.deepEqual(segment(0, 1, -2, 10), [[-10, -2], [10, -2]]);
});

test("degenerate equation 0x + 0y = c never crashes and is judged on its own", () => {
  assert.equal(equationKind(0, 0, 0), "all");
  assert.equal(equationKind(0, 0, 5), "empty");
  assert.equal(equationKind(0, 3, 5), "line");
  const cases = [
    [sys(0, 0, 5, 1, 1, 2), "none"], // 0 = 5 is impossible
    [sys(1, 1, 2, 0, 0, -1), "none"],
    [sys(0, 0, 0, 1, 1, 2), "infinite"], // 0 = 0 always holds, the other line remains
    [sys(1, 1, 2, 0, 0, 0), "infinite"],
    [sys(0, 0, 0, 0, 0, 0), "infinite"],
    [sys(0, 0, 1, 0, 0, 2), "none"], // all determinants are 0, still no solution
    [sys(0, 0, 0, 0, 0, 3), "none"],
  ];
  for (const [s, kind] of cases) {
    const r = solve(s);
    assert.equal(r.kind, kind);
    assert.equal(r.degenerate, true);
    assert.ok(!("x" in r));
  }
  assert.equal(segment(0, 0, 5, 10), null);
  assert.equal(segment(0, 0, 0, 10), null);
});

test("segment endpoints lie on the line and inside the window; far lines are skipped", () => {
  for (const [a, b, c] of [[2, 1, 4], [1, -1, -1], [3, 7, -20], [-5, 2, 0], [1, 1, 19], [1, 1, -19]]) {
    const seg = segment(a, b, c, 10);
    assert.ok(seg);
    for (const [x, y] of seg) {
      near(a * x + b * y, c);
      assert.ok(Math.abs(x) <= 10 + 1e-9 && Math.abs(y) <= 10 + 1e-9);
    }
  }
  assert.equal(segment(1, 1, 30, 10), null);
  assert.equal(segment(1, 1, 20, 10), null); // only touches a corner
  assert.equal(segment(1, 0, 11, 10), null);
});
