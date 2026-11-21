import test from "node:test";
import assert from "node:assert/strict";
import { REACTIONS, reactionById, solve, molarMass, parseFormula, amounts, initialState, yieldPercent, solveState } from "./model.js";

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ""} ${a} ≠ ${b}`);

test("every equation is balanced", () => {
  for (const r of REACTIONS) {
    const side = list => {
      const t = {};
      for (const [f, nu] of list) for (const [el, k] of Object.entries(parseFormula(f))) t[el] = (t[el] ?? 0) + k * nu;
      return t;
    };
    assert.deepEqual(side(r.left), side(r.right), r.id);
  }
});

test("molar masses", () => {
  for (const [f, M] of [["H2", 2], ["O2", 32], ["H2O", 18], ["NH3", 17], ["FeS", 88], ["CaCO3", 100], ["HCl", 36.5], ["CO2", 44], ["Al2O3", 102], ["CH4", 16], ["ZnCl2", 136]]) {
    near(molarMass(f), M, f);
  }
});

test("limiting reagent is the smaller n/coefficient; leftovers and theoretical product", () => {
  // 2H₂ + O₂ → 2H₂O, 3 mol H₂ and 2 mol O₂: 3/2 < 2/1 so H₂ runs out, 0,5 mol O₂ left, 3 mol H₂O
  const a = solve(reactionById("h2-o2"), [3, 2], 1);
  assert.equal(a.limiting, 0);
  near(a.leftComplete[1], 0.5);
  near(a.leftComplete[0], 0);
  near(a.theoretical[0], 3);
  // N₂ + 3H₂: 2 mol N₂, 3 mol H₂ → H₂ limits (3/3 < 2/1), N₂ left 1 mol, NH₃ 2 mol
  const b = solve(reactionById("n2-h2"), [2, 3], 1);
  assert.equal(b.limiting, 1);
  near(b.leftComplete[0], 1);
  near(b.theoretical[0], 2);
  // CaCO₃ + 2HCl: 0,5 mol CaCO₃, 0,6 mol HCl → HCl limits, CO₂ 0,3 mol, CaCO₃ left 0,2 mol
  const c = solve(reactionById("caco3-hcl"), [0.5, 0.6], 1);
  assert.equal(c.limiting, 1);
  near(c.leftComplete[0], 0.2);
  near(c.main.theoretical, 0.3);
  // not simply "the smaller amount": 1 mol N₂ with 2 mol H₂ → H₂ (the larger amount) still runs out
  assert.equal(solve(reactionById("n2-h2"), [1, 2], 1).limiting, 1);
});

test("equal ratios mean both reactants are used up", () => {
  for (const r of REACTIONS) {
    const n = r.left.map(([, nu]) => nu * 0.7);
    const x = solve(r, n, 1);
    assert.equal(x.limiting, -1, r.id);
    x.leftComplete.forEach(v => near(v, 0, r.id));
  }
  // in grams: 4 g H₂ (2 mol) with 32 g O₂ (1 mol)
  const s = { ...initialState(), unit: "g", m1: 4, m2: 32 };
  assert.equal(solveState(s).limiting, -1);
  // 56 g Fe and 32 g S: 1 mol each, Fe + S → FeS exactly
  assert.equal(solveState({ ...s, reaction: "fe-s", m1: 56, m2: 32 }).limiting, -1);
});

test("yield scales the product; H = actual / theoretical", () => {
  const x = solve(reactionById("n2-h2"), [1, 3], 0.25);
  near(x.main.theoretical, 2);
  near(x.main.actual, 0.5);
  near(yieldPercent(x.main.actual, x.main.theoretical), 25);
  // unreacted reactants grow when the yield is below 100 %
  near(x.leftActual[0], 0.75);
  near(x.leftActual[1], 2.25);
});

test("mass is conserved at every yield", () => {
  for (const r of REACTIONS) {
    for (const H of [0, 0.37, 0.8, 1]) {
      for (const n of [[1, 1], [0.3, 2.5], [4, 0.2]]) {
        const x = solve(r, n, H);
        assert.ok(Math.abs(x.massBefore - x.massAfter) < 1e-9 * x.massBefore, `${r.id} H=${H}`);
      }
    }
  }
});

test("grams are converted with M and forged amounts are clamped", () => {
  const s = { ...initialState(), reaction: "caco3-hcl", unit: "g", m1: 50, m2: 36.5 };
  const [a, b] = amounts(s);
  near(a, 0.5);
  near(b, 1);
  assert.deepEqual(amounts({ ...initialState(), n1: -4, n2: NaN }), [0, 0]);
  assert.deepEqual(amounts({ ...initialState(), n1: 1e9 }), [10, 2]);
});
