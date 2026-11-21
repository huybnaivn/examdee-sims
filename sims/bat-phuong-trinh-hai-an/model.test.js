import test from "node:test";
import assert from "node:assert/strict";
import { initialState, inequalities, holds, satisfiesAll, vertices, classify, optimise, regionIn, meet, area } from "./model.js";

const ineq = (a, b, c, sign) => ({ a, b, c, sign });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("point in half-plane for each sign", () => {
  // 2x + y ? 4 at (0, 0): 0 vs 4; at (3, 1): 7 vs 4
  assert.equal(holds(ineq(2, 1, 4, "le"), 0, 0), true);
  assert.equal(holds(ineq(2, 1, 4, "lt"), 0, 0), true);
  assert.equal(holds(ineq(2, 1, 4, "ge"), 0, 0), false);
  assert.equal(holds(ineq(2, 1, 4, "gt"), 0, 0), false);
  assert.equal(holds(ineq(2, 1, 4, "le"), 3, 1), false);
  assert.equal(holds(ineq(2, 1, 4, "ge"), 3, 1), true);
  assert.equal(holds(ineq(2, 1, 4, "gt"), 3, 1), true);
  // a and b of every sign, checked against the definition on a grid
  for (const [a, b, c] of [[1, -3, 2], [-2, 0, 5], [0, -1, -3], [4, 5, 0]]) {
    for (let x = -4; x <= 4; x += 0.5) {
      for (let y = -4; y <= 4; y += 0.5) {
        const v = a * x + b * y;
        assert.equal(holds(ineq(a, b, c, "le"), x, y), v <= c);
        assert.equal(holds(ineq(a, b, c, "lt"), x, y), v < c);
        assert.equal(holds(ineq(a, b, c, "ge"), x, y), v >= c);
        assert.equal(holds(ineq(a, b, c, "gt"), x, y), v > c);
      }
    }
  }
});

test("strict versus non-strict: a point on the boundary line", () => {
  const P = [1, 2]; // x + y = 3
  assert.equal(holds(ineq(1, 1, 3, "le"), ...P), true);
  assert.equal(holds(ineq(1, 1, 3, "ge"), ...P), true);
  assert.equal(holds(ineq(1, 1, 3, "lt"), ...P), false);
  assert.equal(holds(ineq(1, 1, 3, "gt"), ...P), false);
  assert.equal(holds(ineq(1, 1, 3, "lt"), ...P, true), true); // the closed half-plane contains it
});

test("initial system: triangle with vertices (0; 0), (4; 2), (2; 4)", () => {
  const list = inequalities(initialState());
  assert.equal(list.length, 3);
  assert.equal(classify(list), "bounded");
  const v = vertices(list).map(p => [p.x, p.y]).sort((p, q) => p[0] - q[0]);
  assert.deepEqual(v, [[0, 0], [2, 4], [4, 2]]);
  assert.equal(satisfiesAll(list, 2, 2), true); // the initial test point
  near(area(regionIn(list, 8)), 6); // ½·|4·4 − 2·2|
});

test("vertices are pairwise intersections satisfying every inequality", () => {
  const list = [ineq(1, 1, 6, "le"), ineq(1, 0, 0, "ge"), ineq(0, 1, 1, "ge"), ineq(1, -1, 10, "le")];
  const v = vertices(list);
  for (const p of v) {
    assert.equal(satisfiesAll(list, p.x, p.y, true), true);
    // on at least two boundary lines
    assert.ok(list.filter(e => Math.abs(e.a * p.x + e.b * p.y - e.c) < 1e-9).length >= 2);
  }
  // every pairwise intersection that satisfies all is listed, and no other
  const all = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) all.push(meet(list[i], list[j]));
  const good = all.filter(P => P && satisfiesAll(list, ...P, true));
  assert.equal(v.length, new Set(good.map(P => P.join())).size);
  // x − y = 10 meets x + y = 6 at (8; −2), which breaks y ≥ 1, so it is not a vertex
  assert.ok(!v.some(p => p.x === 8 && p.y === -2));
  // a vertex on a strict line is a corner of the region but not one of its points
  const strict = vertices([ineq(1, 0, 0, "gt"), ineq(0, 1, 0, "ge"), ineq(1, 1, 4, "le")]);
  assert.equal(strict.find(p => p.x === 0 && p.y === 0).inside, false);
  assert.equal(strict.find(p => p.x === 4 && p.y === 0).inside, true);
  // three lines through one point give one vertex
  assert.equal(vertices([ineq(1, 0, 0, "ge"), ineq(0, 1, 0, "ge"), ineq(1, 1, 0, "le")]).length, 1);
});

