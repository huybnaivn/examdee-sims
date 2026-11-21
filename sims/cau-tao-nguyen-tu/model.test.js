import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENTS, TARGETS, initialState, elementByZ, massNumber, netCharge, isStable, shells,
  chargeText, speciesSymbol, speciesKind, describe, currentTarget, matchesTarget, checkTarget, nextTarget,
} from "./model.js";

test("element lookup by Z", () => {
  assert.equal(ELEMENTS.length, 20);
  const expected = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca".split(" ");
  expected.forEach((symbol, i) => assert.equal(elementByZ(i + 1).symbol, symbol));
  assert.equal(elementByZ(11).name, "Sodium");
  assert.equal(elementByZ(19).name, "Potassium");
  assert.equal(elementByZ(16).name, "Sulfur");
  assert.equal(elementByZ(0), null);
  assert.equal(elementByZ(21), null);
});

test("A = Z + N and charge = Z − e", () => {
  assert.equal(massNumber(6, 6), 12);
  assert.equal(massNumber(17, 20), 37);
  assert.equal(netCharge(11, 10), 1);
  assert.equal(netCharge(8, 10), -2);
  assert.equal(netCharge(6, 6), 0);
  const d = describe({ ...initialState(), protons: 13, neutrons: 14, electrons: 10 });
  assert.equal(d.a, d.z + d.n);
  assert.equal(d.a, 27);
  assert.equal(d.charge, d.z - d.e);
  assert.equal(d.charge, 3);
});

test("shells fill in the order 2, 8, 8, 2 for 1…20 electrons", () => {
  const known = { 1: [1], 2: [2], 3: [2, 1], 10: [2, 8], 11: [2, 8, 1], 17: [2, 8, 7], 18: [2, 8, 8], 19: [2, 8, 8, 1], 20: [2, 8, 8, 2] };
  for (let e = 1; e <= 20; e++) {
    const sh = shells(e);
    assert.equal(sh.reduce((a, b) => a + b, 0), e);
    sh.forEach((count, i) => {
      assert.ok(count >= 1 && count <= [2, 8, 8, 2][i]);
      if (i < sh.length - 1) assert.equal(count, [2, 8, 8, 2][i]); // inner shells are full
    });
    if (known[e]) assert.deepEqual(sh, known[e]);
  }
  assert.deepEqual(shells(0), []);
});

test("ion naming", () => {
  assert.equal(speciesKind(0), "atom");
  assert.equal(speciesKind(2), "cation");
  assert.equal(speciesKind(-1), "anion");
  assert.equal(chargeText(0), "");
  assert.equal(chargeText(1), "+");
  assert.equal(chargeText(3), "3+");
  assert.equal(chargeText(-2), "2−");
  assert.equal(speciesSymbol("Na", 1), "Na⁺");
  assert.equal(speciesSymbol("Al", 3), "Al³⁺");
  assert.equal(speciesSymbol("O", -2), "O²⁻");
  assert.equal(speciesSymbol("Cl", -1), "Cl⁻");
  assert.equal(speciesSymbol("C", 0), "C");
  assert.equal(describe({ protons: 11, neutrons: 12, electrons: 10 }).kindLabel, "Cation Na⁺");
  assert.equal(describe({ protons: 17, neutrons: 18, electrons: 18 }).kindLabel, "Anion Cl⁻");
  assert.equal(describe({ protons: 6, neutrons: 6, electrons: 6 }).kindLabel, "Nguyên tử carbon");
});

test("the stability table is consulted by Z and A", () => {
  assert.ok(isStable(6, 6)); // ¹²C
  assert.ok(isStable(6, 7)); // ¹³C
  assert.ok(!isStable(6, 8)); // ¹⁴C
  assert.ok(isStable(1, 0)); // ¹H
  assert.ok(isStable(1, 1)); // ²H
  assert.ok(!isStable(1, 2)); // ³H
  assert.ok(!isStable(19, 21)); // ⁴⁰K
  assert.ok(isStable(18, 22)); // ⁴⁰Ar: same A, different Z
  assert.ok(isStable(20, 20)); // ⁴⁰Ca
  assert.ok(!isStable(4, 4)); // ⁸Be
  assert.ok(!isStable(20, 0));
  // electrons do not matter
  assert.equal(describe({ protons: 11, neutrons: 12, electrons: 10 }).stable, true);
  assert.equal(describe({ protons: 11, neutrons: 11, electrons: 11 }).stable, false);
  // every listed isotope has at least as many nucleons as protons
  for (const el of ELEMENTS) for (const a of el.stable) assert.ok(a >= el.z);
});

test("every target is a real particle within the stepper ranges, with a truthful label", () => {
  assert.equal(new Set(TARGETS.map(t => t.id)).size, TARGETS.length);
  for (const t of TARGETS) {
    const d = describe({ protons: t.z, neutrons: t.n, electrons: t.e });
    assert.deepEqual([d.z, d.n, d.e], [t.z, t.n, t.e]);
    assert.ok(t.label.startsWith(d.kind === "atom" ? "nguyên tử" : "ion"));
    const sup = String(d.a).replace(/\d/g, c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c]);
    assert.ok(t.label.includes(sup + d.species), `${t.label} vs ${sup}${d.species}`);
  }
});

test("target checking", () => {
  const s = { ...initialState(), challenge: true };
  assert.equal(currentTarget(s).id, "na-23-cation");
  assert.equal(checkTarget(s), null); // starts as ¹²C
  Object.assign(s, { protons: 11, neutrons: 12, electrons: 11 });
  assert.ok(!matchesTarget(s)); // neutral atom, not the ion
  assert.equal(checkTarget(s), null);
  s.electrons = 10;
  assert.equal(checkTarget(s), "na-23-cation");
  assert.equal(s.solved, true);
  assert.equal(checkTarget(s), null); // reported once only
  s.neutrons = 11;
  s.neutrons = 12;
  assert.equal(checkTarget(s), null);
  nextTarget(s);
  assert.equal(s.solved, false);
  assert.equal(currentTarget(s).id, "c-12");
  Object.assign(s, { protons: 6, neutrons: 6, electrons: 6 });
  assert.equal(checkTarget(s), "c-12");
  // wraps around, and nothing is reported outside challenge mode
  for (let i = 0; i < TARGETS.length - 1; i++) nextTarget(s);
  assert.equal(s.target, 0);
  const free = { ...initialState(), protons: 11, neutrons: 12, electrons: 10 };
  assert.equal(checkTarget(free), null);
});
