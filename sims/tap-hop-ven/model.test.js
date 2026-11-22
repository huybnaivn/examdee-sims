import test from "node:test";
import assert from "node:assert/strict";
import { MAX_ELEMS, BITS, PRESETS, presetElems, initialState, cleanElems, sanitize, regionOf, OPS, opOf, pick, apply, counts, union2, union3, isSubset, toggle, nextLabel, braces, circles, regionAt, layout, CONTEXTS, surveyOf, newSurvey } from "./model.js";

const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const nums = list => list.map(Number);
const randomElems = rand => Array.from({ length: 1 + Math.floor(rand() * MAX_ELEMS) }, (_, i) => ({ t: String(i + 1), r: Math.floor(rand() * 8) }));

test("preset 1..12: multiples of 2, 3 and 4 land in the right regions", () => {
  const e = presetElems("boi");
  assert.equal(e.length, 12);
  const mask = n => e.find(x => x.t === String(n)).r;
  assert.equal(mask(1), 0); // in U only
  assert.equal(mask(2), 1); // A only
  assert.equal(mask(3), 2); // B only
  assert.equal(mask(6), 3); // A and B
  assert.equal(mask(4), 5); // A and C
  assert.equal(mask(12), 7); // all three
  for (const x of e) {
    const n = Number(x.t);
    assert.equal(!!(x.r & BITS.A), n % 2 === 0);
    assert.equal(!!(x.r & BITS.B), n % 3 === 0);
    assert.equal(!!(x.r & BITS.C), n % 4 === 0);
  }
});

test("other presets: divisors and letters of words", () => {
  const u = presetElems("uoc");
  assert.deepEqual(nums(pick(u, 3, m => m & 1)), [1, 2, 3, 4, 6, 12]);
  assert.deepEqual(nums(pick(u, 3, m => m & 2)), [1, 2, 3, 6, 9, 18]);
  assert.deepEqual(nums(apply(u, 2, 2)), [1, 2, 3, 6]); // common divisors of 12 and 18
  assert.deepEqual(nums(pick(u, 3, m => m === 0)), [8]);
  const c = presetElems("chu");
  assert.deepEqual(apply(c, 2, 2), ["T", "N"]); // TOAN ∩ TIN
  assert.deepEqual(apply(c, 3, 7), ["N"]);
  assert.deepEqual(pick(c, 3, m => m === 0), ["H", "E"]);
  assert.ok(presetElems("tu").every(e => e.r === 0));
  assert.deepEqual(presetElems("no-such"), presetElems("tu"));
  for (const key of Object.keys(PRESETS)) assert.ok(presetElems(key).length <= MAX_ELEMS);
});

test("union, intersection, differences and complement on 1..12", () => {
  const e = presetElems("boi");
  assert.deepEqual(nums(apply(e, 2, 1)), [2, 3, 4, 6, 8, 9, 10, 12]); // A ∪ B
  assert.deepEqual(nums(apply(e, 2, 2)), [6, 12]); // A ∩ B
  assert.deepEqual(nums(apply(e, 2, 3)), [2, 4, 8, 10]); // A \ B
  assert.deepEqual(nums(apply(e, 2, 4)), [3, 9]); // B \ A
  assert.deepEqual(nums(apply(e, 2, 5)), [1, 3, 5, 7, 9, 11]); // complement of A
  assert.deepEqual(nums(apply(e, 3, 6)), [2, 3, 4, 6, 8, 9, 10, 12]);
  assert.deepEqual(nums(apply(e, 3, 7)), [12]);
  assert.deepEqual(apply(e, 2, 0), []);
});

test("set identities hold for random placements", () => {
  const rand = rng(11);
  for (let k = 0; k < 300; k++) {
    const e = randomElems(rand);
    for (const sets of [2, 3]) {
      const A = new Set(pick(e, sets, m => m & 1));
      const B = new Set(pick(e, sets, m => m & 2));
      const all = e.map(x => x.t);
      assert.deepEqual(apply(e, sets, 1), all.filter(t => A.has(t) || B.has(t)));
      assert.deepEqual(apply(e, sets, 2), all.filter(t => A.has(t) && B.has(t)));
      assert.deepEqual(apply(e, sets, 3), all.filter(t => A.has(t) && !B.has(t)));
      assert.deepEqual(apply(e, sets, 4), all.filter(t => B.has(t) && !A.has(t)));
      assert.deepEqual(apply(e, sets, 5), all.filter(t => !A.has(t)));
      // A = (A \ B) ∪ (A ∩ B), and a set with its complement makes U
      assert.equal(apply(e, sets, 3).length + apply(e, sets, 2).length, A.size);
      assert.equal(A.size + apply(e, sets, 5).length, e.length);
    }
  }
});

