import { test } from "node:test";
import assert from "node:assert/strict";
import { IONS, CATIONS, ANIONS, SOLUTIONS, SOLUTION_KEYS, RULES, TYPE, ruleFor, compound, atoms, tally, mix, ionsOf, pickIsRight, prettyEquation, prettyIon, initialState } from "./model.js";

const pairs = SOLUTION_KEYS.flatMap(a => SOLUTION_KEYS.map(b => [a, b]));
const balanced = eq => assert.deepEqual(tally(eq.left), tally(eq.right), prettyEquation(eq));

test("formula parser and compound builder", () => {
  assert.deepEqual(atoms("Cu(OH)2"), { Cu: 1, O: 2, H: 2 });
  assert.deepEqual(atoms("(CH3COO)2Ba"), { C: 4, H: 6, O: 4, Ba: 1 });
  assert.deepEqual(atoms("(NH4)2SO4"), { N: 2, H: 8, S: 1, O: 4 });
  assert.equal(compound("Ba", "Cl").f, "BaCl2");
  assert.equal(compound("Na", "SO4").f, "Na2SO4");
  assert.equal(compound("Ba", "NO3").f, "Ba(NO3)2");
  assert.equal(compound("NH4", "SO4").f, "(NH4)2SO4");
  assert.equal(compound("Na", "CH3COO").f, "CH3COONa");
  assert.equal(compound("Cu", "CH3COO").f, "(CH3COO)2Cu");
  assert.equal(compound("H", "NO3").f, "HNO3");
  assert.equal(compound("Cu", "SO4").f, "CuSO4");
  // every listed solution is the neutral compound of its two ions, under its own key
  for (const [key, s] of Object.entries(SOLUTIONS)) {
    const u = compound(s.c, s.a);
    assert.equal(u.f, key);
    assert.equal(u.nc * IONS[s.c].q + u.na * IONS[s.a].q, 0);
    assert.equal(ruleFor(s.c, s.a), null, `${key} must itself be soluble and strong`);
  }
});

test("each rule is a balanced net ionic equation (atoms and charge)", () => {
  for (const r of RULES) {
    balanced({ left: [{ n: r.nc, ion: r.c }, { n: r.na, ion: r.a }], right: r.products });
    assert.ok(CATIONS.includes(r.c) && ANIONS.includes(r.a));
    assert.ok(r.why);
  }
});

test("a reaction happens iff a precipitate, a gas or a weak electrolyte forms", () => {
  for (const [a, b] of pairs) {
    const A = SOLUTIONS[a];
    const B = SOLUTIONS[b];
    const expected = a !== b && (ruleFor(A.c, B.a) !== null || ruleFor(B.c, A.a) !== null);
    const r = mix(a, b);
    assert.equal(r.reacted, expected, `${a} + ${b}`);
    assert.equal(r.type !== TYPE.none, expected);
    if (r.reacted) assert.ok(r.reactions.every(x => [TYPE.precipitate, TYPE.gas, TYPE.weak].includes(x.type)));
  }
});

