import test from "node:test";
import assert from "node:assert/strict";
import { HALOGENS, PAIRS, predKey, reacts, equation, resultColour, WATER_COLOUR, tried, markTried, score, allPredicted, initialState, step, sub } from "./model.js";

const at = sym => HALOGENS.findIndex(h => h.sym === sym);

function atoms(term) {
  const [, coef, formula] = term.trim().match(/^(\d*)(.+)$/);
  const count = {};
  for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) count[m[1]] = (count[m[1]] ?? 0) + (Number(coef) || 1) * (Number(m[2]) || 1);
  return count;
}
const side = s => s.split(" + ").map(atoms).reduce((a, b) => (Object.entries(b).forEach(([k, v]) => (a[k] = (a[k] ?? 0) + v)), a), {});
const balanced = eq => {
  const [l, r] = eq.split(" -> ");
  return JSON.stringify(Object.entries(side(l)).sort()) === JSON.stringify(Object.entries(side(r)).sort());
};

test("a halogen displaces only the halides below it", () => {
  assert.ok(reacts(at("Cl"), at("Br")));
  assert.ok(reacts(at("Cl"), at("I")));
  assert.ok(reacts(at("Br"), at("I")));
  assert.ok(!reacts(at("Br"), at("Cl")));
  assert.ok(!reacts(at("I"), at("Cl")));
  assert.ok(!reacts(at("I"), at("Br")));
  for (const h of [1, 2, 3]) assert.ok(!reacts(h, h));
  assert.equal(PAIRS.filter(([h, x]) => reacts(h, x)).length, 3);
});

test("equations are balanced and in the textbook form", () => {
  assert.equal(equation(at("Cl"), at("Br")), "Cl2 + 2KBr -> 2KCl + Br2");
  assert.equal(equation(at("Br"), at("Cl")), null);
  for (const [h, x] of PAIRS) if (reacts(h, x)) assert.ok(balanced(equation(h, x)), equation(h, x));
  assert.equal(sub(equation(at("Br"), at("I"))), "Br₂ + 2KI → 2KBr + I₂");
});

test("oxidising power F₂ > Cl₂ > Br₂ > I₂: each halogen displaces every one below it", () => {
  for (let a = 0; a < HALOGENS.length; a++) for (let b = 0; b < HALOGENS.length; b++) assert.equal(reacts(a, b), a < b);
});

test("down the group atomic radius grows and electronegativity falls", () => {
  for (let i = 1; i < HALOGENS.length; i++) {
    assert.ok(HALOGENS[i].radius > HALOGENS[i - 1].radius);
    assert.ok(HALOGENS[i].chi < HALOGENS[i - 1].chi);
    assert.ok(HALOGENS[i].Z > HALOGENS[i - 1].Z);
    assert.ok(HALOGENS[i].bp > HALOGENS[i - 1].bp);
  }
  assert.deepEqual(HALOGENS.map(h => h.chi), [3.98, 3.16, 2.96, 2.66]);
  assert.deepEqual(HALOGENS.map(h => h.state), ["khí", "khí", "lỏng", "rắn"]);
});

test("the tube shows the freed halogen's colour only when there is a reaction", () => {
  assert.deepEqual(resultColour(at("Cl"), at("Br")), WATER_COLOUR[at("Br")]);
  assert.deepEqual(resultColour(at("Br"), at("Cl")), WATER_COLOUR[at("Br")]);
  assert.deepEqual(resultColour(at("Cl"), at("I")), WATER_COLOUR[at("I")]);
});

test("predictions are scored out of six", () => {
  const s = initialState();
  assert.equal(allPredicted(s), false);
  for (const [h, x] of PAIRS) s[predKey(h, x)] = reacts(h, x) ? "yes" : "no";
  assert.ok(allPredicted(s));
  assert.equal(score(s), 6);
  s.pBrCl = "yes";
  assert.equal(score(s), 5);
});

test("tried cells are tracked, and a forged grid string is ignored", () => {
  const s = initialState();
  markTried(s, 1, 2);
  assert.ok(tried(s, 1, 2));
  assert.ok(!tried(s, 2, 1));
  s.done = "xyz";
  assert.ok(!tried(s, 1, 2));
  markTried(s, 3, 3);
  assert.equal(s.done, "000000001");
});

test("adding animation ends once", () => {
  const s = { ...initialState(), added: true };
  let ends = 0;
  for (let k = 0; k < 1000; k++) ends += step(s, 1 / 120);
  assert.equal(ends, 1);
});
