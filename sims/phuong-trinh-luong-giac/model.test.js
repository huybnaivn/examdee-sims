import test from "node:test";
import assert from "node:assert/strict";
import { FORMS, INTERVALS, PRESETS, initialState, f, families, hasSolution, circleAngles, solutions, count, general, piText, angleText, intervalText, aLabel, isCorrect, newQuestion } from "./model.js";

const PI = Math.PI;
const R3 = Math.sqrt(3);
const close = (u, v, eps = 1e-9) => Math.abs(u - v) < eps;
const lines = (form, a, unit) => general(form, a, unit).lines;

test("general solution of sin x = a, with the special values", () => {
  assert.deepEqual(lines("sin", 0.5), ["x = π/6 + k2π", "x = 5π/6 + k2π"]);
  assert.deepEqual(lines("sin", -R3 / 2), ["x = −π/3 + k2π", "x = 4π/3 + k2π"]);
  assert.deepEqual(lines("sin", 1), ["x = π/2 + k2π"]);
  assert.deepEqual(lines("sin", -1), ["x = −π/2 + k2π"]);
  assert.deepEqual(lines("sin", 0), ["x = kπ"]);
  const g = general("sin", 0.3);
  assert.deepEqual(g.lines, ["x = α + k2π", "x = π − α + k2π"]);
  assert.equal(g.note, "với sin α = 0,3, α ≈ 0,305 rad");
});

test("general solution of cos x = a, with the special values", () => {
  assert.deepEqual(lines("cos", 0.5), ["x = π/3 + k2π", "x = −π/3 + k2π"]);
  assert.deepEqual(lines("cos", -Math.SQRT2 / 2), ["x = 3π/4 + k2π", "x = −3π/4 + k2π"]);
  assert.deepEqual(lines("cos", 1), ["x = k2π"]);
  assert.deepEqual(lines("cos", -1), ["x = π + k2π"]);
  assert.deepEqual(lines("cos", 0), ["x = π/2 + kπ"]);
  assert.deepEqual(lines("cos", 0.3), ["x = α + k2π", "x = −α + k2π"]);
});

test("general solution of tan x = a and cot x = a", () => {
  assert.deepEqual(lines("tan", 1), ["x = π/4 + kπ"]);
  assert.deepEqual(lines("tan", -R3), ["x = −π/3 + kπ"]);
  assert.deepEqual(lines("tan", 0), ["x = kπ"]);
  assert.deepEqual(lines("cot", R3), ["x = π/6 + kπ"]);
  assert.deepEqual(lines("cot", 0), ["x = π/2 + kπ"]);
  assert.deepEqual(lines("cot", -1), ["x = 3π/4 + kπ"]);
  assert.deepEqual(lines("tan", 2), ["x = α + kπ"]);
  assert.equal(general("tan", 1).condition, "x ≠ π/2 + kπ");
  assert.equal(general("cot", 1, "deg").condition, "x ≠ k180°");
});

test("|a| > 1 has no solution for sin and cos, but tan and cot always have one", () => {
  for (const a of [1.05, -1.05, 2, -2]) {
    for (const form of ["sin", "cos"]) {
      assert.equal(hasSolution(form, a), false);
      assert.equal(general(form, a).none, true);
      assert.equal(solutions(form, a, "-2pi..2pi").length, 0);
      assert.deepEqual(circleAngles(form, a), []);
    }
    for (const form of ["tan", "cot"]) assert.equal(hasSolution(form, a), true);
  }
  assert.equal(general("sin", 1.5).note, "Vô nghiệm vì |a| = 1,5 > 1");
  assert.equal(hasSolution("sin", 1), true);
  assert.equal(hasSolution("cos", -1), true);
});

test("every listed solution lies in the interval and satisfies the equation", () => {
  const values = [...PRESETS.filter(p => p.a !== null).map(p => p.a), 0.3, -0.6, 1.5, -2, 0.05];
  for (const form of FORMS) {
    for (const a of values) {
      for (const [key, [lo, hi]] of Object.entries(INTERVALS)) {
        for (const { x } of solutions(form, a, key)) {
          assert.ok(x >= (lo * PI) / 12 - 1e-9 && x <= (hi * PI) / 12 + 1e-9, `${form} ${a} ${key}`);
          assert.ok(close(f(form, x), a, 1e-7), `${form} x = ${a} at ${x}`);
        }
      }
    }
  }
});

test("the list is complete: it matches a brute-force count of the crossings", () => {
  // Generic values of a (no tangency, no solution on an endpoint), so sign changes count every root.
  for (const form of FORMS) {
    for (const a of [0.3, -0.6, 0.8]) {
      for (const [key, [lo, hi]] of Object.entries(INTERVALS)) {
        let crossings = 0;
        const n = 20000;
        const at = i => (lo * PI) / 12 + (((hi - lo) * PI) / 12) * (i / n);
        for (let i = 0; i < n; i++) {
          const u = f(form, at(i)) - a;
          const v = f(form, at(i + 1)) - a;
          if (u * v < 0 && Math.abs(u - v) < 1) crossings++; // a jump across an asymptote is not a root
        }
        assert.equal(solutions(form, a, key).length, crossings, `${form} x = ${a} on ${key}`);
      }
    }
  }
});