test("known pairs", () => {
  const eq = (a, b) => {
    const r = mix(a, b);
    return [r.molecular, r.ionic, ...r.net].map(prettyEquation);
  };
  assert.deepEqual(eq("BaCl2", "Na2SO4"), [
    "BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl",
    "Ba²⁺ + 2Cl⁻ + 2Na⁺ + SO₄²⁻ → BaSO₄↓ + 2Na⁺ + 2Cl⁻",
    "Ba²⁺ + SO₄²⁻ → BaSO₄↓",
  ]);
  assert.deepEqual(eq("Na2CO3", "HCl"), [
    "Na₂CO₃ + 2HCl → CO₂↑ + H₂O + 2NaCl",
    "2Na⁺ + CO₃²⁻ + 2H⁺ + 2Cl⁻ → CO₂↑ + H₂O + 2Na⁺ + 2Cl⁻",
    "2H⁺ + CO₃²⁻ → CO₂↑ + H₂O",
  ]);
  assert.deepEqual(eq("HCl", "NaOH").slice(0, 3), ["HCl + NaOH → H₂O + NaCl", "H⁺ + Cl⁻ + Na⁺ + OH⁻ → H₂O + Na⁺ + Cl⁻", "H⁺ + OH⁻ → H₂O"]);
  assert.equal(eq("CH3COONa", "HCl")[0], "CH₃COONa + HCl → CH₃COOH + NaCl");
  assert.equal(eq("CH3COONa", "HCl")[2], "H⁺ + CH₃COO⁻ → CH₃COOH");
  assert.equal(eq("CuSO4", "NaOH")[0], "CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄");
  assert.equal(eq("CuSO4", "NaOH")[2], "Cu²⁺ + 2OH⁻ → Cu(OH)₂↓");
  assert.equal(eq("AgNO3", "BaCl2")[0], "2AgNO₃ + BaCl₂ → 2AgCl↓ + Ba(NO₃)₂");
  assert.equal(eq("AgNO3", "BaCl2")[2], "Ag⁺ + Cl⁻ → AgCl↓");
  assert.equal(eq("NH4Cl", "NaOH")[0], "NH₄Cl + NaOH → NH₃↑ + H₂O + NaCl");
  assert.equal(eq("AgNO3", "NaOH")[0], "2AgNO₃ + 2NaOH → Ag₂O↓ + H₂O + 2NaNO₃");
  assert.equal(mix("NaCl", "AgNO3").type, TYPE.precipitate);
  assert.equal(mix("Na2CO3", "HCl").type, TYPE.gas);
  assert.equal(mix("NH4Cl", "NaOH").type, TYPE.gas);
  assert.equal(mix("HCl", "NaOH").type, TYPE.weak);
  assert.equal(mix("CH3COONa", "HCl").type, TYPE.weak);
});

test("all three equations are balanced in atoms and charge for every reacting pair", () => {
  let n = 0;
  for (const [a, b] of pairs) {
    const r = mix(a, b);
    if (!r.reacted) continue;
    n++;
    balanced(r.molecular);
    balanced(r.ionic);
    r.net.forEach(balanced);
    assert.equal(tally(r.ionic.left).charge, 0);
    // the molecular equation uses the smallest whole coefficients
    const all = [...r.molecular.left, ...r.molecular.right].map(t => t.n);
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    assert.ok(all.every(v => Number.isInteger(v) && v > 0));
    assert.equal(all.reduce(gcd), 1, prettyEquation(r.molecular));
    // mixing in the other order gives the same chemistry
    const back = mix(b, a);
    assert.deepEqual(back.net.map(prettyEquation), r.net.map(prettyEquation));
    assert.deepEqual([...back.spectators].sort(), [...r.spectators].sort());
  }
  assert.ok(n >= 30, `${n} reacting ordered pairs`);
});

test("spectator ions: present on both sides of the full ionic equation, absent from the net one", () => {
  assert.deepEqual(mix("BaCl2", "Na2SO4").spectators.sort(), ["Cl", "Na"]);
  assert.deepEqual(mix("HCl", "NaOH").spectators.sort(), ["Cl", "Na"]);
  assert.deepEqual(mix("CuSO4", "NaOH").spectators.sort(), ["Na", "SO4"]);
  for (const [a, b] of pairs) {
    const r = mix(a, b);
    if (!r.reacted) continue;
    const count = (side, key) => side.filter(t => t.ion === key).reduce((sum, t) => sum + t.n, 0);
    for (const key of r.spectators) {
      assert.ok(count(r.ionic.left, key) > 0);
      assert.equal(count(r.ionic.left, key), count(r.ionic.right, key), `${key} in ${a} + ${b}`);
      assert.ok(r.net.every(eq => count(eq.left, key) === 0));
    }
    // full ionic minus spectators = a whole multiple of the net equation
    const reacting = r.ionic.left.filter(t => !r.spectators.includes(t.ion));
    assert.equal(reacting.length, 2 * r.net.length);
    for (const eq of r.net) {
      const m = reacting.find(t => t.ion === eq.left[0].ion).n / eq.left[0].n;
      assert.ok(Number.isInteger(m));
      assert.equal(reacting.find(t => t.ion === eq.left[1].ion).n, m * eq.left[1].n);
    }
  }
});

