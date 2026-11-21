import test from "node:test";
import assert from "node:assert/strict";
import { initialState, measure, mesh, project, net, polygonArea, SOLIDS, extent } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const S = (solid, d = {}) => ({ ...initialState(), solid, ...d });
const PI = Math.PI;

test("box: V = a·b·h, Sxq = 2(a + b)·h, Stp = Sxq + 2ab", () => {
  const m = measure(S("box", { a: 6, b: 4, h: 3 }));
  near(m.volume, 72);
  near(m.lateral, 60);
  near(m.total, 108);
});

test("a cube is a box with equal sides: V = a³, Stp = 6a²", () => {
  for (const a of [1, 2.5, 7]) {
    const cube = measure(S("cube", { a }));
    const box = measure(S("box", { a, b: a, h: a }));
    near(cube.volume, a ** 3);
    near(cube.total, 6 * a * a);
    near(cube.lateral, 4 * a * a);
    for (const k of ["volume", "lateral", "total"]) near(cube[k], box[k]);
  }
});

test("right triangular prism: V = S·h, Sxq = C·h (3-4-5 base)", () => {
  const m = measure(S("prism", { a: 3, b: 4, h: 10 }));
  near(m.volume, 60);
  near(m.lateral, 120);
  near(m.total, 132);
});

test("regular square pyramid: V = ⅓a²h, Sxq = p·d with trung đoạn d", () => {
  const m = measure(S("pyramid", { a: 6, h: 4 }));
  near(m.apothem, 5);
  near(m.volume, 48);
  near(m.lateral, 60); // p = 12, d = 5
  near(m.total, 96);
});

test("cylinder: V = πr²h, Sxq = 2πrh, Stp = 2πrh + 2πr²", () => {
  const m = measure(S("cylinder", { r: 2, h: 5 }));
  near(m.volume, 20 * PI);
  near(m.lateral, 20 * PI);
  near(m.total, 28 * PI);
});

test("cone: V = ⅓πr²h is a third of the cylinder; Sxq = πrl", () => {
  for (const [r, h] of [[3, 4], [1, 10], [7.5, 2]]) {
    const cone = measure(S("cone", { r, h }));
    const cyl = measure(S("cylinder", { r, h }));
    near(cone.volume * 3, cyl.volume);
    near(cone.slant, Math.hypot(r, h));
  }
  const m = measure(S("cone", { r: 3, h: 4 }));
  near(m.lateral, 15 * PI);
  near(m.total, 24 * PI);
});

test("sphere: V = 4/3·πR³, S = 4πR²", () => {
  const m = measure(S("sphere", { r: 3 }));
  near(m.volume, 36 * PI);
  near(m.total, 36 * PI);
  // also: the sphere is two thirds of its circumscribed cylinder
  near(m.volume, (2 / 3) * measure(S("cylinder", { r: 3, h: 6 })).volume);
});

test("forged dimensions are clamped into range", () => {
  near(measure(S("cube", { a: -5 })).volume, 1);
  near(measure(S("cube", { a: 1e9 })).volume, 1000);
});

test("box seen from above-right: exactly three hidden (dashed) edges, meeting at the far bottom corner", () => {
  const s = S("box", { a: 6, b: 4, h: 3 });
  const m = mesh(s);
  const { pts, edges } = project(m, 35, 20, 40);
  assert.equal(edges.length, 12);
  const hidden = edges.filter(e => e.hidden);
  assert.equal(hidden.length, 3);
  const far = pts.reduce((best, p, i) => (p[2] < pts[best][2] ? i : best), 0);
  for (const e of hidden) assert.ok(e.i === far || e.j === far);
  assert.ok(m.verts[far][1] < 0); // bottom corner, since we look down on the top
  // face-on: only the front face is seen, so the back face and the four depth edges are hidden
  assert.equal(project(m, 0, 0, 40).edges.filter(e => e.hidden).length, 8);
});

test("every solid's mesh is drawable at any view, curved solids show outline and rims", () => {
  for (const solid of SOLIDS) {
    const s = S(solid);
    const { edges } = project(mesh(s), 35, 20, 4 * extent(s));
    assert.ok(edges.some(e => !e.hidden), solid);
  }
});

test("the net's area equals the total area (curved ones within polygon error)", () => {
  for (const solid of SOLIDS) {
    const s = S(solid, { a: 5, b: 3, h: 4, r: 2 });
    const parts = net(s);
    if (solid === "sphere") {
      assert.equal(parts, null);
      continue;
    }
    const sum = parts.reduce((acc, p) => acc + polygonArea(p.pts), 0);
    const side = parts.filter(p => p.kind === "side").reduce((acc, p) => acc + polygonArea(p.pts), 0);
    const m = measure(s);
    near(sum, m.total, 0.005);
    near(side, m.lateral, 0.005);
  }
});