test("known counts, endpoints included", () => {
  assert.deepEqual(solutions("sin", 0.5, "0..2pi").map(s => s.n12), [2, 10]);
  assert.deepEqual(solutions("sin", 0, "0..2pi").map(s => s.n12), [0, 12, 24]);
  assert.deepEqual(solutions("sin", 0, "-2pi..2pi").map(s => s.n12), [-24, -12, 0, 12, 24]);
  assert.deepEqual(solutions("cos", 1, "-2pi..2pi").map(s => s.n12), [-24, 0, 24]);
  assert.deepEqual(solutions("cos", 0.5, "-pi..pi").map(s => s.n12), [-4, 4]);
  assert.deepEqual(solutions("tan", 1, "0..2pi").map(s => s.n12), [3, 15]);
  assert.deepEqual(solutions("cot", R3, "-2pi..0").map(s => s.n12), [-22, -10]);
  assert.deepEqual(solutions("sin", 1, "0..pi").map(s => s.n12), [6]);
  assert.equal(count({ form: "tan", a: 0, interval: "-pi/2..pi/2" }), 1);
});

test("solutions worked out in degrees agree with those in radians", () => {
  for (const form of FORMS) {
    for (const a of [0.5, -R3 / 2, 0.3, 1, 0, -1.7]) {
      for (const key of Object.keys(INTERVALS)) {
        const rad = solutions(form, a, key, "rad");
        const deg = solutions(form, a, key, "deg");
        assert.equal(deg.length, rad.length);
        rad.forEach((r, i) => {
          assert.ok(close((deg[i].x * PI) / 180, r.x, 1e-9));
          assert.equal(deg[i].n12, r.n12);
        });
      }
    }
  }
  assert.deepEqual(lines("sin", 0.5, "deg"), ["x = 30° + k360°", "x = 150° + k360°"]);
  assert.deepEqual(lines("tan", -1, "deg"), ["x = −45° + k180°"]);
  assert.deepEqual(lines("sin", 0.3, "deg"), ["x = α + k360°", "x = 180° − α + k360°"]);
  assert.equal(general("sin", 0.3, "deg").note, "với sin α = 0,3, α ≈ 17,46°");
  assert.deepEqual(solutions("sin", 0.5, "0..2pi", "deg").map(s => Math.round(s.x)), [30, 150]);
});

test("points on the unit circle satisfy the equation", () => {
  assert.equal(circleAngles("sin", 0.5).length, 2);
  assert.equal(circleAngles("sin", 1).length, 1);
  assert.equal(circleAngles("cos", 0).length, 2);
  assert.equal(circleAngles("tan", 2).length, 2);
  for (const form of FORMS) for (const t of circleAngles(form, 0.4)) assert.ok(close(f(form, t), 0.4, 1e-9));
  const [t1, t2] = circleAngles("tan", 1.2);
  assert.ok(close(t2 - t1, PI)); // the two points are diametrically opposite
});

test("text helpers", () => {
  assert.equal(piText(0), "0");
  assert.equal(piText(12), "π");
  assert.equal(piText(-24), "−2π");
  assert.equal(piText(10), "5π/6");
  assert.equal(piText(18), "3π/2");
  assert.equal(angleText(PI / 4), "π/4");
  assert.equal(angleText(PI / 4, "deg"), "45°");
  assert.equal(angleText(1), "1");
  assert.equal(intervalText("-pi/2..pi/2"), "[−π/2; π/2]");
  assert.equal(intervalText("0..2pi", "deg"), "[0°; 360°]");
  assert.equal(aLabel(R3 / 2), "√3/2");
  assert.equal(aLabel(-R3 / 3), "−√3/3");
  assert.equal(aLabel(-0.35), "−0,35");
});

test("practice: counting check and new questions", () => {
  const s = { ...initialState(), answer: 2 };
  assert.equal(isCorrect(s), true);
  assert.equal(isCorrect({ ...s, answer: 3 }), false);
  assert.equal(isCorrect({ ...s, answer: 2.5 }), false);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 300; i++) {
    newQuestion(s, rnd);
    assert.ok(FORMS.includes(s.form) && s.interval in INTERVALS && Math.abs(s.a) <= 2);
    assert.ok(count(s) >= 0 && count(s) <= 9); // fits the answer stepper
    assert.equal(s.status, "");
  }
  // forged values do not break the model
  assert.equal(count({ form: "x", a: NaN, interval: "?" }), 3); // read as sin x = 0 on [0; 2π]
});
