import test from "node:test";
import assert from "node:assert/strict";
import { REACTIONS, oxidationNumbers, parseSpecies, parseFormula, analyze, status, tally, checkStep, initialState, clearPractice, reactionById, sanitize, LAST_STEP } from "./model.js";

// Expected oxidation numbers, written by hand from the textbook rules (independent of the code).
const EXPECTED = {
  Fe: { Fe: 0 }, O2: { O: 0 }, Fe2O3: { Fe: 3, O: -2 }, Zn: { Zn: 0 }, HCl: { H: 1, Cl: -1 }, ZnCl2: { Zn: 2, Cl: -1 },
  H2: { H: 0 }, CO: { C: 2, O: -2 }, CO2: { C: 4, O: -2 }, Cu: { Cu: 0 }, HNO3: { H: 1, N: 5, O: -2 },
  "Cu(NO3)2": { Cu: 2, N: 5, O: -2 }, NO: { N: 2, O: -2 }, NO2: { N: 4, O: -2 }, H2O: { H: 1, O: -2 },
  "Fe(NO3)3": { Fe: 3, N: 5, O: -2 }, Al: { Al: 0 }, H2SO4: { H: 1, S: 6, O: -2 }, "Al2(SO4)3": { Al: 3, S: 6, O: -2 },
  SO2: { S: 4, O: -2 }, C: { C: 0 }, MnO2: { Mn: 4, O: -2 }, MnCl2: { Mn: 2, Cl: -1 }, Cl2: { Cl: 0 },
  KMnO4: { K: 1, Mn: 7, O: -2 }, KCl: { K: 1, Cl: -1 }, NH3: { N: -3, H: 1 }, CuSO4: { Cu: 2, S: 6, O: -2 },
  FeSO4: { Fe: 2, S: 6, O: -2 }, "Fe^2+": { Fe: 2 }, "MnO4^-": { Mn: 7, O: -2 }, "H^+": { H: 1 }, "Fe^3+": { Fe: 3 }, "Mn^2+": { Mn: 2 },
};

test("oxidation numbers of every species in every reaction", () => {
  for (const r of REACTIONS) {
    for (const text of [...r.left, ...r.right]) {
      const { f, z } = parseSpecies(text);
      assert.deepEqual(oxidationNumbers(f, z), EXPECTED[text], text);
    }
  }
});

test("oxidation-number rules: simple substance 0, O −2, H +1, alkali metal +1, sum = charge", () => {
  for (const f of ["Na", "S", "P4", "N2", "Br2"]) assert.ok(Object.values(oxidationNumbers(f)).every(v => v === 0), f);
  for (const [f, z, el, v] of [
    ["NaCl", 0, "Na", 1], ["Na2O", 0, "O", -2], ["K2Cr2O7", 0, "Cr", 6], ["NaOH", 0, "H", 1], ["H2S", 0, "S", -2], ["FeS", 0, "Fe", 2],
    ["KClO3", 0, "Cl", 5], ["NH4", 1, "N", -3], ["SO4", -2, "S", 6], ["Cr2O7", -2, "Cr", 6], ["MnO4", -1, "Mn", 7],
    ["Na2SO4", 0, "S", 6], ["Fe2(SO4)3", 0, "Fe", 3], ["Ca3(PO4)2", 0, "P", 5], ["Cl", -1, "Cl", -1], ["Al", 3, "Al", 3],
  ]) {
    assert.equal(oxidationNumbers(f, z)[el], v, `${el} in ${f}`);
    const counts = parseFormula(f);
    const on = oxidationNumbers(f, z);
    assert.equal(Object.keys(counts).reduce((s, e) => s + counts[e] * on[e], 0), z, `sum in ${f}`);
  }
});

