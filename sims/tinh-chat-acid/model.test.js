import test from "node:test";
import assert from "node:assert/strict";
import {
  REAGENTS, TARGETS, REAGENT_INFO, TABLE, outcome, tubeLook, atoms, balanced, pretty,
  initialState, perform, isDone, doneCount, reactedCount, complete,
} from "./model.js";

// Expected outcome (1 = reacts / indicator changes colour) for every reagent–target pair,
// in the order of TARGETS: quy Zn Fe Cu CuO neut CaCO3 BaCl2 CuSO4.
const EXPECTED = {
  HCl: [1, 1, 1, 0, 1, 1, 1, 0, 0],
  H2SO4: [1, 1, 1, 0, 1, 1, 1, 1, 0],
  NaOH: [1, 0, 0, 0, 0, 1, 0, 0, 1],
  CaOH2: [1, 0, 0, 0, 0, 1, 0, 0, 1],
};

test("outcome table for every reagent pair", () => {
  for (const r of REAGENTS) {
    assert.deepEqual(TARGETS.map(t => outcome(r, t).r), EXPECTED[r], r);
    assert.equal(Object.keys(TABLE[r]).length, TARGETS.length);
  }
  assert.equal(outcome("HNO3", "Zn"), null);
});

test("every reaction has a balanced equation, every non-reaction has none", () => {
  for (const r of REAGENTS) {
    for (const t of TARGETS) {
      const o = outcome(r, t);
      if (t === "quy") assert.equal(o.eq, undefined); // indicator: colour change, no equation at this level
      else if (o.r) assert.ok(balanced(o.eq), `${r} + ${t}: ${o.eq}`);
      else assert.equal(o.eq, undefined, `${r} + ${t}`);
      assert.ok(o.obs && o.mark);
      if (!o.r) assert.ok(o.note, `${r} + ${t} explains why nothing happens`);
    }
  }
});

test("the balance checker itself", () => {
  assert.deepEqual(atoms("Ca(OH)2"), { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(atoms("Na2SO4"), { Na: 2, S: 1, O: 4 });
  assert.ok(balanced("2NaOH + CuSO4 -> Cu(OH)2↓ + Na2SO4"));
  assert.ok(!balanced("Zn + HCl -> ZnCl2 + H2↑"));
  assert.ok(!balanced("H2SO4 + NaOH -> Na2SO4 + H2O"));
});

test("litmus: acids turn it red, bases turn it blue", () => {
  for (const r of REAGENTS) {
    const want = REAGENT_INFO[r].kind === "acid" ? "red" : "blue";
    assert.equal(outcome(r, "quy").look.paper, want);
  }
});

test("Zn and Fe release hydrogen from dilute acids; Cu does not react", () => {
  assert.equal(outcome("HCl", "Zn").eq, "Zn + 2HCl -> ZnCl2 + H2↑");
  assert.equal(outcome("H2SO4", "Zn").eq, "Zn + H2SO4 -> ZnSO4 + H2↑");
  assert.equal(outcome("HCl", "Fe").eq, "Fe + 2HCl -> FeCl2 + H2↑"); // iron(II), not iron(III)
  assert.equal(outcome("H2SO4", "Fe").eq, "Fe + H2SO4 -> FeSO4 + H2↑");
  for (const acid of ["HCl", "H2SO4"]) {
    assert.equal(outcome(acid, "Cu").r, 0);
    assert.equal(tubeLook(acid, "Cu", true).solid, "Cu"); // the copper is still there
    assert.ok(!tubeLook(acid, "Cu", true).gas);
  }
});

test("neutralisation gives salt and water", () => {
  assert.equal(outcome("HCl", "neut").eq, "HCl + NaOH -> NaCl + H2O");
  assert.equal(outcome("H2SO4", "neut").eq, "H2SO4 + 2NaOH -> Na2SO4 + 2H2O");
  assert.equal(outcome("NaOH", "neut").eq, "NaOH + HCl -> NaCl + H2O");
  assert.equal(outcome("CaOH2", "neut").eq, "Ca(OH)2 + 2HCl -> CaCl2 + 2H2O");
  // phenolphthalein: pink in the base, colourless once the acid has neutralised it
  assert.equal(tubeLook("HCl", "neut", false).liquid, "pink");
  assert.equal(tubeLook("HCl", "neut", true).liquid, "clear");
  assert.equal(tubeLook("NaOH", "neut", false).liquid, "clear");
  assert.equal(tubeLook("NaOH", "neut", true).liquid, "pink");
});

test("salts: BaSO4 precipitate only with H2SO4, CO2 from CaCO3 with acids, Cu(OH)2 with bases", () => {
  assert.equal(outcome("H2SO4", "BaCl2").eq, "H2SO4 + BaCl2 -> BaSO4↓ + 2HCl");
  assert.equal(outcome("H2SO4", "BaCl2").look.ppt, "white");
  assert.equal(outcome("HCl", "BaCl2").r, 0);
  assert.equal(outcome("HCl", "CaCO3").eq, "CaCO3 + 2HCl -> CaCl2 + CO2↑ + H2O");
  assert.equal(outcome("NaOH", "CuSO4").eq, "2NaOH + CuSO4 -> Cu(OH)2↓ + Na2SO4");
  assert.equal(outcome("NaOH", "CuSO4").look.ppt, "blue");
});

test("CuO dissolves in acids to a blue solution", () => {
  assert.equal(outcome("HCl", "CuO").eq, "CuO + 2HCl -> CuCl2 + H2O");
  const after = tubeLook("H2SO4", "CuO", true);
  assert.equal(after.solid, null);
  assert.equal(after.liquid, "blue");
  assert.equal(tubeLook("H2SO4", "CuO", false).solid, "CuO");
});

test("the table fills in as experiments are done and survives a forged state", () => {
  const s = initialState();
  assert.equal(doneCount(s), 1); // the worked example
  assert.ok(isDone(s, "HCl", "Zn"));
  perform(s); // repeating an experiment does not add a cell
  assert.equal(doneCount(s), 1);
  for (const r of REAGENTS) for (const t of TARGETS) perform(Object.assign(s, { reagent: r, target: t }));
  assert.ok(complete(s));
  assert.equal(reactedCount(s), Object.values(EXPECTED).flat().reduce((a, b) => a + b));
  for (const bad of ["", "111", "x".repeat(36), 5, null]) {
    const f = { ...initialState(), done: bad };
    assert.equal(doneCount(f), 0);
    assert.ok(!complete(f));
  }
  assert.equal(perform({ reagent: "nope", target: "Zn", done: "" }), null);
});

test("pretty writes subscripts but keeps coefficients", () => {
  assert.equal(pretty("H2SO4 + 2NaOH -> Na2SO4 + 2H2O"), "H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O");
  assert.equal(pretty("Ca(OH)2 + 2HCl -> CaCl2 + 2H2O"), "Ca(OH)₂ + 2HCl → CaCl₂ + 2H₂O");
});
