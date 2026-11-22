import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, lineDist, bisectorFoot, dist, POSITION } from "./model.js";

const close = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const tri = (ax, ay, bx, by, cx, cy) => ({ ...initialState(), ax, ay, bx, by, cx, cy });
const CASES = [
  initialState(),
  tri(-4, -3, 4, -3, 0, 3), // isosceles, acute
  tri(-3, -2, 3, -2, -3, 6), // right angle at A
  tri(-5, -2, 5, -2, 3, 1), // obtuse at C
  tri(0, 0, 1, 0, 0.5, Math.sqrt(3) / 2), // equilateral
  tri(-2.5, 1.5, 3, -4, 0.5, 4.5),
];

test("the circumcentre is equidistant from the three vertices, at distance R = abc/(4S)", () => {
  for (const s of CASES) {
    const m = solve(s);
    close(dist(m.O, m.A), m.R);
    close(dist(m.O, m.B), m.R);
    close(dist(m.O, m.C), m.R);
    close(m.R, (m.a * m.b * m.c) / (4 * m.S));
  }
});

test("the incentre is equidistant from the three sides, at distance r = S/p", () => {
  for (const s of CASES) {
    const m = solve(s);
    close(lineDist(m.I, m.B, m.C), m.r);
    close(lineDist(m.I, m.C, m.A), m.r);
    close(lineDist(m.I, m.A, m.B), m.r);
    // Heron's formula gives the same S, so r = S/p agrees with it
    const heron = Math.sqrt(m.p * (m.p - m.a) * (m.p - m.b) * (m.p - m.c));
    close(m.S, heron, 1e-7);
    close(m.r, m.S / m.p);
  }
});

test("the incentre lies on each angle bisector", () => {
  for (const s of CASES) {
    const m = solve(s);
    for (const [V, P, Q] of [[m.A, m.B, m.C], [m.B, m.C, m.A], [m.C, m.A, m.B]]) {
      const F = bisectorFoot(V, P, Q);
      // I, V, F collinear
      const cross = (F[0] - V[0]) * (m.I[1] - V[1]) - (F[1] - V[1]) * (m.I[0] - V[0]);
      close(cross, 0, 1e-9);
    }
  }
});

test("right triangle: the circumcentre is the midpoint of the hypotenuse and R is half of it", () => {
  const m = solve(tri(-3, -2, 3, -2, -3, 6)); // right angle at A, hypotenuse BC = 10
  close(m.O[0], 0);
  close(m.O[1], 2);
  close(m.R, 5);
  assert.equal(m.position, POSITION.onSide);
  close(m.r, (6 + 8 - 10) / 2); // r = (legs − hypotenuse) / 2 for a right triangle
});

test("the circumcentre is inside an acute triangle and outside an obtuse one", () => {
  assert.equal(solve(initialState()).position, POSITION.inside);
  assert.equal(solve(tri(-5, -2, 5, -2, 3, 1)).position, POSITION.outside);
  assert.equal(solve(tri(0, 0, 1, 0, 0.5, Math.sqrt(3) / 2)).position, POSITION.inside);
});

test("equilateral triangle: O and I coincide and R = 2r", () => {
  const m = solve(tri(0, 0, 1, 0, 0.5, Math.sqrt(3) / 2));
  close(dist(m.O, m.I), 0);
  close(m.R, 2 * m.r);
  close(m.R, 1 / Math.sqrt(3));
});

test("Euler's formula: OI² = R² − 2Rr", () => {
  for (const s of CASES) {
    const m = solve(s);
    close(dist(m.O, m.I) ** 2, m.R ** 2 - 2 * m.R * m.r, 1e-8);
  }
});

test("collinear points are reported as degenerate", () => {
  assert.equal(solve(tri(-4, 0, 0, 0, 4, 0)).degenerate, true);
  assert.equal(solve(tri(-4, -4, 0, 0, 3, 3)).degenerate, true);
  assert.equal(solve(tri(1, 1, 1, 1, 3, 2)).degenerate, true);
});
