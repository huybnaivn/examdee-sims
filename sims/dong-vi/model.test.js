import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENTS, TOLERANCE, SAMPLE, initialState, elementById, apportion, averageMass, abundancesFromAverage, percentages,
  naturalAverage, currentAverage, matches, sampleCounts, setPercent, resetMix,
} from "./model.js";

const sum = list => list.reduce((a, b) => a + b, 0);
const state = (element, patch = {}) => ({ ...initialState(), element, ...patch });

test("average atomic mass = Σ(mass × abundance)/100 gives the standard atomic masses", () => {
  const known = { H: 1.00794, B: 10.811, C: 12.0107, Mg: 24.305, Cl: 35.453, Cu: 63.546, Br: 79.904 };
  assert.deepEqual(ELEMENTS.map(e => e.id).sort(), Object.keys(known).sort());
  for (const [id, value] of Object.entries(known)) {
    assert.ok(Math.abs(naturalAverage(state(id)) - value) < 1e-3, `${id}: ${naturalAverage(state(id))}`);
  }
  // the formula itself, by hand
  assert.ok(Math.abs(averageMass([35, 37], [75, 25]) - 35.5) < 1e-12);
  assert.ok(Math.abs(averageMass([24, 25, 26], [79, 10, 11]) - 24.32) < 1e-12);
});

test("the data are consistent", () => {
  for (const e of ELEMENTS) {
    assert.ok(e.isotopes.length === 2 || e.isotopes.length === 3);
    assert.ok(Math.abs(sum(e.isotopes.map(x => x.abundance)) - 100) < 1e-9, e.id);
    for (const x of e.isotopes) assert.ok(Math.abs(x.mass - x.a) < 0.1); // mass ≈ mass number
    const masses = e.isotopes.map(x => x.mass);
    assert.deepEqual(masses, [...masses].sort((a, b) => a - b));
  }
  assert.equal(elementById("nope"), ELEMENTS[0]);
});

test("two isotopes: abundances recovered from the average", () => {
  for (const e of ELEMENTS.filter(x => x.isotopes.length === 2)) {
    const [a, b] = e.isotopes;
    const [x1, x2] = abundancesFromAverage(a.mass, b.mass, naturalAverage(state(e.id)));
    assert.ok(Math.abs(x1 - a.abundance) < 1e-9 && Math.abs(x2 - b.abundance) < 1e-9, e.id);
  }
  // textbook exercise: Cu with ⁶³Cu and ⁶⁵Cu, Ā = 63,54 → 73 % and 27 %
  const [x63, x65] = abundancesFromAverage(63, 65, 63.54);
  assert.ok(Math.abs(x63 - 73) < 1e-9 && Math.abs(x65 - 27) < 1e-9);
});

test("largest-remainder apportionment", () => {
  assert.deepEqual(apportion([75.76, 24.24], 100), [76, 24]);
  assert.deepEqual(apportion([78.99, 10, 11.01], 100), [79, 10, 11]);
  assert.deepEqual(apportion([99.9885, 0.0115], 100), [100, 0]);
  assert.deepEqual(apportion([33.4, 33.3, 33.3], 100), [34, 33, 33]);
  assert.deepEqual(apportion([49.5, 25.25, 25.25], 100), [50, 25, 25]); // tie goes to the earlier one, after the largest remainder
  assert.deepEqual(apportion([1, 1, 1], 100), [34, 33, 33]);
  assert.deepEqual(apportion([0, 0], 7), [4, 3]);
  assert.deepEqual(apportion([20, 80], 100), [20, 80]); // exact shares stay exact
  for (const w of [[0.3, 0.3, 0.4], [12.5, 37.5, 50], [1e-9, 5], [19.9, 80.1]]) {
    const out = apportion(w, 100);
    assert.equal(sum(out), 100);
    out.forEach((n, i) => assert.ok(Math.abs(n - (w[i] / sum(w)) * 100) < 1)); // never more than one atom off
  }
});

