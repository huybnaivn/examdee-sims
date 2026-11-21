import test from "node:test";
import assert from "node:assert/strict";
import { initialState, expandedC, fromExpanded, circle, distance, relative, tangentC, R_MIN, R_MAX } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const grid = [];
for (let v = -5; v <= 5; v += 1.5) grid.push(v);
const radii = [0.5, 1, 2.3, 4, 6];
const onCircle = ({ a, b, R }, p) => (p.x - a) ** 2 + (p.y - b) ** 2 - R * R;
const expanded = ({ a, b, c }, p) => p.x ** 2 + p.y ** 2 - 2 * a * p.x - 2 * b * p.y + c;

test("both forms describe the same circle: c = a² + b² − R², R = √(a² + b² − c)", () => {
  assert.equal(expandedC(1, 2, 3), -4); // (x − 1)² + (y − 2)² = 9 ⇔ x² + y² − 2x − 4y − 4 = 0
  assert.deepEqual(fromExpanded(1, 2, -4), { r2: 9, R: 3 });
  for (const a of grid)
    for (const b of grid)
      for (const R of radii) {
        const c = expandedC(a, b, R);
        near(fromExpanded(a, b, c).R, R);
        // points of the circle satisfy the expanded equation
        for (let t = 0; t < 6.3; t += 0.7) {
          const p = { x: a + R * Math.cos(t), y: b + R * Math.sin(t) };
          near(expanded({ a, b, c }, p), 0, 1e-9);
        }
      }
});

test("x² + y² − 2ax − 2by + c = 0 is not a circle when a² + b² − c ≤ 0", () => {
  assert.equal(fromExpanded(1, 2, 5).R, null); // r2 = 0: only the point (1; 2)
  assert.equal(fromExpanded(1, 2, 5).r2, 0);
  assert.equal(fromExpanded(0, 0, 3).R, null); // x² + y² + 3 = 0: no point
  assert.ok(fromExpanded(0, 0, 3).r2 < 0);
  assert.equal(fromExpanded(0, 0, -4).R, 2);
  const s = { ...initialState(), mode: "expanded", a: 2, b: -1, c: 6 };
  assert.equal(circle(s).R, null);
  assert.equal(relative(circle(s), 1, 1, 0), null);
});

test("circle() follows the mode and keeps R in range", () => {
  const s = initialState();
  assert.deepEqual(circle(s), { a: 1, b: 2, c: -4, r2: 9, R: 3 });
  assert.equal(circle({ ...s, R: 100 }).R, R_MAX);
  assert.equal(circle({ ...s, R: -3 }).R, R_MIN);
  near(circle({ ...s, mode: "expanded", c: -11 }).R, 4);
});

test("distance from a point to a line: |Ax₀ + By₀ + C| / √(A² + B²)", () => {
  assert.equal(distance(3, 4, -6, 1, 2), 1);
  assert.equal(distance(3, 4, -26, 1, 2), 3);
  assert.equal(distance(1, 0, -2, 5, 7), 3); // x = 2
  assert.equal(distance(0, 1, 1, 5, 7), 8); // y = −1
  near(distance(1, 1, 0, 1, 0), Math.SQRT1_2);
  assert.equal(distance(0, 0, 5, 1, 1), null); // not a line
  // the foot H is on Δ and IH is perpendicular to Δ, |IH| = d
  for (const [A, B, C] of [[3, 4, -6], [1, -2, 3], [0, 2, -5], [-4, 0, 1]]) {
    const cir = circle({ ...initialState(), R: 6 });
    const r = relative(cir, A, B, C);
    near(A * r.H.x + B * r.H.y + C, 0);
    near(Math.hypot(r.H.x - cir.a, r.H.y - cir.b), r.d);
    near((r.H.x - cir.a) * -B + (r.H.y - cir.b) * A, 0);
  }
});

test("classification: cut (d < R), tangent (d = R), apart (d > R)", () => {
  const cir = circle(initialState()); // I(1; 2), R = 3
  assert.equal(relative(cir, 3, 4, -6).kind, "cut"); // d = 1
  assert.equal(relative(cir, 3, 4, 4).kind, "tangent"); // d = 3
  assert.equal(relative(cir, 3, 4, -26).kind, "tangent");
  assert.equal(relative(cir, 3, 4, 10).kind, "apart"); // d = 21/5
  assert.equal(relative(cir, 1, 0, -4).kind, "tangent"); // x = 4
  assert.equal(relative(cir, 0, 1, 2).kind, "apart"); // y = −2, d = 4
  for (const a of grid)
    for (const b of grid)
      for (const R of radii)
        for (const [A, B, C] of [[1, 1, 0], [2, -3, 4], [0, 1, -3], [5, 0, 7]]) {
          const r = relative({ a, b, R }, A, B, C);
          const d = Math.abs(A * a + B * b + C) / Math.hypot(A, B);
          assert.equal(r.kind, Math.abs(d - R) < 1e-9 ? "tangent" : d < R ? "cut" : "apart");
          assert.equal(r.points.length, { cut: 2, tangent: 1, apart: 0 }[r.kind]);
        }
});

test("intersection points satisfy both equations", () => {
  for (const a of grid)
    for (const b of grid)
      for (const R of radii)
        for (const [A, B, C] of [[1, 1, 0], [2, -3, 4], [0, 1, -3], [5, 0, 7], [3, 4, -6]]) {
          const cir = { a, b, R, c: expandedC(a, b, R) };
          for (const p of relative(cir, A, B, C).points) {
            near(A * p.x + B * p.y + C, 0, 1e-9);
            near(onCircle(cir, p), 0, 1e-8);
            near(expanded(cir, p), 0, 1e-8);
          }
        }
});

test("the tangent C gives d = R and exactly one point, the foot H", () => {
  for (const a of grid)
    for (const b of grid)
      for (const R of radii)
        for (const [A, B] of [[1, 1], [2, -3], [0, 1], [5, 0], [3, 4]]) {
          const cir = { a, b, R };
          for (const C0 of [-50, 50]) {
            const C = tangentC(cir, A, B, C0);
            const r = relative(cir, A, B, C);
            assert.equal(r.kind, "tangent");
            near(r.d, R, 1e-9);
            assert.equal(r.points.length, 1);
            near(onCircle(cir, r.points[0]), 0, 1e-8);
            near(A * r.points[0].x + B * r.points[0].y + C, 0, 1e-9);
          }
        }
  // nearer of the two tangents
  const cir = circle(initialState());
  assert.equal(tangentC(cir, 3, 4, 0), 4);
  assert.equal(tangentC(cir, 3, 4, -20), -26);
});
