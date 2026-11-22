import test from "node:test";
import assert from "node:assert/strict";
import * as m from "./model.js";

test("angle from the two rays is the smaller turn, 0…180", () => {
  assert.equal(m.angleBetween(0, 55), 55);
  assert.equal(m.angleBetween(55, 0), 55);
  assert.equal(m.angleBetween(350, 20), 30);
  assert.equal(m.angleBetween(10, 190), 180);
  assert.equal(m.angleBetween(0, 270), 90);
  assert.equal(m.angleBetween(123, 123), 0);
  assert.equal(m.angleBetween(-30, 400), 70);
  for (let a = 0; a < 360; a += 7)
    for (let b = 0; b < 360; b += 11) {
      const rad = Math.PI / 180;
      const dot = Math.cos(a * rad) * Math.cos(b * rad) + Math.sin(a * rad) * Math.sin(b * rad);
      assert.ok(Math.abs(m.angleBetween(a, b) - Math.acos(Math.min(1, Math.max(-1, dot))) / rad) < 1e-6);
    }
});

test("classification changes exactly at 90° and 180°", () => {
  assert.equal(m.classify(0), "zero");
  assert.equal(m.classify(1), "acute");
  assert.equal(m.classify(89), "acute");
  assert.equal(m.classify(89.9), "acute");
  assert.equal(m.classify(90), "right");
  assert.equal(m.classify(90.1), "obtuse");
  assert.equal(m.classify(91), "obtuse");
  assert.equal(m.classify(179), "obtuse");
  assert.equal(m.classify(180), "straight");
  assert.deepEqual(Object.keys(m.TYPE_CODE), ["zero", "acute", "right", "obtuse", "straight"]);
});

test("the two scales of one mark add up to 180", () => {
  assert.deepEqual(m.scales(0, 55), { inner: 55, outer: 125 });
  assert.deepEqual(m.scales(30, 30), { inner: 0, outer: 180 });
  assert.deepEqual(m.scales(30, 210), { inner: 180, outer: 0 });
  assert.equal(m.scales(0, 270), null);
});

const at = (dir1, dir2, rot, px = 0, py = 0) => ({ dir1, dir2, rot, px, py });

test("the scale to read is the one whose zero lies on an arm", () => {
  // Ox on the right-hand zero: inner scale
  assert.deepEqual(m.readProtractor(at(0, 55, 0)), { ok: true, scale: "inner", zeroArm: 1, value: 55 });
  // Ox points left and lies on the other zero: outer scale
  assert.deepEqual(m.readProtractor(at(180, 45, 0)), { ok: true, scale: "outer", zeroArm: 1, value: 135 });
  // zero on Oy instead of Ox
  assert.deepEqual(m.readProtractor(at(0, 55, 55 - 180)), { ok: true, scale: "outer", zeroArm: 2, value: 55 });
  assert.deepEqual(m.readProtractor(at(70, 20, 20)), { ok: true, scale: "inner", zeroArm: 2, value: 50 });
  // reading the wrong scale would give the supplement
  const r = m.readProtractor(at(180, 45, 0));
  assert.equal(m.scales(0, 45).inner, 180 - r.value);
  // whenever a reading exists it equals the angle
  for (let d1 = 0; d1 < 360; d1 += 15)
    for (let a = 0; a <= 180; a += 5)
      for (const side of [1, -1]) {
        const d2 = m.norm(d1 + side * a);
        for (const rot of [d1, d1 - 180, d2, d2 - 180]) {
          const got = m.readProtractor(at(d1, d2, m.norm(rot)));
          if (got.ok) assert.equal(got.value, a, `${d1} ${d2} ${rot}`);
          else assert.equal(got.reason, "outside");
        }
        // one of the two ways of putting the zero on Ox always works
        assert.ok([d1, d1 - 180].some(rot => m.readProtractor(at(d1, d2, m.norm(rot))).ok));
      }
});

