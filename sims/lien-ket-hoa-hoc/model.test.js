import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENTS, SYMBOLS, COMPOUNDS, TYPES, deltaChi, classify, formulaOf, bondFor, structure, octet, unsupported, initialState } from "./model.js";

const pairs = SYMBOLS.flatMap((a, i) => SYMBOLS.slice(i).map(b => [a, b]));

test("formula from valences (cross rule)", () => {
  const want = [["Na", "Cl", "NaCl"], ["Mg", "Cl", "MgCl2"], ["Ca", "O", "CaO"], ["H", "O", "H2O"], ["N", "H", "NH3"], ["C", "H", "CH4"], ["C", "O", "CO2"], ["N", "N", "N2"], ["O", "O", "O2"], ["Cl", "Cl", "Cl2"],
    ["Na", "O", "Na2O"], ["Ca", "F", "CaF2"], ["K", "Cl", "KCl"], ["O", "F", "OF2"], ["Cl", "O", "Cl2O"], ["Cl", "F", "ClF"], ["C", "Cl", "CCl4"], ["H", "F", "HF"]];
  for (const [a, b, id] of want) {
    assert.equal(formulaOf(a, b).id, id, `${a}+${b}`);
    assert.equal(formulaOf(b, a).id, id, `${b}+${a} (order of choice does not matter)`);
  }
  // the subscripts balance the valences: x·v(A) = y·v(B)
  for (const [a, b] of pairs) {
    const f = formulaOf(a, b);
    if (!f || f.parts.length < 2) continue;
    const [[p, x], [q, y]] = f.parts;
    assert.equal(x * ELEMENTS[p].valence, y * ELEMENTS[q].valence, f.id);
  }
});

test("bond type by Δχ with the textbook thresholds 0,4 and 1,7", () => {
  assert.equal(classify(0), "nonpolar");
  assert.equal(classify(0.39), "nonpolar");
  assert.equal(classify(0.4), "polar");
  assert.equal(classify(1.69), "polar");
  assert.equal(classify(1.7), "ionic");
  assert.equal(deltaChi("H", "Cl"), 0.96);
  assert.equal(deltaChi("Na", "Cl"), 2.23);
  assert.equal(deltaChi("C", "H"), 0.35);
  const want = { NaCl: "ionic", MgCl2: "ionic", CaO: "ionic", H2O: "polar", NH3: "polar", CH4: "nonpolar", CO2: "polar", N2: "nonpolar", O2: "nonpolar", Cl2: "nonpolar", HCl: "polar", NCl3: "nonpolar", Cl2O: "nonpolar", HF: "polar" };
  for (const [a, b] of pairs) {
    const bond = bondFor(a, b);
    if (bond.formula && want[bond.formula.id]) assert.equal(bond.type, want[bond.formula.id], bond.formula.id);
    // every metal–non-metal compound here is ionic by Δχ, every non-metal pair is not
    if (bond.formula) assert.equal(bond.rule === "ionic", ELEMENTS[a].metal || ELEMENTS[b].metal || bond.formula.id === "HF", bond.formula.id);
  }
  // HF: Δχ = 1,78 reaches the ionic threshold but the bond is polar covalent; flagged, not hidden
  const hf = bondFor("H", "F");
  assert.equal(hf.deltaChi, 1.78);
  assert.deepEqual([hf.rule, hf.type, hf.exception], ["ionic", "polar", true]);
  assert.equal(bondFor("Na", "Cl").exception, false);
});

