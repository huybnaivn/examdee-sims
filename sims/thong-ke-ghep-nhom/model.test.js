import test from "node:test";
import assert from "node:assert/strict";
import { initialState, sample, group, classesOf, groupedStats, groupedQuantile, groupedMode, modalClasses, rawStats, analyse, N } from "./model.js";

const close = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

// Worked by hand: [150;155) 4, [155;160) 10, [160;165) 14, [165;170) 8, [170;175) 4, n = 40.
const HAND = classesOf(150, 5, [4, 10, 14, 8, 4]);

test("grouped mean uses the class midpoints", () => {
  // (4·152,5 + 10·157,5 + 14·162,5 + 8·167,5 + 4·172,5) / 40 = 6490 / 40
  close(groupedStats(HAND).mean, 162.25);
});

test("grouped median and quartiles follow the interpolation formula", () => {
  const g = groupedStats(HAND);
  close(g.median, 160 + ((20 - 14) / 14) * 5); // class [160;165), cumulative before it 14
  close(g.q1, 155 + ((10 - 4) / 10) * 5); // = 158
  close(g.q3, 165 + ((30 - 28) / 8) * 5); // = 166,25
  assert.equal(g.medianClass, 2);
  // the target falls exactly at the end of a class: the value is that class's right end
  close(groupedQuantile(classesOf(0, 10, [10, 10, 10, 10]), 1 / 2).value, 20);
  // empty classes are skipped
  close(groupedQuantile(classesOf(0, 10, [5, 0, 5]), 1 / 2).value, 10);
});

test("modal class and mode formula, with m₀ = m_{k+1} = 0 at the ends", () => {
  assert.deepEqual(modalClasses(HAND), [2]);
  close(groupedStats(HAND).mode, 160 + (4 / (4 + 6)) * 5); // = 162
  const first = classesOf(0, 10, [9, 3, 2]);
  close(groupedMode(first), 0 + (9 / (9 + 6)) * 10);
  const last = classesOf(0, 10, [1, 3, 8]);
  close(groupedMode(last), 20 + (5 / (5 + 8)) * 10);
  assert.deepEqual(modalClasses(classesOf(0, 1, [2, 5, 1, 5])), [1, 3]);
});

test("class counts add up to n and every value lies in its class [a_i; a_{i+1})", () => {
  for (const seed of [1, 7, 42, 500, 999])
    for (let width = 3; width <= 10; width++) {
      const values = sample(seed);
      const cls = group(values, width);
      assert.equal(cls.counts.reduce((p, q) => p + q, 0), N);
      assert.ok(cls.bounds[0] <= Math.min(...values) && Math.max(...values) < cls.bounds[cls.k]);
      assert.equal(cls.start % width, 0);
      for (let i = 0; i < cls.k; i++)
        assert.equal(values.filter(v => v >= cls.bounds[i] && v < cls.bounds[i + 1]).length, cls.counts[i]);
    }
});

test("the grouped estimates stay inside their classes and near the exact values", () => {
  for (const seed of [1, 7, 42, 500]) {
    for (let width = 3; width <= 10; width++) {
      const { cls, grouped, raw } = analyse({ ...initialState(), seed, width });
      assert.ok(grouped.q1 <= grouped.median && grouped.median <= grouped.q3);
      const j = grouped.modal[0];
      assert.ok(grouped.mode >= cls.bounds[j] && grouped.mode <= cls.bounds[j + 1]);
      // grouping moves each value by less than one class width
      assert.ok(Math.abs(grouped.mean - raw.mean) < width);
      assert.ok(Math.abs(grouped.median - raw.median) < width);
    }
  }
});

test("changing the class width changes the estimates, not the raw data", () => {
  const a = analyse({ ...initialState(), width: 4 });
  const b = analyse({ ...initialState(), width: 7 });
  assert.deepEqual(a.values, b.values);
  assert.deepEqual(a.raw.mean, b.raw.mean);
  assert.deepEqual(a.raw.median, b.raw.median);
  assert.notEqual(a.cls.k, b.cls.k);
  assert.notEqual(a.grouped.mean, b.grouped.mean);
  assert.notEqual(a.grouped.median, b.grouped.median);
});

test("exact statistics of the raw values", () => {
  const r = rawStats([3, 1, 4, 1, 5, 9, 2, 6]);
  close(r.mean, 31 / 8);
  close(r.median, 3.5); // 1 1 2 3 | 4 5 6 9
  close(r.q1, 1.5);
  close(r.q3, 5.5);
  assert.deepEqual(r.modes, [1]);
});

test("the generator is deterministic and stays in range", () => {
  assert.deepEqual(sample(7), sample(7));
  assert.notDeepEqual(sample(7), sample(8));
  assert.deepEqual(sample(0), sample(1)); // a forged seed is cleaned up, not trusted
  assert.deepEqual(sample(-7.6), sample(7));
  for (const seed of [1, 2, 3, 999]) {
    const v = sample(seed);
    assert.equal(v.length, N);
    assert.ok(v.every(x => Number.isInteger(x) && x >= 140 && x <= 185));
  }
});
