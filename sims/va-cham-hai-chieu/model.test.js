import test from "node:test";
import assert from "node:assert/strict";
import { initialState, R, setup, collide, before, after, at, angleBetween, collisionTime, endTime, extent } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const make = over => ({ ...initialState(), ...over });
const CASES = [
  {},
  { m1: 2, m2: 0.5, v1x: 3, v1y: 1, v2x: -1, v2y: 2, offset: -0.3, restitution: 0.6 },
  { m1: 0.5, m2: 5, v1x: -2, v1y: -4, v2x: 1.5, v2y: 0, offset: 0.7, restitution: 0 },
  { m1: 3, m2: 3, v1x: 0, v1y: 2.5, v2x: 0, v2y: -2.5, offset: 0.1, restitution: 0.25 },
  { m1: 1, m2: 4, v1x: 0, v1y: 0, v2x: -3, v2y: 3, offset: 0, restitution: 1 },
];

test("the total momentum vector is conserved for every e and offset", () => {
  for (const c of CASES) {
    const s = make(c);
    const b = before(s);
    const a = after(s);
    assert.ok(a);
    near(a.px, b.px);
    near(a.py, b.py);
    near(a.p, b.p);
  }
});

test("kinetic energy is conserved if and only if the collision is elastic", () => {
  for (const c of CASES) {
    for (const e of [0, 0.3, 0.8, 1]) {
      const s = make({ ...c, restitution: e });
      const lost = before(s).k - after(s).k;
      if (e === 1) near(lost, 0);
      else assert.ok(lost > 1e-6, `e = ${e} must lose energy`);
    }
    const loss = e => before(make({ ...c, restitution: e })).k - after(make({ ...c, restitution: e })).k;
    assert.ok(loss(0) > loss(0.5) && loss(0.5) > loss(0.9)); // the smaller e, the more is lost
  }
});

test("along the line of centres the separation speed is e times the approach speed; across it nothing changes", () => {
  for (const c of CASES) {
    const s = make(c);
    const g = setup(s);
    const a = after(s);
    near(Math.hypot(g.nx, g.ny), 1);
    const approach = (s.v1x - s.v2x) * g.nx + (s.v1y - s.v2y) * g.ny;
    assert.ok(approach > 0);
    near((a.v2x - a.v1x) * g.nx + (a.v2y - a.v1y) * g.ny, s.restitution * approach);
    for (const [bx, by, ax, ay] of [[s.v1x, s.v1y, a.v1x, a.v1y], [s.v2x, s.v2y, a.v2x, a.v2y]]) {
      near(-ax * g.ny + ay * g.nx, -bx * g.ny + by * g.nx);
    }
  }
});

test("equal masses, elastic, one at rest, glancing: the pucks leave at 90° to each other", () => {
  for (const offset of [-0.7, -0.2, 0.15, 0.4, 0.75]) {
    for (const [v1x, v1y] of [[3, 0], [-2, 1.5]]) {
      const a = after(make({ m1: 2, m2: 2, v1x, v1y, v2x: 0, v2y: 0, restitution: 1, offset }));
      near(angleBetween(a.v1x, a.v1y, a.v2x, a.v2y), 90, 1e-9);
    }
  }
  // the initial picture is this case: b = R gives 60° and 30° either side of the incoming direction
  const a = after(initialState());
  near(angleBetween(a.v1x, a.v1y, 3, 0), 60, 1e-9);
  near(angleBetween(a.v2x, a.v2y, 3, 0), 30, 1e-9);
  // unequal masses or an inelastic collision do not give 90°
  const heavy = after(make({ m1: 3, m2: 1 }));
  assert.ok(Math.abs(angleBetween(heavy.v1x, heavy.v1y, heavy.v2x, heavy.v2y) - 90) > 1);
  const soft = after(make({ restitution: 0.5 }));
  assert.ok(Math.abs(angleBetween(soft.v1x, soft.v1y, soft.v2x, soft.v2y) - 90) > 1);
});

