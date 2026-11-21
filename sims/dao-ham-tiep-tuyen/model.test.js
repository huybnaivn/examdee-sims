import test from "node:test";
import assert from "node:assert/strict";
import { X_MIN, X_MAX, FUNCS, initialState, value, derivative, secantSlope, tangent, trend, isStationary, summary } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const names = Object.keys(FUNCS);
const grid = [];
for (let i = X_MIN * 20; i <= X_MAX * 20; i++) grid.push(i / 20); // the slider positions

test("analytic derivatives at known points", () => {
  near(derivative("sq", 3), 6);
  near(derivative("sq", -1.5), -3);
  near(derivative("sq", 0), 0);
  near(derivative("cubic", 2), 9); // 3·4 − 3
  near(derivative("cubic", 0), -3);
  near(derivative("cubic", 1), 0);
  near(derivative("cubic", -1), 0);
  near(derivative("sin", 0), 1);
  near(derivative("sin", Math.PI / 3), 0.5);
  near(derivative("sin", Math.PI), -1);
  near(derivative("exp", 0), 1);
  near(derivative("exp", 1), Math.E);
  near(derivative("exp", -2), Math.exp(-2));
  near(derivative("inv", 2), -0.25);
  near(derivative("inv", -0.5), -4);
  near(derivative("sqrt", 4), 0.25);
  near(derivative("sqrt", 0.25), 1);
});

test("analytic derivative agrees with a central difference everywhere on the slider", () => {
  const e = 1e-6;
  for (const fn of names)
    for (const x of grid) {
      const d = derivative(fn, x);
      if (d === null || value(fn, x - e) === null) continue;
      const numeric = (value(fn, x + e) - value(fn, x - e)) / (2 * e);
      near(d, numeric, 1e-4 * Math.max(1, Math.abs(d)));
    }
});

test("secant slope: known values, and it converges to f′ as h → 0", () => {
  near(secantSlope("sq", 1, 1), 3); // (4 − 1)/1
  near(secantSlope("sq", 1, 0.5), 2.5); // 2x + h
  near(secantSlope("cubic", 0, 2), 1); // (8 − 6)/2
  near(secantSlope("inv", 1, 1), -0.5);
  near(secantSlope("sqrt", 0, 4), 0.5);
  const hs = [1, 0.5, 0.1, 0.01, 0.001];
  for (const fn of names)
    for (const x of [0.5, 1, 2, 3]) {
      const errors = hs.map(h => Math.abs(secantSlope(fn, x, h) - derivative(fn, x)));
      for (let i = 1; i < errors.length; i++) assert.ok(errors[i] < errors[i - 1], `${fn} at ${x}: ${errors}`);
      assert.ok(Math.abs(secantSlope(fn, x, 1e-6) - derivative(fn, x)) < 1e-4);
    }
  for (const fn of ["sq", "cubic", "sin", "exp"])
    for (const x of [-3, -1.5, 0]) {
      const errors = hs.map(h => Math.abs(secantSlope(fn, x, h) - derivative(fn, x)));
      for (let i = 1; i < errors.length; i++) assert.ok(errors[i] < errors[i - 1], `${fn} at ${x}: ${errors}`);
    }
});

test("tangent line passes through M with slope f′(x₀)", () => {
  for (const fn of names)
    for (const x of grid) {
      const t = tangent(fn, x);
      if (derivative(fn, x) === null) {
        assert.equal(t, null);
        continue;
      }
      assert.equal(t.slope, derivative(fn, x));
      near(t.slope * x + t.intercept, value(fn, x), 1e-9 * Math.max(1, Math.abs(t.slope)));
    }
  assert.deepEqual(tangent("sq", 1), { slope: 2, intercept: -1 }); // y = 2x − 1
  assert.deepEqual(tangent("cubic", -1), { slope: 0, intercept: 2 }); // y = 2
});

test("points outside the domain give null, never NaN or ±∞", () => {
  assert.equal(value("inv", 0), null);
  assert.equal(derivative("inv", 0), null);
  assert.equal(value("sqrt", -1), null);
  assert.equal(derivative("sqrt", -1), null);
  assert.equal(value("sqrt", 0), 0);
  assert.equal(derivative("sqrt", 0), null); // vertical tangent
  assert.equal(secantSlope("inv", -1, 1), null); // N falls on x = 0
  assert.equal(secantSlope("sqrt", -0.5, 1), null); // M is outside the domain
  assert.equal(secantSlope("sq", 1, 0), null);
  assert.equal(tangent("inv", 0), null);
  for (const fn of [...names, "unknown"])
    for (const x0 of [...grid, -100, 100, NaN])
      for (const h of [0.01, 0.5, 1, 2, 0, -3]) {
        const r = summary({ ...initialState(), fn, x0, h });
        for (const v of [r.y, r.slope, r.y2, r.secant, r.gap, r.tangent?.slope ?? null, r.tangent?.intercept ?? null]) {
          assert.ok(v === null || Number.isFinite(v), `${fn} x0=${x0} h=${h}: ${v}`);
        }
        assert.equal(typeof r.stationary, "boolean");
      }
});

test("sign of f′ matches increasing / decreasing", () => {
  const e = 1e-5;
  for (const fn of names)
    for (const x of grid) {
      const t = trend(fn, x);
      if (t === null || value(fn, x - e) === null) continue;
      if (Math.abs(derivative(fn, x)) < 1e-3) continue; // flat within rounding
      assert.equal(Math.sign(value(fn, x + e) - value(fn, x - e)), t, `${fn} at ${x}`);
    }
  assert.equal(trend("sq", -2), -1);
  assert.equal(trend("sq", 2), 1);
  assert.equal(trend("cubic", 0), -1); // decreasing between the two extrema
  assert.equal(trend("cubic", 1), 0);
  assert.equal(trend("exp", -4), 1); // always increasing
  assert.equal(trend("inv", -3), -1); // decreasing on both branches
  assert.equal(trend("inv", 3), -1);
  assert.equal(trend("sqrt", -1), null);
});

test("stationary points: where f′ = 0 within the tolerance, and only there", () => {
  assert.ok(isStationary("sq", 0));
  assert.ok(!isStationary("sq", 0.05));
  assert.ok(isStationary("cubic", 1) && isStationary("cubic", -1));
  assert.ok(!isStationary("cubic", 0));
  assert.ok(isStationary("sin", 1.55) && isStationary("sin", -1.55)); // nearest slider stops to ±π/2
  assert.ok(!isStationary("sin", 0));
  for (const x of grid) {
    assert.ok(!isStationary("exp", x)); // f′ = eˣ gets small but never 0
    assert.ok(!isStationary("inv", x));
    assert.ok(!isStationary("sqrt", x));
  }
  assert.ok(!isStationary("inv", 0)); // undefined is not stationary
});

test("summary of the initial state", () => {
  const r = summary(initialState());
  assert.deepEqual([r.x, r.y, r.slope, r.x2, r.y2, r.secant, r.gap, r.stationary], [1, 1, 2, 2, 4, 3, 1, false]);
});
