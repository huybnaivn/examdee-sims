import test from "node:test";
import assert from "node:assert/strict";
import { W, H, initialState, measure, specialType, describe, roundedAngles, equilateralApexes, sideSquares } from "./model.js";

const tri = (ax, ay, bx, by, cx, cy) => ({ ...initialState(), ax, ay, bx, by, cx, cy });
const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const sum = list => list.reduce((p, q) => p + q, 0);

// A spread of ordinary triangles on the half-unit grid the sim snaps to.
const samples = [];
for (let k = 0; k < 400; k++) {
  const r = n => ((k * 7919 + n * 104729) % 29) / 2;
  const s = tri(r(1) % (W + 0.5), r(2) % (H + 0.5), r(3) % (W + 0.5), r(4) % (H + 0.5), r(5) % (W + 0.5), r(6) % (H + 0.5));
  if (!measure(s).degenerate) samples.push(s);
}

test("the three angles add up to 180°", () => {
  assert.ok(samples.length > 100);
  for (const s of samples) near(sum(measure(s).angles), 180, 1e-9);
});

test("the rounded angles shown on screen also add up to exactly 180", () => {
  for (const s of samples) {
    const m = measure(s);
    const shown = roundedAngles(m.angles);
    assert.equal(Math.round(sum(shown) * 10), 1800);
    shown.forEach((a, i) => assert.ok(Math.abs(a - m.angles[i]) <= 0.1 + 1e-9));
  }
  assert.deepEqual(roundedAngles(measure(initialState()).angles), [90, 36.9, 53.1]);
  assert.deepEqual(roundedAngles([60, 60, 60]), [60, 60, 60]);
});

test("shoelace area equals ½ · base · height for each of the three sides", () => {
  for (const s of samples) {
    const m = measure(s);
    for (let i = 0; i < 3; i++) {
      near(m.area, (m.sides[i] * m.heights[i]) / 2, 1e-9);
      // the height is really the distance from the vertex to the foot of its altitude
      near(Math.hypot(m.points[i][0] - m.feet[i][0], m.points[i][1] - m.feet[i][1]), m.heights[i], 1e-9);
    }
    // Heron's formula as an independent check
    const p = m.perimeter / 2;
    near(m.area, Math.sqrt(Math.max(0, p * (p - m.sides[0]) * (p - m.sides[1]) * (p - m.sides[2]))), 1e-6);
  }
  assert.equal(measure(tri(0, 0, 4, 0, 0, 3)).area, 6);
});

test("3-4-5: Pythagoras holds exactly and the triangle is called vuông", () => {
  const m = measure(initialState());
  assert.deepEqual(m.sides, [5, 3, 4]);
  assert.equal(m.sq[1] + m.sq[2], m.sq[0]); // 9 + 16 = 25, exactly
  assert.equal(m.byAngles, "right");
  assert.equal(m.bySides, "scalene");
  assert.equal(m.big, 0);
  assert.equal(m.angles[0], 90);
  assert.equal(m.perimeter, 12);
  assert.equal(m.area, 6);
  assert.equal(describe(m), "Tam giác vuông tại A");
  assert.equal(specialType(m), "right");
  const r = measure(tri(2, 2, 6, 4, 1, 4)); // tilted: AB = (4,2), AC = (−1,2) are perpendicular
  assert.equal(r.byAngles, "right");
  assert.equal(r.big, 0);
});

test("classification by sides and by angles", () => {
  const [apexUp] = equilateralApexes([2, 1], [8, 1]);
  const eq = measure(tri(2, 1, 8, 1, ...apexUp));
  assert.equal(eq.bySides, "equilateral");
  assert.equal(eq.byAngles, "acute");
  eq.angles.forEach(a => near(a, 60, 1e-9));
  eq.sides.forEach(side => near(side, 6, 1e-12));
  assert.equal(describe(eq), "Tam giác đều");
  assert.equal(specialType(eq), "equilateral");

  const iso = measure(tri(2, 1, 8, 1, 5, 9)); // CA = CB, acute
  assert.equal(iso.bySides, "isosceles");
  assert.equal(iso.apex, 2);
  assert.equal(iso.byAngles, "acute");
  near(iso.angles[0], iso.angles[1]);
  assert.equal(describe(iso), "Tam giác cân tại C (tam giác nhọn)");
  assert.equal(specialType(iso), "isosceles");

  const flatIso = measure(tri(2, 1, 12, 1, 7, 2)); // isosceles and obtuse at C
  assert.equal(flatIso.bySides, "isosceles");
  assert.equal(flatIso.byAngles, "obtuse");
  assert.equal(describe(flatIso), "Tam giác cân tại C (tam giác tù)");

  const rightIso = measure(tri(3, 3, 7, 3, 3, 7));
  assert.equal(rightIso.bySides, "isosceles");
  assert.equal(rightIso.byAngles, "right");
  assert.equal(describe(rightIso), "Tam giác vuông cân tại A");
  assert.equal(specialType(rightIso), "right-isosceles");

  const obtuse = measure(tri(1, 1, 6, 1, 9, 4)); // obtuse at B
  assert.equal(obtuse.byAngles, "obtuse");
  assert.equal(obtuse.bySides, "scalene");
  assert.equal(obtuse.big, 1);
  assert.ok(obtuse.angles[1] > 90);
  assert.equal(describe(obtuse), "Tam giác tù");
  assert.equal(specialType(obtuse), "");

  const acute = measure(tri(1, 1, 8, 2, 5, 8));
  assert.equal(acute.byAngles, "acute");
  assert.equal(acute.bySides, "scalene");
  assert.ok(Math.max(...acute.angles) < 90);
  assert.equal(describe(acute), "Tam giác nhọn");

  // almost right (89.4°) is not called right
  assert.equal(measure(tri(0, 0, 10, 0, 0.1, 10)).byAngles, "acute");
});