test("each reaction has one oxidation and one reduction with the right electron counts", () => {
  const want = {
    "fe-o2": [["Fe", 3, 4], ["O", 4, 3]], "zn-hcl": [["Zn", 2, 1], ["H", 2, 1]], "fe2o3-co": [["Fe", 3, 2], ["C", 2, 3]],
    "cu-hno3-loang": [["Cu", 2, 3], ["N", 3, 2]], "cu-hno3-dac": [["Cu", 2, 1], ["N", 1, 2]], "fe-hno3-loang": [["Fe", 3, 1], ["N", 3, 1]],
    "al-h2so4-dac": [["Al", 3, 2], ["S", 2, 3]], "c-h2so4-dac": [["C", 4, 1], ["S", 2, 2]], "mno2-hcl": [["Mn", 2, 1], ["Cl", 2, 1]],
    "kmno4-hcl": [["Mn", 5, 2], ["Cl", 2, 5]], "nh3-o2": [["N", 5, 4], ["O", 4, 5]], "fe-cuso4": [["Fe", 2, 1], ["Cu", 2, 1]],
    "fe2-mno4": [["Fe", 1, 5], ["Mn", 5, 1]],
  };
  for (const r of REACTIONS) {
    const A = analyze(r);
    assert.equal(A.halves.length, 2, r.id);
    assert.equal(A.halves.filter(h => h.ox).length, 1, r.id);
    assert.deepEqual(A.halves.map(h => [h.el, h.e, h.mult]), want[r.id], r.id);
    const [p, q] = A.halves;
    assert.equal(p.e * p.mult, q.e * q.mult, `${r.id}: electrons given = electrons taken`);
    assert.ok(A.species[A.reducer].left && A.species[A.oxidiser].left);
  }
});

test("final coefficients balance atoms and charge and are the smallest whole numbers", () => {
  for (const r of REACTIONS) {
    assert.equal(r.coeffs.length, r.left.length + r.right.length, r.id);
    assert.equal(status(r, r.coeffs), "balanced", r.id);
    const { left, right } = tally(r, r.coeffs);
    assert.deepEqual(left.atoms, right.atoms, r.id);
    assert.equal(left.charge, right.charge, r.id);
    assert.equal(status(r, r.coeffs.map(c => 2 * c)), "multiple", r.id);
  }
  assert.equal(tally(reactionById("fe2-mno4"), reactionById("fe2-mno4").coeffs).left.charge, 17);
});

test("electron-balance coefficients agree with the final equation", () => {
  for (const r of REACTIONS) {
    const A = analyze(r);
    assert.ok(A.partial.filter(c => c !== null).length >= 2, r.id);
    A.partial.forEach((c, i) => c !== null && assert.equal(c, r.coeffs[i], `${r.id} species ${i}`));
    // electrons moved in the written equation, counted on the products that hold the new oxidation state
    for (const h of A.halves) {
      const moved = A.species.reduce((sum, s, i) => (!s.left && s.on[h.el] === h.b ? sum + r.coeffs[i] * s.counts[h.el] * Math.abs(h.b - h.a) : sum), 0);
      assert.equal(moved, A.electrons, `${r.id} ${h.el}`);
    }
  }
  // HNO₃ is also the source of nitrate in the salt, so the electron balance does not fix it
  assert.equal(analyze(reactionById("cu-hno3-loang")).partial[1], null);
});

test("practice checks accept the right answers and reject wrong ones", () => {
  for (const r of REACTIONS) {
    const A = analyze(r);
    const [h1, h2] = A.halves;
    const s = clearPractice({ ...initialState(), reaction: r.id, mode: "practice" });
    Object.assign(s, { step: 1, p1: h1.a, p2: h1.b, p3: h2.a, p4: h2.b });
    assert.ok(checkStep(s).ok, r.id);
    s.p2 += 1;
    assert.ok(!checkStep(s).ok);
    Object.assign(s, { step: 2, pRed: A.oxidiser, pOx: A.reducer });
    assert.ok(!checkStep(s).ok);
    Object.assign(s, { pRed: A.reducer, pOx: A.oxidiser });
    assert.ok(checkStep(s).ok);
    Object.assign(s, { step: 3, pe1: h1.e, pe2: h2.e });
    assert.ok(checkStep(s).ok);
    Object.assign(s, { step: 4, pm1: 2 * h1.mult, pm2: 2 * h2.mult });
    assert.ok(!checkStep(s).ok);
    Object.assign(s, { pm1: h1.mult, pm2: h2.mult });
    assert.ok(checkStep(s).ok);
    s.step = LAST_STEP;
    r.coeffs.forEach((c, i) => (s[`c${i + 1}`] = 2 * c));
    assert.ok(!checkStep(s).ok);
    r.coeffs.forEach((c, i) => (s[`c${i + 1}`] = c));
    assert.ok(checkStep(s).ok);
  }
});

test("forged state is clamped", () => {
  const s = sanitize({ reaction: "nope", step: 99, c1: -5, pRed: 40, mode: "x" }, initialState());
  assert.equal(s.step, LAST_STEP);
  assert.equal(s.c1, 1);
  assert.equal(s.pRed, 5);
  assert.equal(s.reaction, undefined);
  assert.equal(s.mode, undefined);
});
