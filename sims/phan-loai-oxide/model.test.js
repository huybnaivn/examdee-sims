import test from "node:test";
import assert from "node:assert/strict";
import { CLASSES, REAGENTS, OXIDES, N, NAME_OPTIONS, WRONG_NAMES, initialState, test as run, reacts, classify, classCode, valence, name, valenceName, pretty, marks, wasTested, canClassify, runTest, progress, confirmClass, checkName } from "./model.js";

const ids = cls => OXIDES.filter(o => o.cls === cls).map(o => o.id);

/** Atoms on one side of an equation: "2Fe(OH)3 + H2O" -> { Fe: 2, O: 7, H: 8 }. */
function atoms(side) {
  const total = {};
  for (const term of side.split(" + ")) {
    const [, coef, formula] = /^(\d*)(.+)$/.exec(term.trim());
    const count = f => {
      const out = {};
      const re = /\(([^()]+)\)(\d*)|([A-Z][a-z]?)(\d*)/g;
      for (let m; (m = re.exec(f)); ) {
        const k = Number(m[2] || m[4] || 1);
        const inner = m[1] ? count(m[1]) : { [m[3]]: 1 };
        for (const [el, n] of Object.entries(inner)) out[el] = (out[el] ?? 0) + n * k;
      }
      return out;
    };
    for (const [el, n] of Object.entries(count(formula))) total[el] = (total[el] ?? 0) + n * Number(coef || 1);
  }
  return total;
}

test("the atom counter used below", () => {
  assert.deepEqual(atoms("2Fe(OH)3 + H2O"), { Fe: 2, O: 7, H: 8 });
  assert.deepEqual(atoms("Ca(OH)2"), { Ca: 1, O: 2, H: 2 });
});

test("classification table", () => {
  assert.equal(N, 11);
  assert.deepEqual(ids("basic"), ["CaO", "Na2O", "CuO", "Fe2O3"]);
  assert.deepEqual(ids("acidic"), ["CO2", "SO2", "P2O5"]);
  assert.deepEqual(ids("amphoteric"), ["Al2O3", "ZnO"]);
  assert.deepEqual(ids("neutral"), ["CO", "NO"]);
  assert.deepEqual(CLASSES.map(classCode), [1, 2, 3, 4]);
  assert.equal(classCode("?"), 0);
});

test("the acid and base tests lead to the class of the table", () => {
  for (const o of OXIDES) assert.equal(classify(o.id), o.cls, o.id);
});

test("only the right oxides react with water, and litmus shows what was formed", () => {
  const wet = OXIDES.filter(o => reacts(o.id, "water")).map(o => o.id);
  assert.deepEqual(wet, ["CaO", "Na2O", "CO2", "SO2", "P2O5"]);
  for (const id of ["CaO", "Na2O"]) assert.equal(run(id, "water").litmus, "blue"); // a base is formed
  for (const id of ["CO2", "SO2", "P2O5"]) assert.equal(run(id, "water").litmus, "red"); // an acid is formed
  for (const id of ["CuO", "Fe2O3", "Al2O3", "ZnO", "CO", "NO"]) assert.equal(run(id, "water").litmus, "purple");
  assert.equal(run("CaO", "water").equation, "CaO + H2O → Ca(OH)2");
  assert.equal(run("P2O5", "water").equation, "P2O5 + 3H2O → 2H3PO4");
  assert.equal(run("CuO", "acid").litmus, ""); // litmus is used in the water test only
});

test("basic oxides react with the acid, acidic oxides with the base", () => {
  for (const id of ids("basic")) assert.deepEqual([reacts(id, "acid"), reacts(id, "base")], [true, false], id);
  for (const id of ids("acidic")) assert.deepEqual([reacts(id, "acid"), reacts(id, "base")], [false, true], id);
  assert.equal(run("CuO", "acid").solution, "blue");
  assert.equal(run("Fe2O3", "acid").solution, "yellow");
  assert.equal(run("Fe2O3", "acid").equation, "Fe2O3 + 6HCl → 2FeCl3 + 3H2O");
  assert.equal(run("CO2", "base").equation, "CO2 + 2NaOH → Na2CO3 + H2O");
});

test("amphoteric oxides react with both the acid and the base, neutral oxides with neither", () => {
  for (const id of ids("amphoteric")) {
    assert.ok(reacts(id, "acid") && reacts(id, "base"), id);
    assert.ok(!reacts(id, "water"), id);
  }
  for (const id of ids("neutral")) for (const r of REAGENTS) assert.ok(!reacts(id, r), `${id} ${r}`);
  assert.equal(run("Al2O3", "base").equation, "Al2O3 + 2NaOH → 2NaAlO2 + H2O");
  assert.equal(run("ZnO", "base").equation, "ZnO + 2NaOH → Na2ZnO2 + H2O");
});

test("every equation is balanced and starts from the oxide and the reagent", () => {
  const partner = { water: "H2O", acid: "HCl", base: "NaOH" };
  let count = 0;
  for (const o of OXIDES) {
    for (const r of REAGENTS) {
      const t = run(o.id, r);
      assert.equal(t.equation !== "", t.reacts);
      assert.ok(t.observation.length > 10);
      if (!t.reacts) continue;
      count++;
      const [left, right] = t.equation.split(/ → | ⇌ /);
      assert.deepEqual(atoms(left), atoms(right), t.equation);
      assert.ok(left.startsWith(`${o.id} + `) && left.endsWith(partner[r]), t.equation);
    }
  }
  assert.equal(count, 5 + 6 + 5); // water, acid, base
});