test("inclusion–exclusion for two and three sets", () => {
  assert.equal(union2(6, 4, 2), 8);
  assert.equal(union3(6, 4, 3, 2, 3, 1, 1), 8);
  const c2 = counts(presetElems("boi"), 2);
  assert.deepEqual([c2.A, c2.B, c2.AB, c2.union, c2.outside, c2.total], [6, 4, 2, 8, 4, 12]);
  assert.deepEqual([c2.C, c2.AC, c2.BC, c2.ABC], [0, 0, 0, 0]);
  const c3 = counts(presetElems("boi"), 3);
  assert.deepEqual([c3.A, c3.B, c3.C, c3.AB, c3.AC, c3.BC, c3.ABC, c3.union], [6, 4, 3, 2, 3, 1, 1, 8]);
  const rand = rng(5);
  for (let k = 0; k < 500; k++) {
    const e = randomElems(rand);
    const two = counts(e, 2);
    assert.equal(union2(two.A, two.B, two.AB), two.union);
    assert.equal(two.union + two.outside, two.total);
    const c = counts(e, 3);
    assert.equal(union3(c.A, c.B, c.C, c.AB, c.AC, c.BC, c.ABC), c.union);
    assert.equal(c.union + c.outside, c.total);
  }
});

test("every element is in exactly one region, and with two sets the C bit is ignored", () => {
  const e = presetElems("boi");
  for (const sets of [2, 3]) {
    const regions = sets === 3 ? 8 : 4;
    let seen = 0;
    for (let m = 0; m < regions; m++) seen += pick(e, sets, r => r === m).length;
    assert.equal(seen, e.length);
  }
  assert.equal(regionOf({ t: "4", r: 5 }, 2), 1);
  assert.equal(regionOf({ t: "4", r: 5 }, 3), 5);
  assert.equal(regionOf({ t: "x", r: 4 }, 2), 0);
});

test("empty sets and subsets", () => {
  const none = presetElems("tu");
  assert.deepEqual(apply(none, 2, 1), []);
  assert.equal(braces(apply(none, 2, 2)), "∅");
  assert.equal(braces(["2", "4"]), "{2; 4}");
  const c = counts(none, 3);
  assert.equal(union3(c.A, c.B, c.C, c.AB, c.AC, c.BC, c.ABC), 0);
  assert.equal(c.outside, none.length);
  assert.deepEqual(counts([], 3).total, 0);
  // the empty set is a subset of every set
  assert.ok(isSubset(none, BITS.A, BITS.B));
  // multiples of 4 ⊂ multiples of 2, not the other way round
  const e = presetElems("boi");
  assert.ok(isSubset(e, BITS.C, BITS.A));
  assert.ok(!isSubset(e, BITS.A, BITS.C));
  assert.ok(!isSubset(e, BITS.A, BITS.B));
  assert.ok(isSubset(e, BITS.A, BITS.A));
  // if B ⊂ A then A ∩ B = B and A ∪ B = A
  const sub = [{ t: "1", r: 1 }, { t: "2", r: 3 }, { t: "3", r: 3 }, { t: "4", r: 0 }];
  assert.ok(isSubset(sub, BITS.B, BITS.A));
  assert.deepEqual(apply(sub, 2, 2), pick(sub, 2, m => m & 2));
  assert.deepEqual(apply(sub, 2, 1), pick(sub, 2, m => m & 1));
  assert.deepEqual(apply(sub, 2, 4), []);
});

test("placing, adding and the operation shown", () => {
  assert.deepEqual(toggle({ t: "5", r: 0 }, BITS.B), { t: "5", r: 2 });
  assert.deepEqual(toggle({ t: "5", r: 7 }, BITS.A), { t: "5", r: 6 });
  assert.equal(nextLabel(presetElems("tu")), "9");
  assert.equal(nextLabel([{ t: "1", r: 0 }, { t: "3", r: 0 }]), "2");
  assert.equal(nextLabel(presetElems("chu")), "1");
  assert.equal(opOf({ op: 2, sets: 2 }).code, 2);
  assert.equal(opOf({ op: 7, sets: 2 }).code, 0); // a three-set operation with two sets
  assert.equal(opOf({ op: 7, sets: 3 }).code, 7);
  assert.equal(opOf({ op: 99, sets: 3 }).code, 7);
  assert.equal(opOf({ op: "x", sets: 3 }).code, 0);
  OPS.forEach((op, i) => assert.equal(op.code, i));
});