test("the sample of 100 atoms follows the percentages", () => {
  for (const e of ELEMENTS) {
    const counts = sampleCounts(state(e.id));
    assert.equal(sum(counts), SAMPLE);
    counts.forEach((n, i) => assert.ok(Math.abs(n - e.isotopes[i].abundance) < 1, e.id));
  }
  assert.deepEqual(sampleCounts(state("Cl")), [76, 24]);
  assert.deepEqual(sampleCounts(state("Mg")), [79, 10, 11]);
  assert.deepEqual(sampleCounts(state("Cl", { custom: true, p1: 30.5, p2: 69.5 })), [31, 69]);
});

test("sliders always sum to 100", () => {
  for (const e of ELEMENTS) {
    const n = e.isotopes.length;
    const s = resetMix(state(e.id, { custom: true }));
    assert.equal(s.p1 + s.p2 + s.p3, 100);
    let seed = 12345;
    for (let i = 0; i < 400; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const index = seed % n;
      const value = ((seed >> 8) % 201) / 2;
      setPercent(s, index, value);
      assert.equal(s[["p1", "p2", "p3"][index]], value);
      assert.equal(s.p1 + s.p2 + s.p3, 100);
      for (const p of [s.p1, s.p2, s.p3]) assert.ok(p >= 0 && p <= 100 && Number.isInteger(p * 2));
      if (n === 2) assert.equal(s.p3, 0);
      assert.deepEqual(percentages(s), [s.p1, s.p2, s.p3].slice(0, n));
    }
  }
  // the others keep their proportion; equal shares once they have both reached zero
  const s = state("Mg", { custom: true, p1: 40, p2: 40, p3: 20 });
  assert.deepEqual([setPercent(s, 0, 70).p2, s.p3], [20, 10]);
  assert.deepEqual([setPercent(s, 0, 100).p2, s.p3], [0, 0]);
  assert.deepEqual([setPercent(s, 0, 90).p2, s.p3], [5, 5]);
  // out-of-range and off-grid values
  assert.deepEqual([setPercent(s, 1, 250).p1, s.p2, s.p3], [0, 100, 0]);
  assert.equal(setPercent(s, 1, 33.3).p2, 33.5);
  assert.equal(s.p1 + s.p2 + s.p3, 100);
});

test("a forged mix is normalised before use", () => {
  const s = state("Cl", { custom: true, p1: 100, p2: 100, p3: 55 });
  assert.deepEqual(percentages(s), [50, 50]);
  assert.deepEqual(percentages(state("Mg", { custom: true, p1: 0, p2: 0, p3: 0 })), [33.5, 33.5, 33]);
  assert.equal(sum(sampleCounts(s)), 100);
});

test("the learner's average and the match with nature", () => {
  const s = resetMix(state("Cl", { custom: true }));
  assert.ok(Math.abs(currentAverage(s) - (34.968853 + 36.965903) / 2) < 1e-9);
  assert.equal(matches(s), false);
  setPercent(s, 0, 76); // nearest half per cent to 75,76 %
  assert.ok(Math.abs(currentAverage(s) - naturalAverage(s)) < TOLERANCE);
  assert.equal(matches(s), true);
  setPercent(s, 0, 75); // 0,015 amu off
  assert.equal(matches(s), false);
  // every element can be matched on the slider grid
  for (const e of ELEMENTS) {
    const t = resetMix(state(e.id, { custom: true }));
    e.isotopes.slice(0, -1).forEach((x, i) => {
      t[["p1", "p2"][i]] = Math.round(x.abundance * 2) / 2;
    });
    t[["p1", "p2", "p3"][e.isotopes.length - 1]] = 100 - (e.isotopes.length === 3 ? t.p1 + t.p2 : t.p1);
    assert.equal(matches(t), true, e.id);
  }
  // natural mode always shows the natural average
  assert.equal(currentAverage(state("Br")), naturalAverage(state("Br")));
});
