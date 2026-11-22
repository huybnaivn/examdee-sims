import test from "node:test";
import assert from "node:assert/strict";
import { initialState, vecA, vecB, add, sub, dot, cross, length, angle, perpendicular, projections, rotate, measure } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const SAMPLES = [
  [[3, 2, 2], [-1, 3, 2]],
  [[1, 0, 0], [0, 1, 0]],
  [[2, -3, 4], [-5, 1, 2]],
  [[1, 2, 3], [2, 4, 6]],
  [[-4, 5, -1], [3, 3, 3]],
];

test("sum and difference are taken component by component", () => {
  assert.deepEqual(add([1, 2, 3], [4, -5, 6]), [5, -3, 9]);
  assert.deepEqual(sub([1, 2, 3], [4, -5, 6]), [-3, 7, -3]);
  for (const [a, b] of SAMPLES) assert.deepEqual(add(sub(a, b), b), a);
});

test("dot product a·b = a₁b₁ + a₂b₂ + a₃b₃, length |a| = √(a₁² + a₂² + a₃²)", () => {
  assert.equal(dot([1, 2, 3], [4, -5, 6]), 12);
  assert.equal(length([2, 3, 6]), 7);
  assert.equal(length([0, 0, 0]), 0);
  for (const [a] of SAMPLES) near(dot(a, a), length(a) ** 2);
});

test("angle: cos(a, b) = a·b / (|a||b|)", () => {
  near(angle([1, 0, 0], [0, 1, 0]), 90);
  near(angle([1, 0, 0], [1, 1, 0]), 45);
  near(angle([1, 2, 3], [2, 4, 6]), 0, 1e-5);
  near(angle([1, 2, 3], [-1, -2, -3]), 180, 1e-5);
  near(angle([1, 1, 0], [0, 1, 1]), 60);
  assert.equal(angle([0, 0, 0], [1, 2, 3]), null);
  for (const [a, b] of SAMPLES) near(length(a) * length(b) * Math.cos((angle(a, b) * Math.PI) / 180), dot(a, b));
});

test("perpendicular exactly when a·b = 0 and neither is the zero vector", () => {
  assert.ok(perpendicular([1, 2, 3], [3, 0, -1]));
  assert.ok(!perpendicular([1, 2, 3], [3, 0, 1]));
  assert.ok(!perpendicular([0, 0, 0], [3, 0, 1]));
  assert.ok(!measure(initialState()).perpendicular, "the start must leave the goal to the learner");
});

test("cross product is perpendicular to both and |[a, b]| = |a||b|sin θ", () => {
  assert.deepEqual(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]); // right-handed
  assert.deepEqual(cross([1, 2, 3], [4, 5, 6]), [-3, 6, -3]);
  for (const [a, b] of SAMPLES) {
    const n = cross(a, b);
    assert.equal(dot(n, a), 0);
    assert.equal(dot(n, b), 0);
    near(length(n), length(a) * length(b) * Math.sin((angle(a, b) * Math.PI) / 180), 1e-5);
    assert.deepEqual(cross(b, a), n.map(v => -v || 0));
  }
  assert.deepEqual(cross([1, 2, 3], [2, 4, 6]), [0, 0, 0]); // collinear
});

test("projections on the coordinate planes drop one coordinate", () => {
  const p = projections([3, -2, 5]);
  assert.deepEqual(p.xy, [3, -2, 0]);
  assert.deepEqual(p.yz, [0, -2, 5]);
  assert.deepEqual(p.xz, [3, 0, 5]);
});

test("turning the view keeps lengths, angles and orientation", () => {
  for (const [yaw, pitch] of [[0, 0], [-28, 22], [137, 80], [300, -10]]) {
    for (const [a, b] of SAMPLES) {
      const ra = rotate(a, yaw, pitch);
      const rb = rotate(b, yaw, pitch);
      near(length(ra), length(a));
      near(dot(ra, rb), dot(a, b));
      const rn = rotate(cross(a, b), yaw, pitch);
      cross(ra, rb).forEach((v, i) => near(v, rn[i])); // no mirror image
    }
  }
  // default view: Oz points up the screen
  const up = rotate([0, 0, 1], -28, 22);
  assert.ok(up[1] > 0.9 && Math.abs(up[0]) < 1e-12);
});

test("measure agrees with the formulas and forged coordinates are clamped", () => {
  const m = measure(initialState());
  assert.deepEqual(m.sum, [3, 1, 5]);
  assert.deepEqual(m.diff, [-1, 7, 1]);
  assert.equal(m.dot, -4);
  near(m.lenA, Math.sqrt(26));
  near(m.area, m.lenA * m.lenB * Math.sin((m.angle * Math.PI) / 180), 1e-9);
  assert.deepEqual(vecA({ ax: 1e9, ay: NaN, az: -1e9 }), [5, 0, -5]);
  assert.deepEqual(vecB({}), [0, 0, 0]);
});