test("a head-on collision (b = 0) reduces to the one-dimensional formulas", () => {
  for (const [m1, v1, m2, v2, e] of [[2, 3, 1, -1, 1], [1, 4, 3, 0, 0.5], [0.5, 2, 5, -3, 0]]) {
    const a = after(make({ m1, m2, v1x: v1, v1y: 0, v2x: v2, v2y: 0, restitution: e, offset: 0 }));
    const total = m1 * v1 + m2 * v2;
    near(a.v1x, (total - m2 * e * (v1 - v2)) / (m1 + m2));
    near(a.v2x, (total + m1 * e * (v1 - v2)) / (m1 + m2));
    near(a.v1y, 0);
    near(a.v2y, 0);
  }
  // elastic: v1' = ((m1 − m2)·v1 + 2·m2·v2)/(m1 + m2); equal masses swap velocities
  const a = after(make({ m1: 2, m2: 1, v1x: 3, v1y: 0, v2x: -1, v2y: 0, restitution: 1, offset: 0 }));
  near(a.v1x, ((2 - 1) * 3 + 2 * 1 * -1) / 3);
  near(a.v2x, ((1 - 2) * -1 + 2 * 2 * 3) / 3);
  const swap = after(make({ v1x: 2, v1y: 1, v2x: -1, v2y: -0.5, offset: 0 }));
  near(swap.v1x, -1);
  near(swap.v1y, -0.5);
  near(swap.v2x, 2);
  near(swap.v2y, 1);
  // perfectly inelastic head-on: both leave with the velocity of the centre of mass
  const stuck = after(make({ m1: 1, m2: 3, v1x: 4, v1y: 0, v2x: 0, v2y: 0, restitution: 0, offset: 0 }));
  near(stuck.v1x, 1);
  near(stuck.v2x, 1);
});

test("pucks that miss do not interact", () => {
  for (const c of [{ offset: 0.8 }, { offset: -1 }, { v1x: 1, v1y: 1, v2x: 1, v2y: 1 }, { v1x: 0, v1y: 0, v2x: 0, v2y: 0 }]) {
    const s = make(c);
    assert.equal(after(s), null);
    assert.equal(collisionTime(s), Infinity);
    assert.ok(Number.isFinite(endTime(s)));
    let closest = Infinity;
    for (let t = 0; t <= endTime(s); t += 0.01) {
      const p = at(s, t);
      assert.equal(p.collided, false);
      near(p.v1x, s.v1x);
      near(p.v2y, s.v2y);
      closest = Math.min(closest, Math.hypot(p.x1 - p.x2, p.y1 - p.y2));
    }
    assert.ok(closest >= 2 * R - 1e-9, "pucks must never overlap");
    if (c.offset) assert.ok(Math.abs(closest - Math.abs(c.offset)) < 1e-3); // they pass at the chosen offset
  }
});

test("the pucks touch exactly at the collision time, never overlap, and the path is continuous", () => {
  for (const c of CASES) {
    const s = make(c);
    const tc = collisionTime(s);
    assert.ok(tc > 0 && tc < endTime(s));
    const p = at(s, tc);
    near(Math.hypot(p.x1 - p.x2, p.y1 - p.y2), 2 * R);
    const g = setup(s);
    near((p.x2 - p.x1) / (2 * R), g.nx);
    near((p.y2 - p.y1) / (2 * R), g.ny);
    // centre of mass at the origin at contact
    near((s.m1 * p.x1 + s.m2 * p.x2) / (s.m1 + s.m2), 0);
    near((s.m1 * p.y1 + s.m2 * p.y2) / (s.m1 + s.m2), 0);
    const just = at(s, tc + 1e-7);
    assert.equal(just.collided, true);
    near(just.x1, p.x1, 1e-5);
    near(just.y2, p.y2, 1e-5);
    for (let t = 0; t <= endTime(s); t += 0.01) {
      const q = at(s, t);
      assert.ok(Math.hypot(q.x1 - q.x2, q.y1 - q.y2) >= 2 * R - 1e-9, `overlap at t = ${t}`);
    }
  }
});

test("the centre of mass moves uniformly through the collision", () => {
  const s = make(CASES[1]);
  const b = before(s);
  const cm = t => {
    const p = at(s, t);
    return [(s.m1 * p.x1 + s.m2 * p.x2) / (s.m1 + s.m2), (s.m1 * p.y1 + s.m2 * p.y2) / (s.m1 + s.m2)];
  };
  const [x0, y0] = cm(0);
  for (const t of [0.5, collisionTime(s), endTime(s)]) {
    near(cm(t)[0], x0 + (b.px / (s.m1 + s.m2)) * t);
    near(cm(t)[1], y0 + (b.py / (s.m1 + s.m2)) * t);
  }
});

test("initial state is a finished run; forged time is clamped; extent covers the run", () => {
  const s = initialState();
  assert.equal(s.time, endTime(s));
  assert.equal(at(s, s.time).collided, true);
  assert.equal(at(s, 1e9).time, endTime(s));
  assert.equal(at(s, -5).time, 0);
  assert.equal(at(s, NaN).time, 0);
  const box = extent(s);
  for (let t = 0; t <= endTime(s); t += 0.05) {
    const p = at(s, t);
    for (const [x, y] of [[p.x1, p.y1], [p.x2, p.y2]]) {
      assert.ok(x - R >= box.minX - 1e-9 && x + R <= box.maxX + 1e-9 && y - R >= box.minY - 1e-9 && y + R <= box.maxY + 1e-9);
    }
  }
  assert.ok(Number.isNaN(angleBetween(0, 0, 1, 0)));
  near(angleBetween(1, 0, -1, 0), 180);
});