test("no reading when the centre is off the vertex or no arm is on a zero", () => {
  assert.deepEqual(m.readProtractor(at(0, 55, 0, 0.2, 0)), { ok: false, reason: "center" });
  assert.deepEqual(m.readProtractor(at(0, 55, 20)), { ok: false, reason: "zero" });
  assert.deepEqual(m.readProtractor(at(0, 300, 0)), { ok: false, reason: "outside" });
  assert.equal(m.readProtractor(at(0, 55, 0.4)).ok, true); // within tolerance
  assert.equal(Math.round(m.readProtractor(at(0, 55, 359.7)).value), 55);
  assert.deepEqual(m.readProtractor(at(0, 180, 0)).value, 180);
  assert.deepEqual(m.readProtractor(at(40, 40, 40)).value, 0);
});

test("snapping", () => {
  assert.equal(m.snapDegree(54.6), 55);
  assert.equal(m.snapDegree(359.7), 0);
  assert.equal(m.snapDegree(-0.4), 0);
  assert.equal(m.snapDegree(47, 5), 45);
  // centre jumps to the vertex, base line onto the nearest arm
  assert.deepEqual(m.snapProtractor(at(0, 55, 4, 0.06, -0.05)), { px: 0, py: 0, rot: 0 });
  assert.deepEqual(m.snapProtractor(at(0, 55, 357, 0, 0)), { px: 0, py: 0, rot: 0 });
  assert.deepEqual(m.snapProtractor(at(180, 45, 3, 0.02, 0)), { px: 0, py: 0, rot: 0 }); // Ox on the outer zero
  assert.deepEqual(m.snapProtractor(at(0, 55, 58.2, 0, 0)), { px: 0, py: 0, rot: 55 });
  // too far: nothing jumps, the rotation is only rounded
  assert.deepEqual(m.snapProtractor(at(0, 55, 3.4, 0.3, 0)), { px: 0.3, py: 0, rot: 3 });
  assert.deepEqual(m.snapProtractor(at(0, 55, 20, 0, 0)), { px: 0, py: 0, rot: 20 });
  // a snapped protractor can be read
  const s = at(200, 170, 16, 0.05, 0.05);
  assert.deepEqual(m.readProtractor({ ...s, ...m.snapProtractor(s) }), { ok: true, scale: "outer", zeroArm: 1, value: 30 });
});

test("practice questions and checking", () => {
  for (let i = 0; i < m.QUESTION_COUNT; i++) {
    const q = m.question(i);
    assert.ok(q.target > 0 && q.target <= 180 && q.target % 5 === 0);
    const read = m.startQuestion({ ...m.initialState(), mode: "read", qIndex: i });
    assert.equal(m.angleOf(read), q.target);
    assert.equal(m.readProtractor(read).ok, false, "the protractor starts aside");
    assert.equal(m.isCorrect({ ...read, answer: q.target }), true);
    assert.equal(m.isCorrect({ ...read, answer: q.target - 1 }), true);
    assert.equal(m.isCorrect({ ...read, answer: q.target - 2 }), false);
    if (q.target !== 90) assert.equal(m.isCorrect({ ...read, answer: 180 - q.target }), false, "wrong scale is wrong");
    const draw = m.startQuestion({ ...m.initialState(), mode: "draw", qIndex: i });
    assert.equal(m.angleOf(draw), 10);
    assert.equal(m.isCorrect(draw), false);
    assert.equal(m.isCorrect({ ...draw, dir2: m.norm(q.base + q.target) }), true);
    assert.equal(m.isCorrect({ ...draw, dir2: m.norm(q.base - q.target) }), true); // either side of Ox
    assert.equal(m.isCorrect({ ...draw, dir2: m.norm(q.base + q.target + 3) }), false);
  }
  assert.equal(m.isCorrect(m.initialState()), false); // nothing to check outside practice
  assert.deepEqual(m.question(-1), m.question(m.QUESTION_COUNT - 1));
  assert.deepEqual(m.question(1e9 + 0.2), m.question(1e9 % m.QUESTION_COUNT));
  assert.deepEqual(m.question(NaN), m.question(0));
  const s = m.nextQuestion({ ...m.initialState(), mode: "read", qIndex: m.QUESTION_COUNT - 1, status: "right" });
  assert.deepEqual([s.qIndex, s.status, m.angleOf(s)], [0, "", 60]);
});