test("shared pairs: single, double and triple bonds", () => {
  const orders = id => {
    const [a, b] = id;
    return structure(bondFor(a, b)).bonds.map(x => x.order);
  };
  assert.deepEqual(structure(bondFor("H", "H")).bonds.map(x => x.order), [1]);
  assert.deepEqual(structure(bondFor("Cl", "Cl")).bonds.map(x => x.order), [1]);
  assert.deepEqual(structure(bondFor("O", "O")).bonds.map(x => x.order), [2]);
  assert.deepEqual(structure(bondFor("N", "N")).bonds.map(x => x.order), [3]);
  assert.deepEqual(structure(bondFor("C", "O")).bonds.map(x => x.order), [2, 2]);
  assert.deepEqual(structure(bondFor("C", "H")).bonds.map(x => x.order), [1, 1, 1, 1]);
  assert.deepEqual(structure(bondFor("H", "O")).bonds.map(x => x.order), [1, 1]);
  assert.deepEqual(orders(["N", "H"]), [1, 1, 1]);
  const nh3 = structure(bondFor("N", "H"));
  assert.deepEqual(nh3.atoms.map(a => [a.el, a.lone]), [["N", 1], ["H", 0], ["H", 0], ["H", 0]]);
  const h2o = structure(bondFor("O", "H"));
  assert.equal(h2o.atoms[0].el, "O");
  assert.equal(h2o.atoms[0].lone, 2);
  // every valence electron is placed once: Σ valence electrons = 2·(shared pairs) + 2·(lone pairs)
  for (const [a, b] of pairs) {
    const bond = bondFor(a, b);
    if (bond.type === null || bond.type === "ionic") continue;
    const st = structure(bond);
    const total = st.atoms.reduce((s, x) => s + ELEMENTS[x.el].valenceE, 0);
    const placed = 2 * st.bonds.reduce((s, x) => s + x.order, 0) + 2 * st.atoms.reduce((s, x) => s + x.lone, 0);
    assert.equal(placed, total, bond.formula.id);
  }
});

test("ionic bonds: electrons lost equal electrons gained, the compound is neutral", () => {
  for (const [a, b] of pairs) {
    const bond = bondFor(a, b);
    if (bond.type !== "ionic") continue;
    const { ions } = structure(bond);
    assert.equal(ions.reduce((s, x) => s + x.charge, 0), 0, bond.formula.id);
    const lost = ions.filter(x => x.charge > 0).reduce((s, x) => s + x.given, 0);
    const gained = ions.filter(x => x.charge < 0).reduce((s, x) => s + x.given, 0);
    assert.equal(lost, gained, bond.formula.id);
    for (const x of ions) if (x.charge > 0) assert.equal(x.given, ELEMENTS[x.el].valenceE);
  }
  assert.deepEqual(structure(bondFor("Mg", "Cl")).ions.map(x => [x.el, x.charge]), [["Cl", -1], ["Mg", 2], ["Cl", -1]]);
  assert.deepEqual(structure(bondFor("O", "Na")).ions.map(x => [x.el, x.charge]), [["Na", 1], ["O", -2], ["Na", 1]]);
});

test("octet (duet for H) is satisfied in every built-in compound", () => {
  let n = 0;
  const seen = new Set();
  for (const [a, b] of pairs) {
    const bond = bondFor(a, b);
    if (!bond.formula) continue;
    n++;
    seen.add(bond.formula.id);
    assert.ok(bond.compound, `${bond.formula.id} has a name`);
    for (const o of octet(structure(bond))) assert.ok(o.ok, `${bond.formula.id}: ${o.el} has ${o.around}`);
  }
  assert.equal(n, COMPOUNDS.length);
  assert.deepEqual([...seen].sort(), COMPOUNDS.map(c => c.id).sort());
});

test("unsupported pairs are reported with a reason", () => {
  assert.equal(unsupported("Na", "K"), "metallic");
  assert.equal(unsupported("Mg", "Mg"), "metallic");
  assert.equal(unsupported("Na", "H"), "hydride");
  assert.equal(unsupported("Ca", "N"), "other");
  assert.equal(unsupported("C", "C"), "other");
  assert.equal(unsupported("N", "O"), "other");
  assert.equal(unsupported("Xx", "H"), "unknown");
  const nk = bondFor("Na", "K");
  assert.equal(nk.formula, null);
  assert.equal(nk.type, null);
  assert.equal(nk.deltaChi, 0.11); // Δχ is still shown
  const supported = pairs.filter(([a, b]) => !unsupported(a, b)).length;
  assert.equal(supported, COMPOUNDS.length);
  assert.equal(pairs.length, 55);
});

test("initial state is NaCl and type codes are stable", () => {
  const s = initialState();
  assert.equal(bondFor(s.a, s.b).formula.id, "NaCl");
  assert.deepEqual(TYPES, ["nonpolar", "polar", "ionic"]);
});