test("what is left in the beaker when nothing reacts", () => {
  assert.equal(run("CuO", "water").left, "solid");
  assert.equal(run("Fe2O3", "base").left, "solid");
  assert.equal(run("CO", "acid").left, "gas");
  assert.equal(run("NO", "water").left, "gas");
  // these dissolve because of the water in the solution, without reacting with the acid or the base
  assert.deepEqual([run("Na2O", "base").reacts, run("Na2O", "base").left], [false, ""]);
  assert.deepEqual([run("P2O5", "acid").reacts, run("P2O5", "acid").left], [false, ""]);
  assert.match(run("Na2O", "base").observation, /nước có trong dung dịch/);
});

test("valence and generated names", () => {
  assert.deepEqual(OXIDES.map(o => valence(o.id)), [2, 1, 2, 3, 4, 4, 5, 3, 2, 2, 2]);
  assert.deepEqual(OXIDES.map(o => name(o.id)), [
    "calcium oxide",
    "sodium oxide",
    "copper(II) oxide",
    "iron(III) oxide",
    "carbon dioxide",
    "sulfur dioxide",
    "diphosphorus pentoxide",
    "aluminium oxide",
    "zinc oxide",
    "carbon monoxide",
    "nitrogen monoxide",
  ]);
  assert.equal(valenceName("SO2"), "sulfur(IV) oxide");
  assert.equal(valenceName("P2O5"), "phosphorus(V) oxide");
  assert.equal(valenceName("CO"), "carbon(II) oxide");
  assert.equal(valenceName("CuO"), "");
  // the list of names offered: every right name once, no wrong name equal to a right one
  assert.equal(new Set(NAME_OPTIONS).size, N + WRONG_NAMES.length);
  for (const o of OXIDES) assert.ok(NAME_OPTIONS.includes(name(o.id)));
});

test("formulas are written with subscripts, coefficients are not", () => {
  assert.equal(pretty("Fe2O3 + 6HCl → 2FeCl3 + 3H2O"), "Fe₂O₃ + 6HCl → 2FeCl₃ + 3H₂O");
  assert.equal(pretty("CaO + H2O → Ca(OH)2"), "CaO + H₂O → Ca(OH)₂");
  assert.equal(pretty("P2O5"), "P₂O₅");
});

test("progress: tests done, classification, completion", () => {
  const s = initialState();
  assert.ok(wasTested(s, "CuO", "acid") && !wasTested(s, "CuO", "base") && !wasTested(s, "CaO", "acid"));
  s.guess = "basic";
  assert.equal(confirmClass(s), null); // the base test is still missing
  assert.equal(runTest(s, "base").reacts, false);
  assert.equal(s.reagent, "base");
  assert.ok(canClassify(s));
  assert.deepEqual(confirmClass(s), { code: 1, correct: true, completed: false });
  assert.deepEqual(progress(s), { classified: 1, correct: 1, all: false, named: 0 });
  s.guess = "";
  assert.equal(confirmClass(s), null);
  // a wrong class is recorded, and can be corrected
  s.guess = "amphoteric";
  assert.deepEqual(confirmClass(s), { code: 3, correct: false, completed: false });
  assert.deepEqual(progress(s), { classified: 1, correct: 0, all: false, named: 0 });
  // classify everything correctly: completed is reported exactly once
  let completed = 0;
  for (const o of OXIDES) {
    s.oxide = o.id;
    runTest(s, "acid");
    runTest(s, "base");
    s.guess = classify(o.id);
    const r = confirmClass(s);
    assert.ok(r.correct);
    completed += r.completed;
  }
  assert.equal(completed, 1);
  assert.ok(progress(s).all);
  assert.equal(confirmClass(s).completed, false);
  assert.equal(s.attempts, 14);
});

test("naming practice", () => {
  const s = initialState();
  s.name = "copper(I) oxide";
  assert.equal(checkName(s), false);
  assert.equal(progress(s).named, 0);
  s.name = "copper(II) oxide";
  assert.equal(checkName(s), true);
  assert.equal(s.named, "00100000000");
});

test("forged state does not break the model", () => {
  assert.deepEqual(marks("9x3", 4), [0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(marks(undefined, 7), Array(N).fill(0));
  assert.equal(marks("7".repeat(40), 7).length, N);
  const s = { ...initialState(), oxide: "XeO4", reagent: "?", tested: null, classes: "abc", named: 5, attempts: -1e9 };
  assert.equal(run(s.oxide, s.reagent).equation, "CaO + H2O → Ca(OH)2"); // read as the first oxide in water
  assert.equal(progress(s).classified, 0);
  runTest(s, "acid");
  runTest(s, "base");
  s.guess = "basic";
  assert.equal(confirmClass(s).correct, true);
  assert.equal(s.attempts, 1);
  assert.equal(runTest(s, "bleach"), null);
});
