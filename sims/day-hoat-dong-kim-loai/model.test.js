import test from "node:test";
import assert from "node:assert/strict";
import { METALS, SOLUTIONS, SERIES, reaction, predicted, balanced, atoms, sub, metal, step, initialState } from "./model.js";

const mi = sym => METALS.findIndex(m => m.symbol === sym);
const si = id => SOLUTIONS.findIndex(s => s.id === id);
const pairs = METALS.flatMap((_, m) => SOLUTIONS.map((_, s) => [m, s]));

test("formula parser counts atoms, including brackets", () => {
  assert.deepEqual(atoms("Al2(SO4)3"), { Al: 2, S: 3, O: 12 });
  assert.deepEqual(atoms("Cu(NO3)2"), { Cu: 1, N: 2, O: 6 });
  assert.deepEqual(atoms("Fe(OH)2↓"), { Fe: 1, O: 2, H: 2 });
  assert.equal(balanced("2Al + 6HCl -> 2AlCl3 + 3H2↑"), true);
  assert.equal(balanced("Al + 3HCl -> AlCl3 + H2↑"), false);
  assert.equal(sub("2Al + 3CuSO4 -> Al2(SO4)3 + 3Cu"), "2Al + 3CuSO₄ → Al₂(SO₄)₃ + 3Cu");
});

test("every equation of every allowed pair is balanced", () => {
  let n = 0;
  for (const [m, s] of pairs) {
    for (const eq of reaction(m, s)?.eq ?? []) {
      assert.ok(balanced(eq), `${METALS[m].symbol} + ${SOLUTIONS[s].id}: ${eq}`);
      n++;
    }
  }
  assert.ok(n >= 30);
});

test("a reaction happens iff the activity series says so", () => {
  for (const [m, s] of pairs) assert.equal(reaction(m, s) !== null, predicted(m, s), `${METALS[m].symbol} + ${SOLUTIONS[s].id}`);
  // the rule itself, written out: more active than the cation's metal, before H for the acid
  const before = (a, b) => SERIES.indexOf(a) < SERIES.indexOf(b);
  for (const sym of ["Mg", "Al", "Zn", "Fe", "Pb", "Cu", "Ag", "Au"]) {
    assert.equal(predicted(mi(sym), si("hcl")), before(sym, "H"), `${sym} + HCl`);
    assert.equal(predicted(mi(sym), si("cuso4")), before(sym, "Cu"), `${sym} + CuSO4`);
    assert.equal(predicted(mi(sym), si("agno3")), before(sym, "Ag"), `${sym} + AgNO3`);
    assert.equal(predicted(mi(sym), si("feso4")), before(sym, "Fe"), `${sym} + FeSO4`);
    assert.equal(predicted(mi(sym), si("h2o")), false, `${sym} + H2O`);
  }
});

test("pairs that do not react return null", () => {
  for (const [sym, id] of [["Cu", "hcl"], ["Ag", "hcl"], ["Au", "agno3"], ["Cu", "cuso4"], ["Ag", "cuso4"], ["Fe", "feso4"], ["Pb", "feso4"], ["Cu", "feso4"], ["Ag", "agno3"], ["Mg", "h2o"], ["Al", "h2o"], ["Fe", "h2o"]]) {
    assert.equal(reaction(mi(sym), si(id)), null, `${sym} + ${id}`);
  }
});

test("K and Na react with the water first, also in salt solutions", () => {
  for (const sym of ["K", "Na"]) {
    for (const id of ["cuso4", "agno3", "feso4", "h2o"]) {
      const r = reaction(mi(sym), si(id));
      assert.equal(r.eq[0], `2${sym} + 2H2O -> 2${sym}OH + H2↑`);
      assert.equal(r.deposit, null); // no metal is displaced
      assert.equal(r.dissolves, true);
    }
    assert.equal(reaction(mi(sym), si("cuso4")).ppt, "blue"); // Cu(OH)₂
    assert.equal(reaction(mi(sym), si("hcl")).eq[0], `2${sym} + 2HCl -> 2${sym}Cl + H2↑`);
  }
});

test("what is seen: metal deposits, gas, colour", () => {
  assert.equal(reaction(mi("Zn"), si("cuso4")).deposit, "Cu");
  assert.equal(reaction(mi("Cu"), si("agno3")).deposit, "Ag");
  assert.equal(reaction(mi("Cu"), si("agno3")).to, "blue");
  assert.equal(reaction(mi("Mg"), si("feso4")).deposit, "Fe");
  assert.equal(reaction(mi("Fe"), si("hcl")).gas, true);
  assert.equal(reaction(mi("Fe"), si("hcl")).eq[0], "Fe + 2HCl -> FeCl2 + H2↑"); // iron(II), not iron(III)
  assert.equal(reaction(mi("Zn"), si("cuso4")).gas, false);
  assert.equal(reaction(mi("Pb"), si("hcl")).slow, true);
});

test("indices are clamped and the animation ends once", () => {
  assert.equal(metal(-3).symbol, "K");
  assert.equal(metal(99).symbol, "Au");
  const s = { ...initialState(), progress: 0 };
  let ends = 0;
  for (let i = 0; i < 1000; i++) ends += step(s, 1 / 120) ? 1 : 0;
  assert.equal(ends, 1);
  assert.equal(s.progress, 1);
});
