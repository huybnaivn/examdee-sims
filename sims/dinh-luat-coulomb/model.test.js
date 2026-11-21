import test from "node:test";
import assert from "node:assert/strict";
import { initialState, K, force, interaction, forces, scaleForce } from "./model.js";

const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1e-12, Math.abs(b)), `${a} ≠ ${b}`);
const at = (q1, q2, distance) => ({ ...initialState(), q1, q2, distance });

test("F = k·|q1·q2| / r² in SI units", () => {
  assert.equal(K, 9e9);
  // 4 µC and −6 µC, 20 cm apart: 9e9 · 24e-12 / 0.04 = 5.4 N
  near(force(initialState()), 5.4);
  // 1 µC and 1 µC, 1 m apart: 9 mN
  near(force(at(1, 1, 100)), 9e-3);
  for (const q1 of [-10, -2.5, 0.5, 7]) {
    for (const q2 of [-8, -0.5, 3, 10]) {
      for (const cm of [5, 12.5, 30, 50]) {
        near(force(at(q1, q2, cm)), (9e9 * Math.abs(q1 * 1e-6 * q2 * 1e-6)) / (cm / 100) ** 2);
      }
    }
  }
});

test("inverse square: doubling the distance quarters the force", () => {
  for (const cm of [5, 10, 12.5, 25]) {
    near(force(at(3, -7, 2 * cm)), force(at(3, -7, cm)) / 4);
    near(force(at(3, -7, 3 * cm)), force(at(3, -7, cm)) / 9);
  }
});

test("force is proportional to each charge", () => {
  near(force(at(6, 5, 20)), 2 * force(at(3, 5, 20)));
  near(force(at(3, -10, 20)), 2 * force(at(3, -5, 20)));
});

test("the sign of q1·q2 decides attraction or repulsion", () => {
  assert.equal(interaction(at(2, 3, 20)), "repel");
  assert.equal(interaction(at(-2, -3, 20)), "repel");
  assert.equal(interaction(at(2, -3, 20)), "attract");
  assert.equal(interaction(at(-2, 3, 20)), "attract");
  assert.equal(interaction(at(0, 3, 20)), "none");
  assert.equal(interaction(at(2, 0, 20)), "none");
  // charge 1 is on the left: repelled means pushed left (negative), attracted means pulled right
  assert.ok(forces(at(2, 3, 20)).on1 < 0 && forces(at(2, 3, 20)).on2 > 0);
  assert.ok(forces(at(-2, -3, 20)).on1 < 0 && forces(at(-2, -3, 20)).on2 > 0);
  assert.ok(forces(at(2, -3, 20)).on1 > 0 && forces(at(2, -3, 20)).on2 < 0);
  assert.ok(forces(at(-2, 3, 20)).on1 > 0 && forces(at(-2, 3, 20)).on2 < 0);
});

test("the two forces are equal in magnitude and opposite in direction", () => {
  for (const [q1, q2, cm] of [[4, -6, 20], [1, 10, 5], [-0.5, -0.5, 50], [-9, 2, 33.5], [0, 5, 10]]) {
    const s = at(q1, q2, cm);
    const { on1, on2 } = forces(s);
    assert.equal(on1 + on2, 0);
    assert.equal(Math.abs(on1), force(s));
    assert.equal(Math.abs(on2), force(s));
  }
  assert.deepEqual(forces(at(0, 5, 10)), { on1: 0, on2: 0 });
});

test("unit scaling keeps the same physical value", () => {
  assert.deepEqual(scaleForce(0), { value: 0, unit: "N" });
  assert.deepEqual(scaleForce(5.4), { value: 5.4, unit: "N" });
  assert.equal(scaleForce(360).unit, "N");
  near(scaleForce(0.009).value, 9);
  assert.equal(scaleForce(0.009).unit, "mN");
  near(scaleForce(2.5e-5).value, 25);
  assert.equal(scaleForce(2.5e-5).unit, "µN");
  assert.deepEqual(scaleForce(2500), { value: 2.5, unit: "kN" });
  // extremes of the controls
  assert.equal(scaleForce(force(at(10, 10, 5))).unit, "N"); // 360 N
  assert.equal(scaleForce(force(at(0.5, 0.5, 50))).unit, "mN"); // 9 mN
});
