import test from "node:test";
import assert from "node:assert/strict";
import { DENOMS, MAX_NOTES, MAX_TARGET, ITEMS, itemKey, initialState, dots, dong, sum, basket, total, change, pay, fewest, phaseOf, sanitize, newTarget } from "./model.js";

const withItems = (...ids) => ({ ...initialState(), ...Object.fromEntries(ITEMS.map((_, i) => [itemKey(i), ids.includes(i)])) });

test("the notes are the Vietnamese values from 1 000 to 500 000 and prices are payable with them", () => {
  assert.deepEqual(DENOMS, [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]);
  for (const item of ITEMS) assert.ok(item.price > 0 && item.price % 1000 === 0, item.name);
});

test("totals", () => {
  assert.equal(total(initialState()), 7000 + 8000);
  assert.deepEqual(basket(initialState()), [2, 3]);
  assert.equal(total(withItems()), 0);
  assert.equal(total(withItems(0, 1)), 8000);
  assert.equal(total(withItems(0, 1, 2, 3, 4, 5, 6, 7)), ITEMS.reduce((a, it) => a + it.price, 0));
  assert.equal(total(withItems(0, 1, 2, 3, 4, 5, 6, 7)), 225000);
  assert.equal(sum([20000, 5000, 1000]), 26000);
  assert.equal(sum([]), 0);
});

test("change = paid − total", () => {
  assert.equal(change(20000, 15000), 5000);
  assert.equal(change(15000, 15000), 0);
  assert.equal(change(500000, 3000), 497000);
  assert.deepEqual(pay(15000, 20000), { ok: true, total: 15000, paid: 20000, change: 5000 });
  for (let due = 1000; due <= 225000; due += 7000) for (const paid of [due, due + 1000, 500000]) {
    const r = pay(due, paid);
    assert.equal(r.change + r.total, r.paid);
    assert.equal(r.change, change(paid, due));
  }
});

test("paying less than the total is refused", () => {
  assert.equal(change(10000, 15000), null);
  assert.deepEqual(pay(15000, 10000), { ok: false, reason: "short", short: 5000 });
  assert.deepEqual(pay(15000, 0), { ok: false, reason: "short", short: 15000 });
  assert.deepEqual(pay(0, 20000), { ok: false, reason: "empty" });
  // a forged "done" does not survive an unpaid basket
  assert.equal(phaseOf({ ...initialState(), paid: [10000], phase: "done" }), "pay");
  assert.equal(phaseOf({ ...initialState(), paid: [10000], phase: "change" }), "pay");
});

test("fewest notes: greedy decomposition", () => {
  assert.deepEqual(fewest(87000), [50000, 20000, 10000, 5000, 2000]);
  assert.deepEqual(fewest(5000), [5000]);
  assert.deepEqual(fewest(4000), [2000, 2000]);
  assert.deepEqual(fewest(9000), [5000, 2000, 2000]);
  assert.deepEqual(fewest(388000), [200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000]);
  assert.deepEqual(fewest(1000000), [500000, 500000]);
  assert.deepEqual(fewest(0), []);
  assert.equal(fewest(1500), null);
  assert.equal(fewest(-1000), null);
  assert.equal(fewest(2.5), null);
});

test("greedy really is the minimum for these values (checked against dynamic programming up to 1 000 000)", () => {
  const N = 1000; // in thousands
  const best = Array(N + 1).fill(Infinity);
  best[0] = 0;
  for (let a = 1; a <= N; a++) for (const d of DENOMS) if (d / 1000 <= a) best[a] = Math.min(best[a], best[a - d / 1000] + 1);
  let most = 0;
  for (let a = 0; a <= N; a++) {
    const g = fewest(a * 1000);
    assert.equal(sum(g), a * 1000);
    assert.equal(g.length, best[a], `${a} nghìn`);
    if (a * 1000 <= MAX_TARGET) most = Math.max(most, g.length);
  }
  assert.ok(most <= MAX_NOTES, `every target fits on the tray (${most} notes)`);
});

test("formatting with dots as thousands separators", () => {
  assert.equal(dots(0), "0");
  assert.equal(dots(999), "999");
  assert.equal(dots(1000), "1.000");
  assert.equal(dots(15000), "15.000");
  assert.equal(dots(500000), "500.000");
  assert.equal(dots(1234567), "1.234.567");
  assert.equal(dong(87000), "87.000 đồng");
});

test("phases of a purchase", () => {
  const s = initialState(); // 15 000 due, 20 000 on the tray
  assert.equal(phaseOf(s), "pay");
  assert.equal(phaseOf({ ...s, phase: "change" }), "change");
  assert.equal(phaseOf({ ...s, phase: "done", back: [2000] }), "change"); // wrong change is not done
  assert.equal(phaseOf({ ...s, phase: "done", back: [5000] }), "done");
  assert.equal(phaseOf({ ...s, phase: "done", back: [2000, 2000, 1000] }), "done");
  assert.equal(phaseOf({ ...s, phase: "change", paid: [10000, 5000] }), "done"); // paid exactly: nothing to give back
  assert.equal(phaseOf({ ...s, phase: "nonsense" }), "pay");
  // fewest mode: done only with the right amount in the fewest notes
  const f = { ...s, mode: "fewest", target: 9000, phase: "done" };
  assert.equal(phaseOf({ ...f, paid: [5000, 2000, 2000] }), "done");
  assert.equal(phaseOf({ ...f, paid: [5000, 2000, 1000, 1000] }), "pay");
  assert.equal(phaseOf({ ...f, paid: [5000] }), "pay");
});

test("state from the host is sanitised", () => {
  const base = initialState();
  const out = sanitize({ mode: "fewest", item0: "yes", item1: true, paid: [20000, 3000, "x", -5, 500000], back: "all", target: 1e12, phase: 7, extra: 1, _note: "hi" }, base);
  assert.equal(out.mode, "fewest");
  assert.equal(out.item0, undefined);
  assert.equal(out.item1, true);
  assert.deepEqual(out.paid, [20000, 500000]);
  assert.deepEqual(out.back, []);
  assert.equal(out.target, MAX_TARGET);
  assert.equal(out.phase, undefined);
  assert.equal("extra" in out, false);
  assert.equal("_note" in out, false);
  assert.equal(sanitize({ paid: Array(99).fill(1000) }, base).paid.length, MAX_NOTES);
  assert.equal(sanitize({ target: 12345 }, base).target, 12000);
  assert.equal(sanitize({ target: -5 }, base).target, 1000);
  assert.equal(sanitize({ target: NaN }, base).target, undefined);
});

test("new targets are makeable and need more than one note", () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let t = 87000;
  for (let i = 0; i < 300; i++) {
    const next = newTarget(rand, t);
    assert.notEqual(next, t);
    t = next;
    assert.ok(t >= 1000 && t <= 200000 && t % 1000 === 0);
    assert.ok(fewest(t).length >= 2 && fewest(t).length <= MAX_NOTES);
  }
});
