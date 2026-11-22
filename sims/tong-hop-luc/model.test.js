import test from "node:test";
import assert from "node:assert/strict";
import { initialState, vec, sum, parallelogram, angleBetween, lab, hang, symmetricTension, tolerance } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const sinD = d => Math.sin((d * Math.PI) / 180);

test("parallelogram rule agrees with adding components", () => {
  for (const [F1, F2, d1, d2] of [[3, 4, 0, 90], [6, 6, 45, 135], [5, 2, 10, 170], [7, 7, 30, 30], [8, 3, 20, 200]]) {
    const r = sum([vec(F1, d1), vec(F2, d2)]);
    near(r.mag, parallelogram(F1, F2, angleBetween(d1, d2)));
  }
  near(parallelogram(3, 4, 90), 5);
  near(parallelogram(3, 4, 0), 7); // same direction: F1 + F2
  near(parallelogram(3, 4, 180), 1); // opposite: |F1 − F2|
  near(angleBetween(350, 10), 20);
});

test("the ring balances exactly when the vector sum is zero", () => {
  const P = 10;
  const { t1, t2 } = hang(P, 45, 45); // strings at 135° and 45°
  const s = { ...initialState(), weight: P, a1: 135, a2: 45, f1: t1, f2: t2 };
  near(lab(s).net.mag, 0, 1e-12);
  assert.equal(lab(s).balanced, true);
  assert.equal(lab({ ...s, f1: t1 + 0.5 }).balanced, false);
  assert.equal(lab({ ...s, a2: 50 }).balanced, false);
  // the starting picture is not balanced (6 N + 6 N at 45° hold only 8,49 N)
  const start = lab(initialState());
  assert.equal(start.balanced, false);
  near(start.net.y, 12 * sinD(45) - 10);
  // three strings: a balanced set, with the weight shared
  const three = { ...initialState(), count: 3, weight: 12, a1: 150, a2: 30, a3: 90, f1: 4, f2: 4, f3: 8 };
  assert.equal(lab(three).balanced, true);
  assert.equal(lab({ ...three, count: 2 }).balanced, false);
  // whole-degree and 0,1 N steps can reach the balance (sliders' resolution)
  const rounded = { ...s, f1: Math.round(t1 * 10) / 10, f2: Math.round(t2 * 10) / 10 };
  assert.ok(lab(rounded).net.mag <= tolerance(P));
});

test("symmetric hang: T = P / (2cos(θ/2))", () => {
  for (const b of [5, 20, 30, 45, 60]) {
    const h = hang(100, b, b);
    near(h.t1, h.t2);
    near(h.t1, symmetricTension(100, h.theta));
    near(h.t1, 100 / (2 * sinD(b)));
  }
  near(symmetricTension(10, 120), 10); // 120° between the cables: each holds the whole weight
  near(symmetricTension(10, 0), 5);
});

test("tension grows without bound as the cables approach horizontal", () => {
  let last = 0;
  for (const b of [60, 30, 10, 5, 2, 1, 0.1]) {
    const t = hang(10, b, b).t1;
    assert.ok(t > last);
    last = t;
  }
  assert.ok(hang(10, 1, 1).t1 > 250);
  assert.ok(hang(10, 0.01, 0.01).t1 > 1e4);
});

test("three-force equilibrium follows Lami's theorem", () => {
  for (const [P, b1, b2] of [[10, 20, 50], [35, 5, 60], [8, 45, 15]]) {
    const h = hang(P, b1, b2);
    // forces sum to zero
    const net = sum([vec(h.t1, h.dir1), vec(h.t2, h.dir2), vec(P, 270)]);
    near(net.mag, 0, 1e-9);
    // each force over the sine of the angle between the other two is the same
    const k1 = h.t1 / sinD(angleBetween(h.dir2, 270));
    const k2 = h.t2 / sinD(angleBetween(h.dir1, 270));
    const k3 = P / sinD(angleBetween(h.dir1, h.dir2));
    near(k1, k3);
    near(k2, k3);
    // the steeper cable carries more
    assert.ok(b1 > b2 ? h.t1 > h.t2 : h.t2 > h.t1);
  }
});
