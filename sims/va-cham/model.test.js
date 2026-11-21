import test from "node:test";
import assert from "node:assert/strict";
import { initialState, CART, X1, X2, collide, quantities, collisionTime, endTime, before, after, at, extent } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const make = over => ({ ...initialState(), ...over });

const MASSES = [0.5, 1, 2.5, 5];
const SPEEDS = [-4, -1.5, 0, 0.5, 4];
const RESTITUTIONS = [0, 0.25, 0.5, 0.85, 1];
function* cases() {
  for (const m1 of MASSES) for (const m2 of MASSES) for (const v1 of SPEEDS) for (const v2 of SPEEDS) for (const e of RESTITUTIONS) {
    if (v1 > v2) yield make({ m1, m2, v1, v2, restitution: e });
  }
}

test("total momentum is conserved for every restitution value", () => {
  for (const s of cases()) near(after(s).p, before(s).p);
});

test("kinetic energy is conserved only when elastic; otherwise some is lost, most when e = 0", () => {
  for (const s of cases()) {
    const lost = before(s).k - after(s).k;
    if (s.restitution === 1) near(lost, 0);
    else assert.ok(lost > 1e-9, `no loss at e = ${s.restitution}`);
    // loss = ½·μ·(1 − e²)·(v1 − v2)², μ the reduced mass
    const mu = (s.m1 * s.m2) / (s.m1 + s.m2);
    near(lost, 0.5 * mu * (1 - s.restitution ** 2) * (s.v1 - s.v2) ** 2);
    assert.ok(lost <= before(s).k - after({ ...s, restitution: 0 }).k + 1e-9);
  }
});

test("separation speed = e × approach speed", () => {
  for (const s of cases()) near(after(s).v2 - after(s).v1, s.restitution * (s.v1 - s.v2));
});

test("perfectly inelastic: both carts move together at (m₁v₁ + m₂v₂)/(m₁ + m₂)", () => {
  for (const s of cases()) {
    if (s.restitution !== 0) continue;
    const v = (s.m1 * s.v1 + s.m2 * s.v2) / (s.m1 + s.m2);
    near(after(s).v1, v);
    near(after(s).v2, v);
    const late = at(s, collisionTime(s) + 1.5);
    near(late.x2 - late.x1, CART); // still touching
  }
  near(collide(2, 3, 1, 0, 0).v1, 2);
});

test("elastic, equal masses: the carts exchange velocities", () => {
  for (const [v1, v2] of [[3, 0], [2, -2], [4, 1.5], [-1, -3]]) {
    const out = collide(1.5, v1, 1.5, v2, 1);
    near(out.v1, v2);
    near(out.v2, v1);
  }
});

test("elastic: a heavy cart hitting a light one at rest keeps going, the light one leaves at almost 2v", () => {
  const out = collide(5, 2, 0.5, 0, 1);
  near(out.v1, (2 * (5 - 0.5)) / 5.5);
  near(out.v2, (2 * 5 * 2) / 5.5);
  assert.ok(out.v1 > 0 && out.v1 < 2);
  assert.ok(out.v2 > 2 && out.v2 < 4);
  // and a light cart bounces back off a heavy one at rest
  const back = collide(0.5, 2, 5, 0, 1);
  assert.ok(back.v1 < 0 && back.v2 > 0 && back.v2 < 2);
});

test("carts moving apart, or at the same velocity, never collide", () => {
  for (const [v1, v2] of [[-1, 1], [0, 0], [2, 2], [-3, -1], [1, 4], [0, 2]]) {
    const s = make({ v1, v2 });
    assert.equal(collisionTime(s), Infinity);
    assert.equal(after(s), null);
    const end = at(s, endTime(s));
    assert.equal(end.collided, false);
    near(end.x1, X1 + v1 * endTime(s));
    near(end.x2, X2 + v2 * endTime(s));
    assert.ok(end.x2 - end.x1 >= CART);
  }
});

test("positions: uniform motion before, contact at the collision time, never overlapping after", () => {
  for (const s of cases()) {
    const tc = collisionTime(s);
    assert.ok(tc > 0 && tc < Infinity);
    const mid = at(s, tc / 2);
    near(mid.x1, X1 + (s.v1 * tc) / 2);
    near(mid.x2, X2 + (s.v2 * tc) / 2);
    assert.equal(mid.collided, false);
    const hit = at(s, tc);
    near(hit.x2 - hit.x1, CART);
    for (const dt of [0.01, 0.5, 2]) {
      const p = at(s, tc + dt);
      assert.equal(p.collided, true);
      assert.ok(p.x2 - p.x1 >= CART - 1e-9);
      near(p.v1, after(s).v1);
      near(p.v2, after(s).v2);
    }
    const box = extent(s);
    for (const t of [0, tc / 3, tc, endTime(s)]) {
      const p = at(s, t);
      assert.ok(p.x1 - CART / 2 >= box.min - 1e-9 && p.x2 + CART / 2 <= box.max + 1e-9);
    }
  }
});

test("the default run: 2 kg at 2 m/s meets 1 kg at −1 m/s with e = 0,5", () => {
  const s = initialState();
  near(collisionTime(s), 1);
  assert.equal(s.time, endTime(s));
  const b = before(s);
  const a = after(s);
  near(b.p, 3);
  near(b.k, 4.5);
  near(a.v1, 0.5);
  near(a.v2, 2);
  near(a.p, 3);
  near(a.k, 2.25);
  assert.deepEqual(quantities(2, 3, 4, -1), { v1: 3, v2: -1, p1: 6, p2: -4, p: 2, k1: 9, k2: 2, k: 11 });
});
