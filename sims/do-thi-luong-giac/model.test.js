import test from "node:test";
import assert from "node:assert/strict";
import { initialState, analyze, evaluate, parent, zeros, peakX, piText, formula, phase } from "./model.js";

const PI = Math.PI;
const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const make = over => ({ ...initialState(), ...over });

test("period is 2π/|b| for sin and cos, π/|b| for tan, and the curve really repeats", () => {
  for (const fn of ["sin", "cos", "tan"]) {
    for (const b of [-3, -0.25, 0.5, 1, 2, 2.75]) {
      const s = make({ fn, b, a: 1.5, c: 5, d: -1 });
      const T = analyze(s).period;
      near(T, (fn === "tan" ? PI : 2 * PI) / Math.abs(b));
      for (const x of [-2, 0.3, 1.1]) near(evaluate(s, x + T), evaluate(s, x), 1e-6);
      // T is the smallest period: half of it does not work.
      assert.ok(Math.abs(evaluate(s, 0.3 + T / 2) - evaluate(s, 0.3)) > 1e-3);
    }
  }
});

test("amplitude is |a| and the range is [d − |a|, d + |a|], reached at the predicted peak", () => {
  for (const fn of ["sin", "cos"]) {
    for (const a of [-3, -0.5, 1, 2.25]) {
      const s = make({ fn, a, b: 1.5, c: -7, d: 0.75 });
      const an = analyze(s);
      assert.equal(an.amplitude, Math.abs(a));
      assert.deepEqual(an.range, [0.75 - Math.abs(a), 0.75 + Math.abs(a)]);
      near(evaluate(s, peakX(s)), an.range[1]);
      near(evaluate(s, peakX(s) + an.period / 2), an.range[0]);
      for (let x = -7; x <= 7; x += 0.01) {
        const y = evaluate(s, x);
        assert.ok(y >= an.range[0] - 1e-12 && y <= an.range[1] + 1e-12);
      }
    }
  }
});

test("tan has no amplitude and takes every real value", () => {
  const an = analyze(make({ fn: "tan" }));
  assert.equal(an.amplitude, null);
  assert.deepEqual(an.range, [-Infinity, Infinity]);
});

test("phase shift is −c/b: the curve is the stretched parent moved to x = −c/b", () => {
  const s = initialState(); // 2 sin(2x + π/3) + 1
  near(analyze(s).phaseShift, -PI / 6);
  for (const fn of ["sin", "cos", "tan"]) {
    const t = make({ fn, a: -1.5, b: 0.75, c: 5, d: 0.5 });
    const x0 = analyze(t).phaseShift;
    near(x0, -phase(t) / 0.75);
    for (const x of [-1, 0, 0.4]) near(evaluate(t, x0 + x), -1.5 * parent(fn, 0.75 * x) + 0.5);
  }
  assert.ok(Object.is(analyze(make({ c: 0 })).phaseShift, 0)); // never −0
  assert.equal(analyze(make({ d: -2 })).verticalShift, -2);
});

test("zeros of the sine form are at x = (kπ − c)/b when d = 0", () => {
  const s = make({ a: 2, b: 2, c: 4, d: 0 });
  const got = zeros(s, -2 * PI, 2 * PI);
  const want = [];
  for (let k = -3; k <= 4; k++) want.push((k * PI - PI / 3) / 2);
  assert.equal(got.length, want.length);
  got.forEach((x, i) => near(x, want[i]));
});

test("zeros with a vertical shift: all of them, and only them, in the interval", () => {
  for (const fn of ["sin", "cos", "tan"]) {
    const s = make({ fn, a: 2, b: 1.5, c: -3, d: 1 });
    const found = zeros(s, -6, 6);
    for (const x of found) near(evaluate(s, x), 0, 1e-9);
    // count sign changes by brute force (skipping the jumps of tan)
    let crossings = 0;
    for (let x = -6; x < 6; x += 0.001) {
      const y1 = evaluate(s, x);
      const y2 = evaluate(s, x + 0.001);
      if (y1 * y2 < 0 && Math.abs(y1 - y2) < 1) crossings++;
    }
    assert.equal(found.length, crossings);
  }
  assert.deepEqual(zeros(make({ a: 1, d: 2 }), -10, 10), []); // |d| > |a|: never zero
  assert.equal(zeros(make({ a: 2, b: 1, c: 0, d: 2 }), -7, 7).length, 2); // tangent to Ox: double roots counted once
});

test("b = 0 or a = 0 is a constant function", () => {
  const s = make({ b: 0, a: 2, c: 2, d: 1 }); // 2 sin(π/6) + 1 = 2
  const an = analyze(s);
  assert.equal(an.constant, true);
  near(an.value, 2);
  assert.equal(an.period, null);
  assert.equal(an.phaseShift, null);
  assert.equal(an.amplitude, 0);
  near(an.range[0], 2);
  near(an.range[1], 2);
  for (const x of [-5, 0, 3]) near(evaluate(s, x), 2);
  assert.deepEqual(zeros(s, -10, 10), []);

  const flat = analyze(make({ a: 0, d: -1.5 }));
  assert.equal(flat.constant, true);
  assert.equal(flat.value, -1.5);
  assert.deepEqual(flat.range, [-1.5, -1.5]);

  // tan(π/2) does not exist: reported as undefined, not as a huge number
  const bad = analyze(make({ fn: "tan", b: 0, c: 6 }));
  assert.equal(bad.value, null);
  assert.equal(bad.range, null);
  assert.equal(evaluate(make({ fn: "tan", b: 1, c: 0 }), PI / 2), null);
});

test("multiples of π are written exactly", () => {
  assert.equal(piText(0), "0");
  assert.equal(piText(PI), "π");
  assert.equal(piText(-PI / 2), "−π/2");
  assert.equal(piText((3 * PI) / 4), "3π/4");
  assert.equal(piText(-2 * PI), "−2π");
  assert.equal(piText((8 * PI) / 11), "8π/11");
  assert.equal(piText(1), null);
  // every period and phase shift the sliders can produce is exact
  for (let m = -12; m <= 12; m++) {
    if (m === 0) continue;
    for (let c = -12; c <= 12; c++) {
      const an = analyze(make({ b: m / 4, c }));
      assert.notEqual(piText(an.period), null);
      assert.notEqual(piText(an.phaseShift), null);
    }
  }
});

test("formula text", () => {
  assert.equal(formula(initialState()), "y = 2sin(2x + π/3) + 1");
  assert.equal(formula(make({ a: 1, b: 1, c: 0, d: 0 })), "y = sin x");
  assert.equal(formula(make({ fn: "cos", a: -1, b: -1, c: -6, d: -0.5 })), "y = −cos(−x − π/2) − 0,5");
  assert.equal(formula(make({ fn: "tan", a: 1.5, b: 2, c: 0, d: 0 })), "y = 1,5tan 2x");
  assert.equal(formula(make({ a: 0, d: -2 })), "y = −2");
  assert.equal(formula(make({ a: 1, b: 0, c: 2, d: 0 })), "y = sin π/6");
});