test("non-reacting pairs report nothing", () => {
  for (const [a, b] of [["NaCl", "KNO3"], ["NaCl", "Na2SO4"], ["KNO3", "CuSO4"], ["HCl", "NaCl"], ["NaOH", "Na2CO3"], ["BaCl2", "NaOH"], ["NaCl", "NaCl"], ["HCl", "HCl"]]) {
    const r = mix(a, b);
    assert.equal(r.reacted, false, `${a} + ${b}`);
    assert.equal(r.type, TYPE.none);
    assert.equal(r.molecular, null);
    assert.equal(r.ionic, null);
    assert.deepEqual(r.net, []);
    assert.deepEqual(r.spectators, []);
    assert.deepEqual(r.reactions, []);
  }
  // KNO3 reacts with nothing in the list
  for (const b of SOLUTION_KEYS) assert.equal(mix("KNO3", b).reacted, false);
});

test("precipitate colours come from the table", () => {
  const colour = (a, b) => mix(a, b).reactions[0].colourName;
  assert.equal(colour("NaCl", "AgNO3"), "trắng");
  assert.equal(colour("BaCl2", "Na2SO4"), "trắng");
  assert.equal(colour("BaCl2", "Na2CO3"), "trắng");
  assert.equal(colour("CuSO4", "NaOH"), "xanh lam");
  assert.equal(colour("AgNO3", "NaOH"), "nâu đen");
  assert.equal(colour("AgNO3", "Na2CO3"), "vàng nhạt");
  for (const r of RULES) {
    if (r.type === TYPE.precipitate) assert.ok(/^#[0-9a-f]{6}$/.test(r.colour) && r.colourName && r.products[0].mark === "↓");
    else assert.equal(r.colour, undefined);
    if (r.type === TYPE.gas) assert.equal(r.products[0].mark, "↑");
  }
});

test("ions of a solution and display", () => {
  assert.deepEqual(ionsOf("BaCl2"), ["Ba", "Cl", "Cl"]);
  assert.deepEqual(ionsOf("Na2CO3"), ["Na", "Na", "CO3"]);
  assert.deepEqual(ionsOf("CH3COONa"), ["Na", "CH3COO"]);
  assert.equal(prettyIon("SO4"), "SO₄²⁻");
  assert.equal(prettyIon("NH4"), "NH₄⁺");
  assert.equal(prettyIon("CH3COO"), "CH₃COO⁻");
});

test("checking the learner's choice of ions", () => {
  assert.ok(pickIsRight("BaCl2", "Na2SO4", "Ba", "SO4"));
  assert.ok(pickIsRight("Na2SO4", "BaCl2", "Ba", "SO4"));
  assert.ok(!pickIsRight("BaCl2", "Na2SO4", "Na", "Cl"));
  assert.ok(!pickIsRight("BaCl2", "Na2SO4", "Ba", "Cl"));
  assert.ok(!pickIsRight("BaCl2", "Na2SO4", "none", "none"));
  assert.ok(pickIsRight("NaCl", "KNO3", "none", "none"));
  assert.ok(!pickIsRight("NaCl", "KNO3", "Na", "NO3"));
  assert.ok(pickIsRight("HCl", "NaOH", "H", "OH"));
});

test("unknown solution keys fall back instead of throwing; initial state is consistent", () => {
  assert.equal(mix("???", 42).a, SOLUTION_KEYS[0]);
  const s = initialState();
  assert.ok(pickIsRight(s.a, s.b, s.pickCation, s.pickAnion));
});
