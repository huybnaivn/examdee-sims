import test from "node:test";
import assert from "node:assert/strict";
import {
  MATERIALS, ORDER, OBJECTS, CLOTHS, QMAX, PAPER, initialState, electronsMoved, signAfterRub, rub,
  interaction, strength, paperLifted, leafAngle, touchElectroscope, totalCharge, tidy,
} from "./model.js";

const fresh = (m1, cloth) => ({ ...initialState(), m1, cloth, q1: 0, q2: 0, qc: 0, qe: 0 });

test("electrons go from the material earlier in the order to the later one", () => {
  assert.deepEqual(ORDER, ["glass", "hair", "wool", "silk", "balloon", "ruler"]);
  // textbook cases
  assert.equal(signAfterRub("glass", "silk"), 1);
  assert.equal(signAfterRub("ruler", "wool"), -1);
  assert.equal(signAfterRub("balloon", "hair"), -1);
  for (const a of ORDER) {
    for (const b of ORDER) {
      const n = electronsMoved(a, b);
      assert.ok(n === -electronsMoved(b, a));
      assert.equal(Math.sign(n), Math.sign(MATERIALS[b].rank - MATERIALS[a].rank));
    }
    assert.equal(electronsMoved(a, a), 0);
  }
  // every object/cloth pair charges something, and the object and the cloth get opposite signs
  for (const o of OBJECTS) for (const c of CLOTHS) {
    const s = fresh(o, c);
    const n = rub(s, 1);
    assert.notEqual(n, 0);
    assert.equal(Math.sign(s.q1), signAfterRub(o, c));
    assert.equal(Math.sign(s.qc), -Math.sign(s.q1));
  }
});

test("total charge is conserved by rubbing and by touching the electroscope", () => {
  const s = fresh("glass", "silk");
  s.m2 = "ruler";
  for (let i = 0; i < 10; i++) {
    rub(s, 1);
    rub(s, 2);
    assert.equal(totalCharge(s), 0);
  }
  assert.ok(Math.abs(s.q1) <= QMAX && Math.abs(s.q2) <= QMAX && Math.abs(s.qc) <= QMAX);
  touchElectroscope(s, 1);
  assert.equal(totalCharge(s), 0);
  assert.equal(Math.sign(s.qe), Math.sign(s.q1)); // the electroscope gets the same sign by contact
  const t = fresh("ruler", "wool");
  rub(t, 1);
  rub(t, 1);
  assert.deepEqual([t.q1, t.qc], [-6, 6]);
  assert.deepEqual([initialState().q1, initialState().qc], [-6, 6]);
});

test("like charges repel, unlike charges attract", () => {
  assert.equal(interaction(3, 5), -1);
  assert.equal(interaction(-3, -5), -1);
  assert.equal(interaction(3, -5), 1);
  assert.equal(interaction(-3, 5), 1);
  // two rulers rubbed with wool repel; a ruler and a glass rod rubbed with silk attract
  const a = fresh("ruler", "wool"); rub(a, 1);
  const b = fresh("ruler", "wool"); rub(b, 1);
  assert.equal(interaction(a.q1, b.q1), -1);
  const g = fresh("glass", "silk"); rub(g, 1);
  assert.equal(interaction(a.q1, g.q1), 1);
  assert.ok(strength(6, 6) > strength(3, 3));
});

test("a charged object attracts neutral things by induction, whatever its sign", () => {
  assert.equal(interaction(4, 0), 1);
  assert.equal(interaction(0, -4), 1);
  assert.equal(interaction(0, 0), 0);
  assert.equal(paperLifted(0), 0);
  for (let q = 0; q <= QMAX; q++) {
    assert.equal(paperLifted(q), paperLifted(-q));
    if (q) assert.ok(paperLifted(q) >= paperLifted(q - 1));
  }
  assert.ok(paperLifted(6) > 0);
  assert.equal(paperLifted(QMAX), PAPER);
});

test("electroscope leaves spread more with more charge, not at all when neutral", () => {
  assert.equal(leafAngle(0), 0);
  for (let q = 1; q <= QMAX; q++) {
    assert.ok(leafAngle(q) > leafAngle(q - 1));
    assert.equal(leafAngle(-q), leafAngle(q));
    assert.ok(leafAngle(q) < 80);
  }
});

test("forged state is tidied", () => {
  const s = tidy({ ...initialState(), q1: 1e9, qe: -2.4, use: 7, guess: "x" });
  assert.deepEqual([s.q1, s.qe, s.use, s.guess], [QMAX, -2, 1, ""]);
});
