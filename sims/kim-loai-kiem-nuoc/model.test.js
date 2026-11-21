import test from "node:test";
import assert from "node:assert/strict";
import { METALS, VM, RANK_ANSWER, equation, base, amounts, extent, sub, step, initialState } from "./model.js";

// Count atoms in "2Ca(OH)2" style terms.
function atoms(term) {
  const [, coef, formula] = term.trim().match(/^(\d*)(.+)$/);
  const count = {};
  const walk = (f, k) => {
    for (const m of f.matchAll(/\(([^)]+)\)(\d*)|([A-Z][a-z]?)(\d*)/g)) {
      if (m[1]) walk(m[1], k * (Number(m[2]) || 1));
      else count[m[3]] = (count[m[3]] ?? 0) + k * (Number(m[4]) || 1);
    }
  };
  walk(formula, Number(coef) || 1);
  return count;
}
const side = s => s.split(" + ").map(atoms).reduce((a, b) => (Object.entries(b).forEach(([k, v]) => (a[k] = (a[k] ?? 0) + v)), a), {});
const balanced = eq => {
  const [l, r] = eq.split(" -> ");
  return JSON.stringify(Object.entries(side(l)).sort()) === JSON.stringify(Object.entries(side(r)).sort());
};
const idx = sym => METALS.findIndex(m => m.sym === sym);

test("equations are balanced and have the textbook form", () => {
  assert.equal(equation(idx("Na")), "2Na + 2H2O -> 2NaOH + H2");
  assert.equal(equation(idx("Ca")), "Ca + 2H2O -> Ca(OH)2 + H2");
  assert.equal(equation(idx("Mg")), "Mg + 2H2O -> Mg(OH)2 + H2");
  METALS.forEach((_, i) => assert.ok(balanced(equation(i)), equation(i)));
  assert.equal(sub(equation(idx("Ca"))), "Ca + 2H₂O → Ca(OH)₂ + H₂");
});

test("n(H₂) = n(M)/2 for alkali metals and n(M) for Ca, Mg; V at 24,79 L/mol", () => {
  const na = amounts(idx("Na"), 0.23);
  assert.ok(Math.abs(na.nMetal - 0.01) < 1e-12);
  assert.ok(Math.abs(na.nH2 - 0.005) < 1e-12);
  assert.ok(Math.abs(na.vH2 - 0.005 * 24.79) < 1e-12);
  assert.equal(VM, 24.79);
  for (const sym of ["Li", "Na", "K"]) {
    const a = amounts(idx(sym), 0.5);
    assert.ok(Math.abs(a.nH2 - a.nMetal / 2) < 1e-12);
  }
  const ca = amounts(idx("Ca"), 0.4);
  assert.ok(Math.abs(ca.nH2 - 0.01) < 1e-12);
  assert.ok(Math.abs(ca.vH2 - 0.2479) < 1e-12);
});

test("reactivity order Li < Na < K, and the ranking answer agrees", () => {
  const v = sym => METALS[idx(sym)].vigour;
  assert.ok(v("Li") < v("Na") && v("Na") < v("K"));
  assert.equal(RANK_ANSWER, ["Li", "Na", "K"].sort((a, b) => v(a) - v(b)).join("<"));
});

test("Mg barely reacts with cold water: no visible H₂", () => {
  const i = idx("Mg");
  assert.equal(extent(i), 0);
  assert.equal(amounts(i, 0.24).vH2, 0);
  assert.ok(amounts(i, 0.24).nH2 > 0); // it would, given time or hot water
});

test("the solution becomes basic: the product is a hydroxide", () => {
  for (const sym of ["Li", "Na", "K", "Ca"]) {
    const i = idx(sym);
    assert.match(base(i), /OH/);
    assert.ok(equation(i).includes(base(i)));
    assert.equal(extent(i), 1);
  }
});

test("lighter-than-water alkali metals float, Ca and Mg sink", () => {
  for (const m of METALS) assert.equal(m.density < 1, m.group === 1, m.sym);
});

test("animation advances only after the drop and reports its end once", () => {
  const s = initialState();
  assert.equal(step(s, 1), false);
  assert.equal(s.progress, 0);
  s.dropped = true;
  let ends = 0;
  for (let k = 0; k < 2000; k++) ends += step(s, 1 / 120);
  assert.equal(ends, 1);
  assert.equal(s.progress, 1);
});