test("empty and unbounded regions are detected", () => {
  assert.equal(classify([ineq(1, 1, 2, "le"), ineq(1, 1, 5, "ge")]), "empty"); // two parallel half-planes apart
  assert.equal(classify([ineq(1, 0, 0, "le"), ineq(1, 0, 0, "gt")]), "empty"); // x ≤ 0 and x > 0
  assert.equal(classify([ineq(1, 0, 0, "le"), ineq(1, 0, 0, "ge")]), "unbounded"); // the line x = 0
  assert.equal(classify([ineq(1, 1, 0, "le"), ineq(1, -1, 0, "le"), ineq(1, 0, 0, "ge")]), "bounded"); // only (0; 0)
  assert.equal(classify([ineq(1, 1, 0, "lt"), ineq(1, -1, 0, "le"), ineq(1, 0, 0, "ge")]), "empty"); // (0; 0) breaks x + y < 0
  assert.equal(classify([ineq(0, 0, -1, "le")]), "empty"); // 0x + 0y ≤ −1
  assert.equal(classify([ineq(0, 0, 1, "le")]), "unbounded"); // the whole plane
  assert.equal(classify([ineq(1, 1, 6, "le")]), "unbounded");
  assert.equal(classify([ineq(1, 0, 0, "ge"), ineq(0, 1, 0, "ge")]), "unbounded");
  assert.equal(classify([ineq(1, 0, 0, "ge"), ineq(0, 1, 0, "ge"), ineq(1, 1, 6, "ge")]), "unbounded");
  assert.equal(classify([ineq(1, 0, 0, "ge"), ineq(0, 1, 0, "ge"), ineq(1, 1, 6, "le")]), "bounded");
  assert.equal(optimise([ineq(1, 0, 0, "ge"), ineq(0, 1, 0, "ge")], 1, 1), null);
  assert.equal(optimise([ineq(1, 1, 2, "le"), ineq(1, 1, 5, "ge")], 1, 1), null);
});

test("max and min of F on a bounded region are reached at vertices", () => {
  const r = optimise(inequalities(initialState()), 1, 2); // F = x + 2y
  assert.deepEqual([r.max.x, r.max.y, r.max.F], [2, 4, 10]);
  assert.deepEqual([r.min.x, r.min.y, r.min.F], [0, 0, 0]);
  // compare with a fine scan of the region for several systems and objectives
  const systems = [
    inequalities(initialState()),
    [ineq(1, 0, 0, "ge"), ineq(0, 1, 0, "ge"), ineq(2, 3, 12, "le")],
    [ineq(1, 1, -2, "ge"), ineq(3, -1, 4, "le"), ineq(-1, 2, 5, "le")],
  ];
  for (const list of systems) {
    for (const [p, q] of [[1, 1], [3, -2], [-1, 4], [0, -1]]) {
      const r = optimise(list, p, q);
      let hi = -Infinity;
      let lo = Infinity;
      for (let x = -10; x <= 10; x += 0.05) {
        for (let y = -10; y <= 10; y += 0.05) {
          if (!satisfiesAll(list, x, y)) continue;
          hi = Math.max(hi, p * x + q * y);
          lo = Math.min(lo, p * x + q * y);
        }
      }
      assert.ok(r.max.F >= hi - 1e-9 && r.max.F - hi < 0.5, `max ${r.max.F} vs scan ${hi}`);
      assert.ok(r.min.F <= lo + 1e-9 && lo - r.min.F < 0.5, `min ${r.min.F} vs scan ${lo}`);
      for (const v of r.values) assert.equal(v.F, p * v.x + q * v.y + 0);
    }
  }
});

test("count is limited to 1..3 inequalities", () => {
  assert.equal(inequalities({ ...initialState(), count: 1 }).length, 1);
  assert.equal(inequalities({ ...initialState(), count: 99 }).length, 3);
  assert.equal(inequalities({ ...initialState(), count: -5 }).length, 1);
});
