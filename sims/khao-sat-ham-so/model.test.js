import test from "node:test";
import assert from "node:assert/strict";
import { initialState, f, df, criticalPoints, inflection, realRoots, variationTable, summary, deltaPrime, degree } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const K = (a, b, c, d) => ({ a, b, c, d });

test("two critical points when Δ′ > 0, classified by y″", () => {
  const k = K(1, -3, 0, 2); // y′ = 3x² − 6x
  assert.equal(deltaPrime(k), 9);
  const c = criticalPoints(k);
  assert.equal(c.length, 2);
  near(c[0].x, 0);
  near(c[1].x, 2);
  assert.equal(c[0].type, "max");
  assert.equal(c[1].type, "min");
  near(f(k, 0), 2);
  near(f(k, 2), -2);
  // a < 0 flips the order: minimum first
  const m = criticalPoints(K(-1, 0, 3, 0)); // y′ = −3x² + 3
  near(m[0].x, -1);
  near(m[1].x, 1);
  assert.deepEqual(m.map(p => p.type), ["min", "max"]);
});

test("one double critical point when Δ′ = 0: no extremum", () => {
  const k = K(1, -3, 3, -1); // (x − 1)³, y′ = 3(x − 1)²
  assert.equal(deltaPrime(k), 0);
  const c = criticalPoints(k);
  assert.equal(c.length, 1);
  near(c[0].x, 1);
  assert.equal(c[0].type, "none");
  // also on the 0,1 slider grid, where Δ′ is computed in floating point
  const g = K(0.3, 0.9, 0.9, 0);
  assert.equal(criticalPoints(g).length, 1);
  assert.equal(summary(g).extrema.length, 0);
});

test("no critical point when Δ′ < 0", () => {
  assert.deepEqual(criticalPoints(K(1, 0, 3, 0)), []);
  assert.deepEqual(criticalPoints(K(-2, 1, -1, 4)), []);
});

test("critical points really solve y′ = 0", () => {
  for (const k of [K(1, -3, 0, 2), K(-1, 0, 3, 0), K(0.5, 1.2, -2.7, 1), K(-2.4, 3.3, 1.1, -0.5)])
    for (const p of criticalPoints(k)) near(df(k, p.x), 0, 1e-9);
});

test("inflection point at x = −b/(3a), where y″ changes sign", () => {
  near(inflection(K(1, -3, 0, 2)), 1);
  near(inflection(K(2, 3, 0, 0)), -0.5);
  near(inflection(K(-1, 0, 3, 0)), 0);
  assert.equal(inflection(K(0, 1, 0, 0)), null);
  // midpoint of the two extrema
  const c = criticalPoints(K(0.5, 1.2, -2.7, 1));
  near((c[0].x + c[1].x) / 2, inflection(K(0.5, 1.2, -2.7, 1)));
});

test("number of real roots", () => {
  const r3 = realRoots(K(1, 0, -1, 0)); // x(x − 1)(x + 1)
  assert.equal(r3.length, 3);
  [-1, 0, 1].forEach((x, i) => near(r3[i], x));
  assert.equal(realRoots(K(1, -3, 0, 2)).length, 3);
  assert.equal(realRoots(K(1, 0, 1, 1)).length, 1); // monotone
  assert.equal(realRoots(K(1, 0, -3, 5)).length, 1); // extrema on the same side
  const r2 = realRoots(K(1, 0, -3, 2)); // (x − 1)²(x + 2): tangent at x = 1
  assert.equal(r2.length, 2);
  near(r2[0], -2);
  near(r2[1], 1);
  assert.equal(realRoots(K(1, -3, 3, -1)).length, 1); // (x − 1)³
  for (const k of [K(1, 0, -1, 0), K(0.7, -1.3, -2, 0.4), K(-2.4, 3.3, 1.1, -0.5)])
    for (const x of realRoots(k)) near(f(k, x), 0, 1e-8);
});

test("a = 0 degrades to the quadratic, linear and constant cases", () => {
  const q = K(0, 1, -2, -3); // x² − 2x − 3 = (x − 3)(x + 1)
  assert.equal(degree(q), 2);
  const c = criticalPoints(q);
  assert.equal(c.length, 1);
  near(c[0].x, 1);
  assert.equal(c[0].type, "min");
  assert.equal(criticalPoints(K(0, -2, 4, 0))[0].type, "max");
  assert.equal(inflection(q), null);
  const r = realRoots(q);
  near(r[0], -1);
  near(r[1], 3);
  assert.equal(realRoots(K(0, 1, -2, 1)).length, 1); // (x − 1)²
  assert.equal(realRoots(K(0, 1, 0, 1)).length, 0);
  assert.deepEqual(criticalPoints(K(0, 0, 2, 1)), []);
  near(realRoots(K(0, 0, 2, 1))[0], -0.5);
  assert.deepEqual(realRoots(K(0, 0, 0, 3)), []);
  assert.equal(realRoots(K(0, 0, 0, 0)), null);
  const s = summary(K(0, 0, 0, 0));
  assert.equal(s.deg, -1);
  assert.equal(s.table.nodes.length, 2);
});

test("variation table matches the sign of y′ at sample points", () => {
  const cases = [K(1, -3, 0, 2), K(-1, 0, 3, 0), K(1, -3, 3, -1), K(1, 0, 3, 0), K(-2, 1, -1, 4), K(0, 1, -2, -3), K(0, -1, 0, 0), K(0, 0, 2, 1), K(0, 0, -1, 0), K(0, 0, 0, 2)];
  for (const k of cases) {
    const { nodes, signs } = variationTable(k);
    assert.equal(signs.length, nodes.length - 1);
    for (let x = -10; x <= 10; x += 0.37) {
      if (nodes.some(n => Math.abs(n.x - x) < 1e-6)) continue;
      const i = nodes.findIndex((n, j) => j > 0 && x < n.x) - 1;
      const v = df(k, x);
      assert.equal(signs[i], Math.abs(v) < 1e-9 ? 0 : Math.sign(v), `${JSON.stringify(k)} at ${x}`);
    }
    // arrows go up on +, down on −
    for (let i = 0; i < signs.length; i++) {
      assert.equal(Math.sign(nodes[i + 1].level - nodes[i].level), signs[i]);
    }
  }
  const t = variationTable(K(1, -3, 0, 2));
  assert.deepEqual(t.signs, [1, -1, 1]);
  assert.deepEqual(t.nodes.map(n => n.level), [-1, 1, -1, 1]);
  assert.equal(t.nodes[0].y, -Infinity);
  assert.equal(t.nodes[3].y, Infinity);
  near(t.nodes[1].y, 2);
  near(t.nodes[2].y, -2);
  const neg = variationTable(K(-1, 0, 3, 0));
  assert.equal(neg.nodes[0].y, Infinity);
  assert.equal(neg.nodes[3].y, -Infinity);
  const par = variationTable(K(0, 1, -2, -3));
  assert.equal(par.nodes[0].y, Infinity);
  assert.equal(par.nodes[2].y, Infinity);
  near(par.nodes[1].y, -4);
});

test("summary of the initial state and forged values", () => {
  const s = summary(initialState());
  assert.equal(s.extrema.length, 2);
  near(s.inflection.x, 1);
  near(s.inflection.y, 0);
  assert.equal(s.roots.length, 3);
  const bad = summary({ a: NaN, b: "x", c: Infinity, d: 1 });
  assert.equal(bad.deg, 0);
  assert.deepEqual(bad.roots, []);
});
