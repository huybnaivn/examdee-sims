import test from "node:test";
import assert from "node:assert/strict";
import { initialState, vertices, shoelace, formulaArea, rectWidth, heightToBase, apex, pieces, cellCoverage } from "./model.js";

const close = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const make = (shape, a, h, s, b = 3) => ({ ...initialState(), shape, a, h, s, b });
const CASES = [];
for (const shape of ["parallelogram", "triangle", "trapezoid"])
  for (const [a, h, s, b] of [[6, 4, 2, 3], [5, 3, -3, 2], [4, 5, 7, 6], [1, 1, 0, 1], [8, 6, 8, 1]]) CASES.push(make(shape, a, h, s, b));

test("textbook formulas: S = a × h, S = a × h : 2, S = (a + b) × h : 2", () => {
  assert.equal(formulaArea(make("parallelogram", 6, 4, 2)), 24);
  assert.equal(formulaArea(make("triangle", 6, 4, 2)), 12);
  assert.equal(formulaArea(make("triangle", 5, 3, 1)), 7.5);
  assert.equal(formulaArea(make("trapezoid", 6, 4, 2, 3)), 18);
});

test("shoelace area of the drawn vertices equals the formula", () => {
  for (const st of CASES) close(shoelace(vertices(st)), formulaArea(st));
});

test("cutting and rearranging keeps the area at every moment and ends in the a × h rectangle", () => {
  for (const st of CASES) {
    const twice = st.shape === "parallelogram" ? 1 : 2; // triangle and trapezoid are doubled by the copy
    for (const t of [0.3, 0.5, 0.75, 1]) {
      const ps = pieces(st, t);
      const total = ps.reduce((sum, p) => sum + shoelace(p.pts), 0);
      const copies = ps.some(p => p.kind === "copy") ? twice : 1;
      close(total, formulaArea(st) * copies);
    }
    // at the end every piece lies inside [0, L] × [0, h] and together they fill it
    const L = rectWidth(st);
    const end = pieces(st, 1);
    for (const p of end) for (const [x, y] of p.pts) assert.ok(x > -1e-9 && x < L + 1e-9 && y > -1e-9 && y < st.h + 1e-9);
    close(end.reduce((sum, p) => sum + shoelace(p.pts), 0), L * st.h);
    close(L * st.h, formulaArea(st) * twice);
  }
});

test("the half-turned copy of a triangle or trapezoid is congruent and forms a parallelogram", () => {
  for (const st of CASES.filter(c => c.shape !== "parallelogram")) {
    const copy = pieces(st, 0.5).find(p => p.kind === "copy").pts;
    close(shoelace(copy), formulaArea(st));
    // the copy's A lands on the far top corner: (L + s, h)
    const A2 = copy[0];
    close(A2[0], rectWidth(st) + st.s);
    close(A2[1], st.h);
  }
});

test("the height is measured perpendicular to the base, also when its foot falls outside", () => {
  const out = heightToBase([-3, 4], [0, 0], [6, 0]);
  assert.equal(out.height, 4);
  assert.deepEqual(out.foot, [-3, 0]);
  assert.equal(out.inside, false);
  assert.equal(heightToBase([3, 4], [0, 0], [6, 0]).inside, true);
  // a tilted base: A(0,0), B(4,3); P = (−3, 4) is 5 away along the normal and its foot is A itself
  const tilted = heightToBase([-3, 4], [0, 0], [4, 3]);
  close(tilted.height, 5);
  close(tilted.foot[0], 0);
  close(tilted.foot[1], 0);
  // the apex of every case is exactly h above the base, so area = base × height (÷ 2) holds
  for (const st of CASES) close(heightToBase(apex(st), [0, 0], [st.a, 0]).height, st.h);
  // an obtuse triangle: the foot of the height from C lies beyond B
  const obtuse = make("triangle", 4, 3, 7);
  assert.equal(heightToBase(apex(obtuse), [0, 0], [4, 0]).inside, false);
  close(shoelace(vertices(obtuse)), (4 * 3) / 2);
});

test("degenerate shapes have zero area", () => {
  for (const shape of ["parallelogram", "triangle", "trapezoid"]) {
    const flat = make(shape, 5, 0, 2);
    assert.equal(formulaArea(flat), 0);
    close(shoelace(vertices(flat)), 0);
    close(pieces(flat, 1).reduce((sum, p) => sum + shoelace(p.pts), 0), 0);
    assert.equal(cellCoverage(vertices(flat)).sum, 0);
  }
});

test("counting unit squares: whole squares plus the cut parts add up to the area", () => {
  for (const st of CASES) {
    const c = cellCoverage(vertices(st));
    close(c.sum, formulaArea(st));
    assert.ok(c.full <= formulaArea(st) && formulaArea(st) <= c.full + c.partial);
  }
  // a parallelogram rearranged into a 6 × 4 rectangle covers exactly 24 whole squares
  const rect = cellCoverage([[0, 0], [6, 0], [6, 4], [0, 4]]);
  assert.equal(rect.full, 24);
  assert.equal(rect.partial, 0);
});