test("the picture: circles fit the box and each element is drawn inside its own region", () => {
  const rand = rng(3);
  for (const box of [{ x: 8, y: 90, w: 344, h: 230 }, { x: 20, y: 120, w: 860, h: 600 }])
    for (const sets of [2, 3]) {
      const rings = circles(sets, box);
      assert.equal(rings.length, sets);
      for (const c of rings) assert.ok(c.x - c.r >= box.x && c.x + c.r <= box.x + box.w && c.y - c.r >= box.y && c.y + c.r <= box.y + box.h);
      // all regions exist in the drawing
      for (let m = 0; m < 2 ** sets; m++) assert.ok(layout([{ t: "1", r: m }], sets, box, 4).length === 1);
      for (let k = 0; k < 40; k++) {
        const e = k ? randomElems(rand) : presetElems("boi");
        const at = layout(e, sets, box, 10);
        e.forEach((el, i) => assert.equal(regionAt(at[i].x, at[i].y, rings, box), regionOf(el, sets), `element ${el.t}`));
        // no two elements on the same spot
        for (let i = 0; i < at.length; i++) for (let j = 0; j < i; j++) assert.ok(Math.hypot(at[i].x - at[j].x, at[i].y - at[j].y) > 1);
      }
      assert.equal(regionAt(box.x - 5, box.y + 5, rings, box), -1);
      assert.equal(regionAt(box.x + 2, box.y + 2, rings, box), 0);
      assert.equal(regionAt(rings[0].x - rings[0].r * 0.8, rings[0].y, rings, box), 1);
    }
});

test("state from the host is sanitised", () => {
  const base = initialState();
  const s = sanitize({ mode: "survey", sets: 3, op: 7, sel: 99, elems: [{ t: "a", r: 9 }, { t: "a", r: 1 }, { t: "toolong", r: -2 }, { t: "", r: 1 }, { r: 1 }, null, { t: 7, r: 2.4 }], evil: 1, _solved: true }, base);
  assert.deepEqual(s.elems, [{ t: "a", r: 7 }, { t: "too", r: 0 }, { t: "7", r: 2 }]);
  assert.equal(s.sets, 3);
  assert.equal(s.op, 7);
  assert.equal(s.sel, 3);
  assert.equal(s.mode, "survey");
  assert.ok(!("evil" in s) && !("_solved" in s));
  assert.deepEqual(sanitize({ elems: "x", sets: 5, op: 7, qA: "many" }, base).elems, base.elems);
  assert.equal(sanitize({ sets: 5, op: 7 }, base).op, 0);
  assert.equal(sanitize({ elems: Array.from({ length: 50 }, (_, i) => ({ t: String(i), r: 1 })) }, base).elems.length, MAX_ELEMS);
  assert.deepEqual(cleanElems([]), []);
});

test("survey problems: the three questions and inclusion–exclusion", () => {
  const q = surveyOf(initialState());
  assert.deepEqual([q.total, q.a, q.b, q.both, q.union, q.neither, q.onlyA, q.onlyB, q.answer], [40, 25, 18, 8, 35, 5, 17, 10, 5]);
  assert.equal(surveyOf({ qType: 1, qN: 40, qA: 25, qB: 18, qBoth: 8 }).answer, 35);
  const t2 = surveyOf({ qType: 2, qN: 99, qA: 25, qB: 18, qBoth: 8 });
  assert.deepEqual([t2.total, t2.neither, t2.answer], [35, 0, 8]);
  // forged numbers are made consistent
  const bad = surveyOf({ qType: 0, qN: 3, qA: 500, qB: -4, qBoth: 77, qCtx: 99 });
  assert.deepEqual([bad.a, bad.b, bad.both, bad.total, bad.neither], [30, 1, 1, 30, 0]);
  assert.equal(bad.ctx, CONTEXTS.length - 1);
  const rand = rng(21);
  let cur = {};
  for (let i = 0; i < 500; i++) {
    const raw = newSurvey(rand, cur);
    const p = surveyOf(raw);
    assert.deepEqual([p.a, p.b, p.both, p.total], [raw.qA, raw.qB, raw.qBoth, raw.qN], "generated problems need no repair");
    assert.equal(p.onlyA + p.onlyB + p.both + p.neither, p.total);
    assert.equal(p.union, p.a + p.b - p.both);
    assert.ok(p.onlyA >= 0 && p.onlyB >= 0 && p.neither >= 0 && p.total <= 50);
    assert.ok(p.answer >= 0 && p.answer <= 60);
    assert.ok(raw.qA !== cur.qA || raw.qB !== cur.qB);
    cur = raw;
  }
});
