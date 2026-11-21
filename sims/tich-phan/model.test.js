import test from "node:test";
import assert from "node:assert/strict";
import { FUNCS, RULES, exact, approximate, areas, summary, initialState } from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("exact integrals from antiderivatives", () => {
  close(exact("lin", 0, 2), 3); // trapezoid with heights 1 and 2, width 2
  close(exact("sq", 0, 3), 9);
  close(exact("sq", 0, 1), 1 / 3);
  close(exact("cap", -2, 2), 32 / 3);
  close(exact("sin", 0, Math.PI), 2);
  close(exact("exp", 0, 1), Math.E - 1);
  close(exact("exp", -1, 2), Math.exp(2) - Math.exp(-1));
});

test("F′ = f for every listed function (numerical check)", () => {
  for (const [key, g] of Object.entries(FUNCS)) {
    for (const x of [-2.5, -1, 0.3, 1.7, 2.9]) {
      const h = 1e-5;
      close((g.F(x + h) - g.F(x - h)) / (2 * h), g.f(x), 1e-6);
      assert.ok(Number.isFinite(exact(key, -3, x)));
    }
  }
});

test("each rule's sum for small n against hand-checked values (x² on [0; 1])", () => {
  close(approximate("sq", 0, 1, 2, "left").sum, 0.5 * (0 + 0.25)); // 0,125
  close(approximate("sq", 0, 1, 2, "right").sum, 0.5 * (0.25 + 1)); // 0,625
  close(approximate("sq", 0, 1, 2, "mid").sum, 0.5 * (0.0625 + 0.5625)); // 0,3125
  close(approximate("sq", 0, 1, 2, "trap").sum, 0.5 * ((0 + 0.25) / 2 + (0.25 + 1) / 2)); // 0,375
  close(approximate("sq", 0, 1, 4, "left").sum, 0.25 * (0 + 1 / 16 + 4 / 16 + 9 / 16)); // 0,21875
  close(approximate("sq", 0, 1, 4, "right").sum, 0.25 * (1 / 16 + 4 / 16 + 9 / 16 + 1)); // 0,46875
  close(approximate("sq", 0, 1, 1, "mid").sum, 0.25);
  close(approximate("sq", 0, 1, 1, "trap").sum, 0.5);
  // trapezoid = mean of left and right
  const l = approximate("exp", -1, 2, 7, "left").sum;
  const r = approximate("exp", -1, 2, 7, "right").sum;
  close(approximate("exp", -1, 2, 7, "trap").sum, (l + r) / 2);
});

test("the error decreases as n grows, and reaches the textbook orders", () => {
  for (const fn of Object.keys(FUNCS)) {
    for (const rule of Object.keys(RULES)) {
      const err = n => Math.abs(approximate(fn, -1, 2.5, n, rule).sum - exact(fn, -1, 2.5));
      let prev = Infinity;
      for (const n of [4, 8, 16, 32, 64]) {
        // exact rules (linear f with midpoint/trapezoid) stay at rounding level
        assert.ok(err(n) < prev || err(n) < 1e-12, `${fn}/${rule}: error must fall at n = ${n}`);
        prev = err(n);
      }
      assert.ok(err(100) < (rule === "left" || rule === "right" ? 0.4 : 2e-3), `${fn}/${rule} at n = 100`);
    }
  }
  // left rule: error ≈ halves when n doubles; midpoint: ≈ quarters
  const e = (rule, n) => Math.abs(approximate("sq", 0, 2, n, rule).sum - 8 / 3);
  close(e("left", 50) / e("left", 100), 2, 0.05);
  close(e("mid", 50) / e("mid", 100), 4, 1e-6);
});

test("midpoint and trapezoid are exact for linear functions", () => {
  for (const n of [1, 2, 3, 17, 100]) {
    close(approximate("lin", -3, 2.4, n, "mid").sum, exact("lin", -3, 2.4));
    close(approximate("lin", -3, 2.4, n, "trap").sum, exact("lin", -3, 2.4));
  }
  assert.ok(Math.abs(approximate("lin", -3, 2.4, 5, "left").sum - exact("lin", -3, 2.4)) > 0.1);
});

test("∫ₐᵇ = −∫ᵇₐ, for the integral and for every rule", () => {
  for (const fn of Object.keys(FUNCS)) {
    close(exact(fn, 2.5, -1.2), -exact(fn, -1.2, 2.5));
    close(approximate(fn, 2.5, -1.2, 9, "trap").sum, -approximate(fn, -1.2, 2.5, 9, "trap").sum);
    close(approximate(fn, 2.5, -1.2, 9, "mid").sum, -approximate(fn, -1.2, 2.5, 9, "mid").sum);
    // left from b to a is right from a to b
    close(approximate(fn, 2.5, -1.2, 9, "left").sum, -approximate(fn, -1.2, 2.5, 9, "right").sum);
    close(exact(fn, 1, 1), 0);
  }
});

test("an interval crossing a root gives the signed total", () => {
  // 4 − x² on [−1; 3]: 9 above the axis on [−1; 2], 7/3 below on [2; 3]
  const r = areas("cap", -1, 3);
  close(r.above, 9);
  close(r.below, 7 / 3);
  close(exact("cap", -1, 3), 20 / 3);
  close(r.above - r.below, exact("cap", -1, 3));
  // sin x on [−π; π]: the halves cancel
  close(exact("sin", -Math.PI, Math.PI), 0);
  close(areas("sin", -Math.PI, Math.PI).above, 2);
  close(areas("sin", -Math.PI, Math.PI).below, 2);
  // x/2 + 1 on [−3; 0]: −1/4 below, 1 above
  close(areas("lin", -3, 0).below, 0.25);
  close(areas("lin", -3, 0).above, 1);
});

test("summary clamps forged state and reports a finite error", () => {
  const r = summary({ fn: "nope", a: -99, b: 1e9, n: -5, rule: "x" });
  assert.equal(r.a, -3);
  assert.equal(r.b, 3);
  assert.equal(r.n, 1);
  assert.equal(r.rule, "mid");
  assert.ok(Number.isFinite(r.error));
  const s = summary(initialState());
  close(s.exact, 20 / 3);
  close(s.error, Math.abs(s.sum - 20 / 3));
});
