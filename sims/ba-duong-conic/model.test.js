import test from "node:test";
import assert from "node:assert/strict";
import { CURVES, STEP, X_MAX, initialState, normalize, shape, yLimit, pointM, distances, residual, project, target, throughTarget, newChallenge } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const grid = (lo, hi) => Array.from({ length: Math.round((hi - lo) / STEP) + 1 }, (_, i) => lo + i * STEP);
const st = over => ({ ...initialState(), ...over });

test("ellipse: c² = a² − b², 0 < e < 1, and MF₁ + MF₂ = 2a for every point generated", () => {
  const g0 = shape(st({ a: 5, b: 3 }));
  assert.equal(g0.c, 4);
  assert.equal(g0.e, 0.8);
  for (const a of grid(1.5, 6)) for (const b of grid(1, a - STEP)) {
    const g = shape(st({ a, b }));
    near(g.c * g.c, a * a - b * b);
    assert.ok(g.e > 0 && g.e < 1);
    for (let angle = 0; angle < 360; angle += 7) {
      const s = st({ a, b, angle });
      const m = pointM(s);
      const d = distances(s);
      near(d.d1 + d.d2, 2 * a);
      near(residual(s, m.x, m.y), 0); // x²/a² + y²/b² = 1
    }
  }
});

test("hyperbola: c² = a² + b², e > 1, |MF₁ − MF₂| = 2a on both branches, asymptote slopes ±b/a", () => {
  const g0 = shape(st({ curve: "hyperbola", a: 3, b: 4 }));
  assert.equal(g0.c, 5);
  near(g0.e, 5 / 3);
  for (const a of grid(1.5, 6)) for (const b of grid(1, 5)) for (const left of [false, true]) {
    const g = shape(st({ curve: "hyperbola", a, b }));
    near(g.c * g.c, a * a + b * b);
    assert.ok(g.e > 1);
    for (let my = -6; my <= 6; my += 0.75) {
      const s = st({ curve: "hyperbola", a, b, my, left });
      const m = pointM(s);
      const d = distances(s);
      near(Math.abs(d.d1 - d.d2), 2 * a, 1e-8);
      near(residual(s, m.x, m.y), 0, 1e-8); // x²/a² − y²/b² = 1
      assert.equal(m.x < 0, left);
      assert.ok(Math.abs(m.x) <= X_MAX + 1e-9 && Math.abs(m.x) >= a);
      // the right branch is nearer F₂, the left branch nearer F₁
      assert.ok(left ? d.d1 < d.d2 : d.d2 < d.d1);
    }
    // far away the curve approaches y = ±(b/a)x: y/x → b/a
    const far = 1e6;
    near((b * Math.sqrt((far * far) / (a * a) - 1)) / far, b / a, 1e-9);
    // and the asymptote itself never meets the curve: x²/a² − (bx/a)²/b² = 0 ≠ 1
    near(residual(st({ curve: "hyperbola", a, b }), 3, (b / a) * 3), -1);
  }
});

test("parabola: focus (p/2; 0), directrix x = −p/2, MF = d(M, Δ), e = 1", () => {
  for (const p of grid(0.5, 4)) {
    const g = shape(st({ curve: "parabola", p }));
    assert.equal(g.c, p / 2);
    assert.equal(g.e, 1);
    for (let my = -6; my <= 6; my += 0.5) {
      const s = st({ curve: "parabola", p, my });
      const m = pointM(s);
      const d = distances(s);
      near(d.d1, d.d2);
      near(d.d1, Math.hypot(m.x - p / 2, m.y)); // distance to the focus (p/2; 0)
      near(d.d2, m.x + p / 2); // distance to the line x = −p/2
      near(residual(s, m.x, m.y), 0); // y² = 2px
    }
    // the vertex is halfway between focus and directrix
    near(distances(st({ curve: "parabola", p }), { x: 0, y: 0 }).d1, p / 2);
  }
});

test("points off the curve do not satisfy the definition", () => {
  const e = st({ a: 5, b: 3 });
  const inside = distances(e, { x: 1, y: 1 });
  assert.ok(inside.d1 + inside.d2 < 10 && residual(e, 1, 1) < 0);
  const outside = distances(e, { x: 5, y: 3 });
  assert.ok(outside.d1 + outside.d2 > 10 && residual(e, 5, 3) > 0);
  const p = st({ curve: "parabola", p: 2 });
  const d = distances(p, { x: 3, y: 0 });
  assert.ok(d.d1 < d.d2 && residual(p, 3, 0) < 0);
});

test("an ellipse always keeps a > b; forged values are clamped", () => {
  assert.deepEqual(normalize(st({ a: 3, b: 4 }), "a").b, 2.5);
  assert.deepEqual(normalize(st({ a: 3, b: 4 }), "b").a, 4.5);
  assert.deepEqual(normalize(st({ a: 3, b: 4, challenge: true }), "b"), st({ a: 3, b: 2.5, challenge: true })); // a is given
  const g = shape(st({ a: 2, b: 5 }));
  assert.ok(g.a > g.b && g.c > 0);
  assert.deepEqual(shape(st({ curve: "parabola", p: -3 })), { p: 0.5, c: 0.25, e: 1 });
  assert.deepEqual(target(st({ tx: 1e9, ty: -1e9 })), { x: 13, y: -6 });
  const s = normalize(st({ curve: "hyperbola", a: 6, b: 1, my: 6 }), "a");
  near(s.my, yLimit(s));
  near(pointM(s).x, X_MAX, 1e-9);
});

test("dragging puts M at the pointer's position on the curve", () => {
  const e = st({ a: 5, b: 3 });
  assert.deepEqual(project(e, 0, 2), { angle: 90 });
  assert.deepEqual(project(e, -1, 0), { angle: 180 });
  assert.deepEqual(project(e, 0, -9), { angle: 270 });
  const h = st({ curve: "hyperbola", a: 3, b: 2 });
  assert.deepEqual(project(h, -4, 1.23), { my: 1.2, left: true });
  assert.deepEqual(project(h, 4, -2), { my: -2, left: false });
  assert.deepEqual(project(st({ curve: "parabola", p: 2 }), 1, 99), { my: 6 });
});

test("challenge: the point lies on the curve for the answer and for no other grid value", () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (const curve of CURVES) {
    for (let i = 0; i < 300; i++) {
      const ch = newChallenge(curve, rand);
      const s = { ...st({ curve, challenge: true }), ...ch.set };
      assert.equal(throughTarget(s), false, "must not start solved");
      assert.ok(Math.abs(s.tx) <= 13 && Math.abs(s.ty) <= 6);
      const key = curve === "parabola" ? "p" : "b";
      const options = curve === "parabola" ? grid(0.5, 4) : curve === "ellipse" ? grid(1, s.a - STEP) : grid(1, 5);
      assert.deepEqual(options.filter(v => throughTarget({ ...s, [key]: v })), [ch.answer], `${curve} ${JSON.stringify(ch)}`);
    }
  }
});
