import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, ELEMENTS, SOURCES, VISIBLE, linesOf, emission, absorptionLines, coincide, identify,
  colourName, wavelengthToRgb, unknownElement, check, nextUnknown,
} from "./model.js";

test("line wavelengths per element follow the documented table", () => {
  assert.deepEqual(linesOf("H"), [410.2, 434.0, 486.1, 656.3]); // Balmer Hδ, Hγ, Hβ, Hα
  assert.deepEqual(linesOf("Na"), [589.0, 589.6]); // D doublet
  assert.deepEqual(linesOf("Hg"), [404.7, 435.8, 546.1, 577.0, 579.1]);
  assert.deepEqual(linesOf("He"), [447.1, 471.3, 492.2, 501.6, 587.6, 667.8, 706.5]);
  assert.equal(linesOf("Ne").length, 11);
  assert.deepEqual(SOURCES, ["lamp", "H", "Na", "Hg", "He", "Ne"]);
  for (const e of ELEMENTS) {
    assert.deepEqual(e.lines, [...e.lines].sort((a, b) => a - b));
    for (const nm of e.lines) assert.ok(nm >= VISIBLE[0] && nm <= VISIBLE[1]);
  }
});

test("Balmer lines agree with 1/λ = R(1/2² − 1/n²)", () => {
  const R = 1.0968e7; // 1/m, Rydberg constant for hydrogen
  const balmer = [6, 5, 4, 3].map(n => 1e9 / (R * (1 / 4 - 1 / n ** 2)));
  linesOf("H").forEach((nm, k) => assert.ok(Math.abs(nm - balmer[k]) < 0.3, `${nm} vs ${balmer[k]}`));
});

test("an incandescent lamp gives a continuous spectrum, a gas gives lines", () => {
  assert.deepEqual(emission("lamp"), { continuous: true, lines: [] });
  for (const e of ELEMENTS) assert.deepEqual(emission(e.id), { continuous: false, lines: e.lines });
});

test("absorption lines coincide with the emission lines of the same gas", () => {
  for (const e of ELEMENTS) {
    assert.deepEqual(absorptionLines(e.id), emission(e.id).lines);
    assert.equal(coincide(absorptionLines(e.id), e.lines), e.lines.length);
  }
});

test("wavelength-to-colour mapping in the visible range", () => {
  const names = { 400: "tím", 410.2: "tím", 434.0: "chàm", 486.1: "lam", 546.1: "lục", 589.0: "vàng", 620: "cam", 656.3: "đỏ", 760: "đỏ", 380: "tím" };
  for (const [nm, name] of Object.entries(names)) assert.equal(colourName(Number(nm)), name, nm);
  assert.equal(colourName(300), "");
  assert.equal(colourName(800), "");
  const [r1, g1, b1] = wavelengthToRgb(656.3);
  assert.ok(r1 > 200 && g1 < 40 && b1 < 40); // red
  const [r2, g2, b2] = wavelengthToRgb(546.1);
  assert.ok(g2 > 200 && g2 > r2 && b2 < 60); // green
  const [r3, g3, b3] = wavelengthToRgb(450);
  assert.ok(b3 > 200 && b3 > r3 && b3 > g3); // blue
  const [r4, g4, b4] = wavelengthToRgb(589);
  assert.ok(r4 > 200 && g4 > 150 && b4 < 40); // yellow
  assert.deepEqual(wavelengthToRgb(379), [0, 0, 0]);
  assert.deepEqual(wavelengthToRgb(761), [0, 0, 0]);
  assert.deepEqual(wavelengthToRgb(NaN), [0, 0, 0]);
  for (let nm = 380; nm <= 760; nm++) {
    const rgb = wavelengthToRgb(nm);
    assert.ok(rgb.every(v => v >= 0 && v <= 255) && Math.max(...rgb) >= 90, `${nm}: ${rgb}`);
  }
});

test("matching identifies each element uniquely among the presets", () => {
  for (const e of ELEMENTS) {
    assert.equal(identify(e.lines), e.id);
    assert.equal(identify(e.lines.map(nm => nm + 0.1)), e.id); // small reading error
    for (const other of ELEMENTS) {
      if (other !== e) assert.ok(coincide(e.lines, other.lines) < e.lines.length, `${e.id} hidden in ${other.id}`);
    }
  }
  assert.equal(identify([]), null);
  assert.equal(identify([500, 600]), null);
  assert.equal(identify(linesOf("H").slice(1)), null); // a line missing: no exact match
  assert.equal(coincide(linesOf("He"), linesOf("Ne")), 1); // both have a red line at 667,8 nm
});

test("checking a guess: right only for the unknown gas, counts tries", () => {
  for (let k = 0; k < ELEMENTS.length; k++) {
    for (const g of ELEMENTS) {
      const s = { ...initialState(), unknown: k, guess: g.id };
      const out = check(s);
      assert.equal(out.correct, g === ELEMENTS[k]);
      assert.equal(s.solved, out.correct);
      assert.equal(s.checked, true);
      assert.equal(s.tries, 1);
      assert.equal(out.total, ELEMENTS[k].lines.length);
      if (out.correct) assert.equal(out.matched, out.total);
    }
  }
  const first = initialState();
  assert.equal(check(first).correct, false); // the starting picture is not already solved
});

test("the next unknown gas is deterministic, differs from the last one and visits every gas", () => {
  const a = initialState();
  const b = initialState();
  const seen = new Set();
  for (let k = 0; k < 200; k++) {
    const before = a.unknown;
    nextUnknown(a);
    nextUnknown(b);
    assert.equal(a.unknown, b.unknown);
    assert.notEqual(a.unknown, before);
    assert.ok(Number.isInteger(a.unknown) && a.unknown >= 0 && a.unknown < ELEMENTS.length);
    seen.add(a.unknown);
  }
  assert.equal(seen.size, ELEMENTS.length);
  const s = nextUnknown({ ...initialState(), tries: 3, checked: true, solved: true });
  assert.deepEqual([s.tries, s.checked, s.solved], [0, false, false]);
  // forged values do not break the model
  assert.equal(unknownElement({ unknown: 99 }).id, "Ne");
  assert.equal(unknownElement({ unknown: -3 }).id, "H");
  assert.ok(Number.isInteger(nextUnknown({ ...initialState(), unknown: 1e9, seed: -7.5 }).unknown));
});
