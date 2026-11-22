import test from "node:test";
import assert from "node:assert/strict";
import { initialState, normalize, angles, anglesAt, isParallel, relation, PAIRS, dirA } from "./model.js";

const cases = [];
for (let c = 60; c <= 120; c += 15) for (let a1 = 30; a1 <= 150; a1 += 20) for (let b1 = 30; b1 <= 150; b1 += 20) cases.push({ ...initialState(), c, a1, b1 });

test("angle values follow from the line directions", () => {
  // horizontal right ray, vertical c: four right angles
  assert.deepEqual(anglesAt(0, 90), [90, 90, 90, 90]);
  // right ray at 20°, c at 80°: Â₁ = 60°, Â₂ = 120°
  assert.deepEqual(anglesAt(20, 80), [60, 120, 60, 120]);
  for (const s of cases) {
    const g = angles(s);
    assert.equal(g.A[0], s.a1);
    assert.equal(g.B[0], s.b1);
    assert.equal(s.c - dirA(s), s.a1);
    for (const v of [...g.A, ...g.B]) assert.ok(v > 0 && v < 180);
  }
});

test("vertical angles are equal and adjacent angles add up to 180°", () => {
  for (const s of cases) {
    for (const v of Object.values(angles(s))) {
      assert.equal(v[0], v[2]);
      assert.equal(v[1], v[3]);
      for (let i = 0; i < 4; i++) assert.equal(v[i] + v[(i + 1) % 4], 180);
      assert.equal(v.reduce((x, y) => x + y), 360);
    }
    for (const key of ["dd1", "dd2", "kb1", "kb2"]) assert.ok(relation(s, key).holds);
  }
});

test("alternate interior and corresponding angles are equal iff a ∥ b", () => {
  let parallelSeen = 0;
  for (const s of cases) {
    const par = isParallel(s);
    parallelSeen += par;
    assert.equal(par, s.a1 === s.b1);
    for (const key of ["slt1", "slt2", "dv1", "dv2", "dv3", "dv4"]) assert.equal(relation(s, key).holds, par, `${key} ${JSON.stringify(s)}`);
  }
  assert.ok(parallelSeen > 0);
});

test("co-interior angles add up to 180° iff a ∥ b", () => {
  for (const s of cases) {
    for (const key of ["tcp1", "tcp2"]) {
      const r = relation(s, key);
      assert.equal(r.holds, isParallel(s));
      assert.equal(r.v1 + r.v2 === 180, s.a1 === s.b1);
    }
  }
});

test("pairs name the right angles", () => {
  const s = { ...initialState(), c: 90, a1: 70, b1: 70 };
  assert.deepEqual([relation(s, "slt1").v1, relation(s, "slt1").v2], [70, 70]);
  assert.deepEqual([relation(s, "tcp1").v1, relation(s, "tcp1").v2], [110, 70]);
  assert.equal(Object.keys(PAIRS).length, 12);
});

test("forged states are clamped", () => {
  const s = normalize({ ...initialState(), c: 500, a1: -20, b1: NaN, pair: "x" });
  assert.deepEqual([s.c, s.a1, s.b1, s.pair], [120, 30, initialState().b1, initialState().pair]);
});
