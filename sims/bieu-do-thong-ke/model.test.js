import test from "node:test";
import assert from "node:assert/strict";
import { barHeight, initialState, sanitize, percents, angles, axis, icons, total, largestRemainder, PRESETS, CAP } from "./model.js";

const sum = xs => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

test("pie: percentages add up to 100 and angles to 360, by largest remainder", () => {
  const v = [12, 8, 6, 4, 5]; // total 35: none of the shares is a whole percentage
  const pc = percents(v);
  const an = angles(v);
  assert.equal(sum(pc), 100);
  assert.equal(sum(an), 360);
  assert.deepEqual(pc, [34.3, 22.9, 17.1, 11.4, 14.3]);
  assert.deepEqual(an, [123.4, 82.3, 61.7, 41.2, 51.4]);
  // each one is within half a unit of rounding of the exact value
  v.forEach((x, i) => {
    assert.ok(Math.abs(pc[i] - (100 * x) / 35) < 0.1);
    assert.ok(Math.abs(an[i] - (360 * x) / 35) < 0.1);
  });
  // three equal parts: 33.4 + 33.3 + 33.3, 120 each
  assert.deepEqual(percents([1, 1, 1]), [33.4, 33.3, 33.3]);
  assert.deepEqual(angles([1, 1, 1]), [120, 120, 120]);
  for (let k = 0; k < 300; k++) {
    const r = Array.from({ length: 1 + (k % CAP) }, () => Math.round(Math.random() * 1000) / 10);
    if (!total(r)) continue;
    assert.equal(sum(percents(r)), 100);
    assert.equal(sum(angles(r)), 360);
  }
});

test("bar heights are proportional to the values", () => {
  const v = [12, 8, 6, 4, 5];
  const { top, step } = axis(Math.max(...v));
  assert.deepEqual({ top, step }, { top: 12, step: 2 }); // 12 → ticks 0, 2, …, 12
  const H = 300;
  const h = v.map(x => barHeight(x, top, H));
  assert.equal(barHeight(top, top, H), H);
  assert.equal(barHeight(0, top, H), 0);
  v.forEach((x, i) => assert.ok(Math.abs(h[i] / h[0] - x / v[0]) < 1e-12));
  assert.ok(top >= Math.max(...v));
  assert.deepEqual(axis(50), { top: 50, step: 10 });
  assert.deepEqual(axis(29), { top: 30, step: 5 });
  assert.deepEqual(axis(1000), { top: 1000, step: 200 });
  assert.deepEqual(axis(0.3), { top: 0.3, step: 0.05 });
  for (let m = 0.1; m < 1000; m *= 1.37) {
    const a = axis(m);
    assert.ok(a.top >= m - 1e-9 && a.top / a.step <= 8.000001, `${m}`);
  }
});

test("pictograph icon counts, with a fraction of an icon", () => {
  assert.deepEqual(icons(5, 2), { count: 2.5, full: 2, part: 0.5 });
  assert.deepEqual(icons(12, 2), { count: 6, full: 6, part: 0 });
  assert.deepEqual(icons(35, 10), { count: 3.5, full: 3, part: 0.5 });
  const q = icons(7, 4);
  assert.equal(q.full, 1);
  assert.ok(Math.abs(q.part - 0.75) < 1e-12);
  assert.deepEqual(icons(0, 5), { count: 0, full: 0, part: 0 });
  // floating point: 0.3 / 0.1 must give 3 whole icons, not 2 and 0.9999
  assert.equal(icons(0.3, 0.1).full, 3);
});

test("empty and all-zero tables give zeros, never NaN", () => {
  for (const v of [[], [0, 0, 0]]) {
    for (const xs of [percents(v), angles(v)]) {
      assert.equal(xs.length, v.length);
      xs.forEach(x => assert.equal(x, 0));
    }
    const a = axis(Math.max(0, ...v));
    assert.ok(Number.isFinite(a.top) && a.top > 0);
    v.forEach(x => assert.ok(Number.isFinite((x / a.top) * 100)));
  }
  assert.deepEqual(largestRemainder([], 100), []);
});

test("sanitize keeps at most 8 clean categories", () => {
  const base = initialState();
  const out = sanitize({ labels: ["  Táo ", 5, ""], values: [3, -2, 5000, "x", NaN, 1, 1, 1, 1, 1, 1], selected: 99 }, base);
  assert.equal(out.values.length, CAP);
  assert.deepEqual(out.values.slice(0, 5), [3, 0, 1000, 0, 0]);
  assert.deepEqual(out.labels.slice(0, 3), ["Táo", "Mục 2", "Mục 3"]);
  assert.equal(out.selected, -1);
  assert.equal(out.dataset, "custom");
  const same = sanitize({ ...PRESETS.sach, dataset: "sach", selected: -1 }, base);
  assert.equal(same.dataset, "sach");
  assert.equal(same.selected, -1);
  const empty = sanitize({ labels: [], values: [] }, base);
  assert.deepEqual(empty.values, []);
  assert.equal(empty.selected, -1);
  assert.deepEqual(sanitize({ values: "oops", chart: 3 }, base).chart, undefined);
});
