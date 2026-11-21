import test from "node:test";
import assert from "node:assert/strict";
import { REACTIONS, MAX, parseFormula, atomCounts, elements, species, status, reactionById, coefficients, initialState, pretty } from "./model.js";

test("atom counting: subscripts, multi-letter elements, repeats and brackets", () => {
  assert.deepEqual(parseFormula("H2O"), { H: 2, O: 1 });
  assert.deepEqual(parseFormula("Fe3O4"), { Fe: 3, O: 4 });
  assert.deepEqual(parseFormula("AlCl3"), { Al: 1, Cl: 3 });
  assert.deepEqual(parseFormula("CO"), { C: 1, O: 1 });
  assert.deepEqual(parseFormula("C2H5OH"), { C: 2, H: 6, O: 1 });
  assert.deepEqual(parseFormula("Fe(OH)3"), { Fe: 1, O: 3, H: 3 });
  assert.deepEqual(parseFormula("Al2(SO4)3"), { Al: 2, S: 3, O: 12 });
  assert.deepEqual(parseFormula("C12H22O11"), { C: 12, H: 22, O: 11 });
  for (const bad of ["", "h2o", "H2O)", "(OH", "H2 O"]) assert.throws(() => parseFormula(bad));
});

test("coefficients multiply the atom counts on each side", () => {
  const r = reactionById("al-hcl");
  assert.deepEqual(atomCounts(r, [2, 6, 2, 3]), {
    left: { Al: 2, H: 6, Cl: 6 },
    right: { Al: 2, Cl: 6, H: 6 },
  });
  assert.deepEqual(atomCounts(reactionById("h2-o2"), [1, 1, 1]), { left: { H: 2, O: 2 }, right: { H: 2, O: 1 } });
});

test("at least eight reactions, and every stored solution is the smallest balanced one", () => {
  assert.ok(REACTIONS.length >= 8);
  assert.equal(new Set(REACTIONS.map(r => r.id)).size, REACTIONS.length);
  for (const r of REACTIONS) {
    assert.equal(r.solution.length, species(r).length, r.id);
    assert.ok(species(r).length <= 4 && Math.max(...r.solution) <= MAX, r.id);
    const { left, right } = atomCounts(r, r.solution);
    assert.deepEqual(Object.keys(left).sort(), Object.keys(right).sort(), r.id);
    for (const el of elements(r)) assert.equal(left[el], right[el], `${r.id}: ${el}`);
    assert.equal(status(r, r.solution), "balanced", r.id);
  }
});

test("non-minimal multiples are balanced but not simplest", () => {
  assert.equal(status(reactionById("h2-o2"), [4, 2, 4]), "multiple");
  for (const r of REACTIONS) {
    for (const k of [2, 3]) assert.equal(status(r, r.solution.map(c => c * k)), "multiple", r.id);
  }
});

test("wrong coefficients are rejected", () => {
  assert.equal(status(reactionById("h2-o2"), [1, 1, 1]), "unbalanced");
  assert.equal(status(reactionById("h2-o2"), [2, 2, 2]), "unbalanced");
  assert.equal(status(reactionById("h2-o2"), [2, 1]), "unbalanced");
  assert.equal(status(reactionById("h2-o2"), [1, 0.5, 1]), "unbalanced");
  assert.equal(status(reactionById("h2-o2"), [0, 0, 0]), "unbalanced");
  for (const r of REACTIONS) {
    for (let i = 0; i < r.solution.length; i++) {
      const wrong = r.solution.map((c, j) => (j === i ? c + 1 : c));
      assert.equal(status(r, wrong), "unbalanced", `${r.id} #${i}`);
    }
  }
});

test("initial state is a real, not yet balanced reaction", () => {
  const s = initialState();
  const r = reactionById(s.reaction);
  assert.equal(r.id, s.reaction);
  assert.deepEqual(coefficients(s, r), [1, 1, 1, 1]);
  assert.equal(status(r, coefficients(s, r)), "unbalanced");
  assert.equal(pretty("Fe3O4"), "Fe₃O₄");
});
