import test from "node:test";
import assert from "node:assert/strict";
import { initialState, deg, angleAt, arcAway, measures, snapDiameter, onCcwArc, ccw } from "./model.js";

const close = (x, y, msg) => assert.ok(Math.abs(x - y) < 1e-9, `${msg}: ${x} vs ${y}`);

// every triple of distinct whole-degree positions on a 10° grid, offset so nothing is special
const triples = function* () {
  for (let a = 3; a < 360; a += 10) for (let b = 7; b < 360; b += 10) for (let c = 1; c < 360; c += 10) yield [a, b, c];
};

test("inscribed angle is half the arc it intercepts, which is the central angle on the same arc", () => {
  const m = measures(initialState());
  close(m.inscribed, 70, "initial ∠ACB");
  assert.equal(m.arc, 140);
  assert.equal(m.central, 140);
  for (const [a, b, c] of triples()) {
    if (a === b) continue;
    close(angleAt(a, c, b), arcAway(a, b, c) / 2, `A=${a} B=${b} C=${c}`);
  }
});

test("C on the minor arc: the inscribed angle is obtuse, half of the major arc", () => {
  const m = measures({ a: 0, b: 100, c: 50, d: 200 });
  assert.equal(m.arc, 260);
  close(m.inscribed, 130, "∠ACB");
  assert.equal(m.central, 100); // ∠AOB itself; the arc is 360° − 100°
});

test("inscribed angles on the same arc are equal; on opposite arcs they sum to 180° (cyclic quadrilateral)", () => {
  for (const [a, b, c] of triples()) {
    if (a === b) continue;
    for (const d of [2, 95, 181, 274]) {
      if (d === a || d === b) continue;
      const m = measures({ a, b, c, d });
      if (m.sameSide) close(m.inscribed, m.second, `same arc ${a} ${b} ${c} ${d}`);
      else close(m.inscribed + m.second, 180, `ACBD ${a} ${b} ${c} ${d}`);
    }
  }
  // quadrilateral ABCD inscribed in the circle: both pairs of opposite angles sum to 180°
  const [A, B, C, D] = [10, 80, 170, 260];
  close(angleAt(D, A, B) + angleAt(B, C, D), 180, "∠A + ∠C");
  close(angleAt(A, B, C) + angleAt(C, D, A), 180, "∠B + ∠D");
});

test("an angle inscribed in a semicircle is a right angle", () => {
  for (let a = 0; a < 360; a += 7)
    for (let c = 1; c < 360; c += 13) {
      const b = deg(a + 180);
      if (c === a || c === b) continue;
      const m = measures({ a, b, c, d: 0 });
      assert.ok(m.diameter);
      close(m.inscribed, 90, `A=${a} C=${c}`);
    }
});

test("tangent–chord angle is half the intercepted arc and equals the inscribed angle", () => {
  for (const [a, b, c] of triples()) {
    if (a === b) continue;
    const m = measures({ a, b, c, d: 0 });
    close(m.tangentChord, m.arc / 2, `A=${a} B=${b} C=${c}`);
  }
});

test("A and B snap to a diameter within 2°, and positions are whole degrees", () => {
  assert.equal(snapDiameter(198, 20), 200);
  assert.equal(snapDiameter(202, 20), 200);
  assert.equal(snapDiameter(203, 20), 203);
  assert.equal(snapDiameter(1, 179), 359);
  assert.equal(deg(361.4), 1);
  assert.equal(deg(-0.6), 359);
  assert.equal(deg(NaN), 0);
  assert.ok(onCcwArc(350, 20, 5) && !onCcwArc(20, 350, 5));
  assert.equal(ccw(350, 20), 30);
});

test("coincident points give no angle instead of a wrong number", () => {
  const m = measures({ a: 30, b: 30, c: 30, d: 30 });
  assert.ok(Number.isNaN(m.inscribed) && Number.isNaN(m.arc) && Number.isNaN(m.second));
});
