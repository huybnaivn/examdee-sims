import test from "node:test";
import assert from "node:assert/strict";
import { angleDeg, classify, intersection, lineThrough, perpendicularSlope, taskMet, equation, initialState } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const fmt = (v, d) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",").replace("-", "−");

test("angle with Ox from the slope: tan α = a", () => {
  near(angleDeg(1), 45);
  near(angleDeg(Math.sqrt(3)), 60);
  near(angleDeg(1 / Math.sqrt(3)), 30);
  near(angleDeg(-1), 135, 1e-9); // a < 0: obtuse angle
  near(angleDeg(0), 0);
  for (const a of [0.25, 2, -0.5, -3]) near(Math.tan((angleDeg(a) * Math.PI) / 180), a, 1e-9);
});

test("classification for every case", () => {
  assert.equal(classify(2, -1, 2, 3), "song-song");
  assert.equal(classify(2, -1, 2, -1), "trung-nhau");
  assert.equal(classify(2, -1, 0.5, 2), "cat-nhau");
  assert.equal(classify(2, -1, -0.5, 4), "vuong-goc");
  assert.equal(classify(-4, 0, 0.25, 1), "vuong-goc");
  assert.equal(classify(0, 1, 0, 1), "trung-nhau");
});

test("perpendicular condition a₁a₂ = −1 is exactly when the direction vectors are orthogonal", () => {
  for (const a1 of [0.25, 0.5, 1, 2, 4, -2]) {
    const a2 = perpendicularSlope(a1);
    near(a1 * a2, -1);
    near(1 * 1 + a1 * a2, 0); // (1, a₁)·(1, a₂)
    near(Math.abs(angleDeg(a1) - angleDeg(a2)), 90, 1e-9);
  }
  assert.ok(Number.isNaN(perpendicularSlope(0)));
});

test("line through a point with a given slope", () => {
  const b = lineThrough(2, 1, 2); // y = 2x − 3
  near(b, -3);
  near(2 * 2 + b, 1);
  const s = { ...initialState(), task: 3, a2: 2, b2: lineThrough(2, 1, 2) };
  assert.ok(taskMet(s), "parallel to d₁ through M(2; 1)");
  assert.ok(!taskMet({ ...s, b2: -2 }));
  const p = { ...initialState(), task: 4, a2: -0.5, b2: lineThrough(2, 1, -0.5) };
  assert.ok(taskMet(p));
  assert.ok(taskMet({ ...initialState(), task: 1, a2: 2, b2: 4 }));
  assert.ok(!taskMet({ ...initialState(), task: 1, a2: 2, b2: -1 }), "coinciding is not parallel");
});

test("intersection point lies on both lines", () => {
  const p = intersection(2, -1, 0.5, 2);
  near(p.x, 2);
  near(p.y, 3);
  for (const [a1, b1, a2, b2] of [[1, 0, -1, 4], [-3, 2, 0.25, -5], [0, 3, 2, 0]]) {
    const q = intersection(a1, b1, a2, b2);
    near(a1 * q.x + b1, q.y);
    near(a2 * q.x + b2, q.y);
  }
  assert.equal(intersection(1, 0, 1, 2), null);
});

test("equation text", () => {
  assert.equal(equation(2, -1, fmt), "y = 2x − 1");
  assert.equal(equation(-1, 0.5, fmt), "y = −x + 0,5");
  assert.equal(equation(0, -3, fmt), "y = −3");
  assert.equal(equation(-0.25, 0, fmt), "y = −0,25x");
});
