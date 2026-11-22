import test from "node:test";
import assert from "node:assert/strict";
import * as m from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

test("interior angle is (n − 2) · 180 / n", () => {
  assert.equal(m.interiorAngle(3), 60);
  assert.equal(m.interiorAngle(4), 90);
  assert.equal(m.interiorAngle(5), 108);
  assert.equal(m.interiorAngle(6), 120);
  assert.equal(m.interiorAngle(8), 135);
  for (let n = 3; n <= 20; n++) near(m.interiorAngle(n) * n, (n - 2) * 180); // angle sum of the polygon
});

test("only n = 3, 4, 6 tile the plane", () => {
  const all = [];
  for (let n = 3; n <= 100; n++) {
    assert.equal(m.tiles(n), Number.isInteger(360 / m.interiorAngle(n)) || Math.abs(360 / m.interiorAngle(n) - Math.round(360 / m.interiorAngle(n))) < 1e-9, `n = ${n}`);
    if (m.tiles(n)) all.push(n);
  }
  assert.deepEqual(all, [3, 4, 6]);
  assert.deepEqual([3, 4, 5, 6].map(m.fitCount), [6, 4, 0, 3]);
  for (const n of all) assert.equal(m.aroundVertex(n, m.fitCount(n)).gap, 0);
});

test("regular pentagons leave a gap or overlap", () => {
  assert.deepEqual(m.aroundVertex(5, 3), { sum: 324, gap: 36 });
  assert.deepEqual(m.aroundVertex(5, 4), { sum: 432, gap: -72 });
  for (let k = 1; k <= 6; k++) assert.notEqual(m.aroundVertex(5, k).gap, 0);
  assert.deepEqual(m.aroundVertex(6, 2), { sum: 240, gap: 120 });
});

test("perimeter is n · a", () => {
  assert.equal(m.perimeter(3, 4), 12);
  assert.equal(m.perimeter(4, 4), 16);
  assert.equal(m.perimeter(6, 4), 24);
  for (const n of m.BUILD) for (let a = m.A_MIN; a <= m.A_MAX; a++) {
    const p = m.construction(n, a).polygon;
    near(p.reduce((sum, q, i) => sum + dist(q, p[(i + 1) % n]), 0), m.perimeter(n, a));
  }
});

test("areas: a²√3/4, a², and hexagon = 6 × triangle", () => {
  near(m.area(3, 4), (16 * Math.sqrt(3)) / 4);
  near(m.area(4, 5), 25);
  near(m.area(3, 2), (2 * m.triangleHeight(2)) / 2); // base × height : 2
  for (let a = m.A_MIN; a <= m.A_MAX; a++) {
    near(m.area(6, a), 6 * m.area(3, a));
    near(m.area(6, a), (3 * Math.sqrt(3) * a * a) / 2);
    // shoelace area of the constructed polygon
    for (const n of m.BUILD) {
      const p = m.construction(n, a).polygon;
      near(p.reduce((sum, q, i) => sum + (q[0] * p[(i + 1) % n][1] - p[(i + 1) % n][0] * q[1]) / 2, 0), m.area(n, a));
    }
  }
});

test("the rounded numbers shown on screen can be recomputed by hand", () => {
  const r = (v, d) => Math.round(v * 10 ** d + 1e-9) / 10 ** d;
  for (let a = m.A_MIN; a <= m.A_MAX; a++) {
    // triangle: a × h : 2 with h shown to 3 decimals, result to 2
    assert.equal(r((a * r(m.triangleHeight(a), 3)) / 2, 2), r(m.area(3, a), 2), `triangle ${a}`);
    // hexagon: 6 × triangle area shown to 3 decimals, result to 2
    assert.equal(r(6 * r(m.area(3, a), 3), 2), r(m.area(6, a), 2), `hexagon ${a}`);
  }
});

test("constructions end on the regular polygon", () => {
  for (const n of m.BUILD) {
    const a = 4;
    const c = m.construction(n, a);
    assert.equal(c.steps.length, m.STEPS);
    assert.equal(c.polygon.length, n);
    c.polygon.forEach((p, i) => {
      const q = c.polygon[(i + 1) % n];
      const o = c.polygon[(i + n - 1) % n];
      near(dist(p, q), a);
      const angle = (Math.acos(((q[0] - p[0]) * (o[0] - p[0]) + (q[1] - p[1]) * (o[1] - p[1])) / (a * a)) * 180) / Math.PI;
      near(angle, m.interiorAngle(n), 1e-6);
    });
    // every compass arc has radius a and passes through a corner of the polygon within its sweep
    for (const { arc } of c.steps.flat().filter(it => it.arc)) {
      assert.equal(arc[1], a);
      assert.ok(c.polygon.some(p => Math.abs(dist(p, arc[0]) - a) < 1e-9));
    }
    // every named point other than the centre is a corner, and appears no later than the last step
    for (const [name, p, from] of c.points) {
      assert.ok(from >= 0 && from <= m.STEPS - 1);
      if (name !== "O") assert.ok(c.polygon.some(q => dist(p, q) < 1e-9), name);
    }
  }
  const hex = m.construction(6, 3);
  for (const p of hex.polygon) near(Math.hypot(...p), 3); // corners on the circle of radius a
  // six equilateral triangles: centre, corner, next corner
  hex.polygon.forEach((p, i) => near(dist(p, hex.polygon[(i + 1) % 6]), 3));
});

test("polygons placed around a point fill exactly the sum of their angles", () => {
  for (const n of m.TILES) {
    const p = m.polygonAt(n, 1, [2, 3], 30);
    assert.equal(p.length, n);
    near(dist(p[n - 1], p[0]), 1); // closes with a side of the same length
    const last = (Math.atan2(p[n - 1][1] - 3, p[n - 1][0] - 2) * 180) / Math.PI;
    near(last - 30, m.interiorAngle(n), 1e-6); // the corner at the point spans the interior angle
  }
});

test("drawing progress, clamping and the tiling answer", () => {
  const s = m.initialState();
  assert.equal(m.advance(s, 0.1), false); // a finished drawing starts again
  assert.ok(s.progress > 0 && s.progress < 0.1);
  let done = 0;
  for (let i = 0; i < 2000 && !done; i++) done += m.advance(s, 1 / 120);
  assert.equal(done, 1);
  assert.equal(s.progress, m.STEPS);
  assert.deepEqual(m.shape({ n: 5, a: 99 }), { n: 6, a: m.A_MAX });
  assert.deepEqual(m.shape({ n: 3, a: NaN }), { n: 3, a: m.A_MIN });
  assert.deepEqual(m.tileOf({ tile: 7, around: -3 }), { n: 6, k: 1 });
  assert.equal(m.identified(m.initialState()), false);
  assert.equal(m.identified({ pick3: true, pick4: true, pick5: false, pick6: true }), true);
  assert.equal(m.identified({ pick3: true, pick4: true, pick5: true, pick6: true }), false);
  assert.equal(m.identified({ pick3: true, pick4: true, pick5: false, pick6: false }), false);
});
