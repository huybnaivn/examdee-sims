import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, measures } from "./model.js";

const near = (x, y, tol = 1e-6) => assert.ok(Math.abs(x - y) < tol, `${x} ≠ ${y}`);
const rad = d => (d * Math.PI) / 180;
const run = (mode, v) => solve({ ...initialState(), mode, ...v });

// Every solution must satisfy both theorems and the angle sum.
const consistent = t => {
  near(t.A + t.B + t.C, 180);
  near(t.a * t.a, t.b * t.b + t.c * t.c - 2 * t.b * t.c * Math.cos(rad(t.A)));
  near(t.b * t.b, t.a * t.a + t.c * t.c - 2 * t.a * t.c * Math.cos(rad(t.B)));
  near(t.a / Math.sin(rad(t.A)), t.b / Math.sin(rad(t.B)));
  near(t.a / Math.sin(rad(t.A)), t.c / Math.sin(rad(t.C)));
  near(t.a / Math.sin(rad(t.A)), 2 * t.R);
};

test("SSS: 3-4-5 is right-angled at the angle opposite 5; equilateral has 60° angles", () => {
  const [t] = run("SSS", { a: 3, b: 4, c: 5 }).solutions;
  near(t.C, 90);
  near(t.S, 6);
  near(t.R, 2.5); // hypotenuse / 2
  near(t.r, 1); // (3 + 4 − 5)/2
  consistent(t);
  const [e] = run("SSS", { a: 2, b: 2, c: 2 }).solutions;
  near(e.A, 60);
  near(e.B, 60);
  near(e.R, 2 / Math.sqrt(3));
});

test("SAS: law of cosines gives the third side", () => {
  const [t] = run("SAS", { b: 5, c: 8, A: 60 }).solutions;
  near(t.a, 7); // 25 + 64 − 40 = 49
  consistent(t);
  const [o] = run("SAS", { b: 3, c: 4, A: 120 }).solutions;
  near(o.a, Math.sqrt(37));
  consistent(o);
});

test("ASA: law of sines gives the other two sides", () => {
  const [t] = run("ASA", { a: 10, B: 45, C: 75 }).solutions;
  near(t.A, 60);
  near(t.b, (10 * Math.sin(rad(45))) / Math.sin(rad(60)));
  near(t.c, (10 * Math.sin(rad(75))) / Math.sin(rad(60)));
  consistent(t);
});

test("SSA ambiguous case gives 0, 1 or 2 triangles", () => {
  assert.equal(run("SSA", { a: 3, b: 10, A: 30 }).solutions.length, 0); // b sin A = 5 > a
  assert.match(run("SSA", { a: 3, b: 10, A: 30 }).error, /không có tam giác/);
  const right = run("SSA", { a: 5, b: 10, A: 30 }).solutions; // a = b sin A
  assert.equal(right.length, 1);
  near(right[0].B, 90);
  const two = run("SSA", { a: 6, b: 10, A: 30 }).solutions; // b sin A < a < b
  assert.equal(two.length, 2);
  near(two[0].B + two[1].B, 180);
  two.forEach(consistent);
  assert.equal(run("SSA", { a: 12, b: 10, A: 30 }).solutions.length, 1); // a ≥ b
  assert.equal(run("SSA", { a: 10, b: 10, A: 30 }).solutions.length, 1); // isosceles, B = A
  assert.equal(run("SSA", { a: 5, b: 10, A: 120 }).solutions.length, 0); // obtuse A needs a > b
  assert.equal(run("SSA", { a: 12, b: 10, A: 120 }).solutions.length, 1);
});

test("Heron's formula equals ½ab·sin C, and r = S/p, R = abc/(4S)", () => {
  for (const [mode, v] of [["SSS", { a: 7, b: 5, c: 6 }], ["SAS", { b: 4, c: 9, A: 100 }], ["ASA", { a: 3, B: 20, C: 130 }], ["SSA", { a: 6, b: 10, A: 30 }]]) {
    for (const t of run(mode, v).solutions) {
      near(t.S, t.heron, 1e-6);
      near(t.S, 0.5 * t.b * t.c * Math.sin(rad(t.A)));
      near(t.r, t.S / t.p);
      near(t.R, (t.a * t.b * t.c) / (4 * t.S));
    }
  }
  near(measures(3, 4, 5, 36.87, 53.13, 90).heron, 6);
});

test("invalid inputs are rejected with a reason", () => {
  assert.match(run("SSS", { a: 1, b: 2, c: 3 }).error, /bất đẳng thức tam giác/);
  assert.match(run("SSS", { a: 1, b: 2, c: 5 }).error, /bất đẳng thức tam giác/);
  assert.match(run("ASA", { a: 5, B: 100, C: 80 }).error, /≥ 180°/);
  assert.match(run("ASA", { a: 5, B: 120, C: 70 }).error, /≥ 180°/);
  assert.equal(run("SSS", { a: 1, b: 2, c: 0 }).solutions.length, 0);
});

test("initial state solves to one triangle", () => {
  const r = solve(initialState());
  assert.equal(r.error, undefined);
  assert.equal(r.solutions.length, 1);
});