test("the classifier agrees with the angles for every sample", () => {
  for (const s of samples) {
    const m = measure(s);
    const top = Math.max(...m.angles);
    assert.equal(m.byAngles, Math.abs(top - 90) < 1e-6 ? "right" : top < 90 ? "acute" : "obtuse");
    assert.equal(m.angles[m.big], top);
  }
});

test("collinear and coincident points are degenerate, with no NaN anywhere", () => {
  const cases = [
    [tri(1, 1, 3, 3, 6, 6), "Ba điểm thẳng hàng: không tạo thành tam giác"],
    [tri(2, 5, 2, 5, 9, 1), "Hai đỉnh A và B trùng nhau: không tạo thành tam giác"],
    [tri(2, 5, 9, 1, 9, 1), "Hai đỉnh B và C trùng nhau: không tạo thành tam giác"],
    [tri(2, 5, 9, 1, 2, 5), "Hai đỉnh C và A trùng nhau: không tạo thành tam giác"],
    [tri(4, 4, 4, 4, 4, 4), "Ba đỉnh trùng nhau: không tạo thành tam giác"],
    [tri(0, 3, 14, 3, 7, 3), "Ba điểm thẳng hàng: không tạo thành tam giác"],
  ];
  for (const [s, text] of cases) {
    const m = measure(s);
    assert.equal(m.degenerate, true);
    assert.equal(m.area, 0);
    assert.equal(m.bySides, null);
    assert.equal(m.byAngles, null);
    assert.equal(specialType(m), "");
    assert.equal(describe(m), text);
    const numbers = [...m.sides, ...m.angles, ...m.heights, m.area, m.perimeter, ...m.centroid, ...m.feet.flat(), ...m.midpoints.flat()];
    for (const v of numbers) assert.ok(Number.isFinite(v), `not finite: ${v}`);
    assert.equal(m.orthocenter, null);
  }
});

test("medians meet at the centroid, 2/3 of the way; altitudes are perpendicular and meet at the orthocentre", () => {
  for (const s of samples) {
    const m = measure(s);
    for (let i = 0; i < 3; i++) {
      const [p, mid, foot] = [m.points[i], m.midpoints[i], m.feet[i]];
      near(p[0] + (2 / 3) * (mid[0] - p[0]), m.centroid[0]);
      near(p[1] + (2 / 3) * (mid[1] - p[1]), m.centroid[1]);
      const q = m.points[(i + 1) % 3];
      const r = m.points[(i + 2) % 3];
      near((p[0] - foot[0]) * (r[0] - q[0]) + (p[1] - foot[1]) * (r[1] - q[1]), 0, 1e-7);
      // H lies on the altitude from vertex i
      const h = m.orthocenter;
      near((h[0] - p[0]) * (r[0] - q[0]) + (h[1] - p[1]) * (r[1] - q[1]), 0, 1e-6);
    }
  }
  const h = measure(initialState()).orthocenter; // right triangle: H is the right-angle vertex
  near(h[0], 5);
  near(h[1], 4);
});

test("the initial triangle and its three squares fit on the grid", () => {
  for (const [x, y] of sideSquares(measure(initialState())).flat()) assert.ok(x >= 0 && x <= W && y >= 0 && y <= H);
});

test("each side square has area side², right angles, and lies away from the opposite vertex", () => {
  for (const s of samples) {
    const m = measure(s);
    sideSquares(m).forEach(([q, r, r2, q2], i) => {
      const e = [r[0] - q[0], r[1] - q[1]];
      const n = [q2[0] - q[0], q2[1] - q[1]];
      near(e[0] * n[0] + e[1] * n[1], 0); // perpendicular
      near(n[0] ** 2 + n[1] ** 2, m.sq[i]); // area = side²
      near(r2[0] - r[0], n[0]);
      near(r2[1] - r[1], n[1]);
      const p = m.points[i];
      assert.ok(n[0] * (p[0] - q[0]) + n[1] * (p[1] - q[1]) < 0); // outward
    });
  }
});
