import test from "node:test";
import assert from "node:assert/strict";
import { SOLUTIONS, solutionById, alpha, ionConcentrations, ionsPerUnit, conductivity, tester, measure, concentration, equation, KA_ACETIC, KAPPA_WATER } from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b)), `${a} ≠ ${b}`);

test("strong electrolytes are fully dissociated", () => {
  for (const sol of SOLUTIONS.filter(x => x.kind === "strong")) {
    assert.equal(alpha(sol, 0.1), 1);
    for (const { c } of ionConcentrations(sol, 0.1)) assert.ok(c >= 0.1 - 1e-12);
    assert.ok(equation(sol).includes("→") && !equation(sol).includes("⇌"));
  }
});

test("weak electrolyte: α from Kₐ satisfies Kₐ = Cα²/(1−α) and grows on dilution", () => {
  const acid = solutionById("ch3cooh");
  let prev = 0;
  for (const C of [1, 0.1, 0.01, 0.001]) {
    const a = alpha(acid, C);
    near((C * a * a) / (1 - a), KA_ACETIC);
    assert.ok(a > prev && a < 1, `C = ${C}`);
    prev = a;
  }
  // textbook values: 0,1 mol/L → α ≈ 1,3 %; 0,01 mol/L → α ≈ 4,1 %
  assert.ok(Math.abs(alpha(acid, 0.1) - 0.0131) < 0.0003);
  assert.ok(Math.abs(alpha(acid, 0.01) - 0.0410) < 0.001);
  assert.ok(equation(acid).includes("⇌"));
});

test("non-electrolytes and water give no ions from the solute", () => {
  for (const id of ["saccarose", "ethanol", "water"]) {
    const sol = solutionById(id);
    assert.equal(alpha(sol, 0.5), 0);
    assert.equal(ionsPerUnit(sol), 0);
    assert.equal(conductivity(sol, 0.5), KAPPA_WATER);
  }
});

test("ion count follows the formula", () => {
  assert.equal(ionsPerUnit(solutionById("cacl2")), 3);
  assert.equal(ionsPerUnit(solutionById("nacl")), 2);
  const ca = ionConcentrations(solutionById("cacl2"), 0.2);
  assert.deepEqual(ca.map(x => x.ion), ["Ca2+", "Cl-"]);
  near(ca[0].c, 0.2);
  near(ca[1].c, 0.4);
  assert.equal(equation(solutionById("cacl2")), "CaCl₂ → Ca²⁺ + 2Cl⁻");
});

test("conductivity model: κ = 0,1·Σcλ° + κ(nước)", () => {
  near(conductivity(solutionById("nacl"), 0.1), 0.1 * 0.1 * (50.1 + 76.3) + KAPPA_WATER);
  near(conductivity(solutionById("cacl2"), 0.1), 0.1 * (0.1 * 119 + 0.2 * 76.3) + KAPPA_WATER);
  // circuit: I = U/(R_bulb + R_dd), brightness = I²R_bulb / P_rated
  const t = tester(solutionById("nacl"), 0.1);
  near(t.current, 6 / (12 + 5 / t.kappa));
  near(t.brightness, (t.current ** 2 * 12) / 3);
});

test("brightness ordering at equal concentration: strong > weak > none", () => {
  for (const C of [0.001, 0.01, 0.1, 1]) {
    const b = id => tester(solutionById(id), C).brightness;
    for (const strong of ["nacl", "hcl", "naoh", "cacl2"]) assert.ok(b(strong) > b("ch3cooh"), `${strong} C=${C}`);
    assert.ok(b("ch3cooh") > b("saccarose") && b("ch3cooh") > b("ethanol"));
    assert.ok(b("saccarose") < 1e-6);
  }
  // CaCl₂ gives more ions than NaCl, so it conducts better at the same concentration
  assert.ok(tester(solutionById("cacl2"), 0.1).kappa > tester(solutionById("nacl"), 0.1).kappa);
});

test("concentration slider is a log scale and forged values are clamped", () => {
  near(concentration({ logC: -2 }), 0.01);
  assert.equal(concentration({ logC: 9 }), 1);
  assert.equal(concentration({ logC: -99 }), 0.001);
  assert.equal(measure({ solution: "water", logC: 0 }).C, 0);
  assert.equal(measure({ solution: "nope", logC: -1 }).sol.id, SOLUTIONS[0].id);
});
