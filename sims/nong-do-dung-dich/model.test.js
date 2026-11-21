import test from "node:test";
import assert from "node:assert/strict";
import { SOLUTES, LIMITS, initialState, solution, maxDissolved, colorDepth, addWater, evaporate, crossedIntoSaturation } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const make = over => ({ ...initialState(), ...over });

test("molar masses agree with the formulas", () => {
  const M = { nacl: 23 + 35.5, saccharose: 12 * 12 + 22 + 11 * 16, cuso4: 64 + 32 + 64, kmno4: 39 + 55 + 64, naoh: 23 + 16 + 1 };
  for (const [key, value] of Object.entries(M)) assert.equal(SOLUTES[key].molarMass, value);
});

test("C% = m_ct / m_dd · 100", () => {
  // 20 g CuSO₄ in 200 g water: 20 / 220 · 100
  const c = solution(make({ solute: "cuso4", added: 20, water: 200 }));
  near(c.dissolved, 20);
  near(c.mass, 220);
  near(c.cPercent, (20 / 220) * 100);
  // 25 g NaCl in 100 g water is a 20% solution
  near(solution(make({ solute: "nacl", added: 25, water: 100 })).cPercent, 20);
  assert.equal(solution(make({ added: 0 })).cPercent, 0);
});

test("C_M = n / V", () => {
  const c = solution(make({ solute: "cuso4", added: 20, water: 200 }));
  near(c.mol, 20 / 160);
  near(c.volume, 0.2);
  near(c.cM, 0.625);
  // 40 g NaOH (1 mol) in 500 mL is 2 mol/L
  near(solution(make({ solute: "naoh", added: 40, water: 500 })).cM, 2);
  // 5,85 g NaCl in 100 mL is 1 mol/L
  near(solution(make({ solute: "nacl", added: 5.85, water: 100 })).cM, 1);
});

test("dilution keeps the amount of solute: C₁V₁ = C₂V₂", () => {
  const s = make({ solute: "naoh", added: 40, water: 100 });
  const before = solution(s);
  for (let i = 0; i < 10; i++) addWater(s);
  const after = solution(s);
  assert.equal(s.water, 300);
  near(after.mol, before.mol);
  near(after.cM * after.volume, before.cM * before.volume);
  near(after.cM, before.cM / 3);
  assert.ok(after.cPercent < before.cPercent);
});

test("beyond the solubility the dissolved amount is capped and the excess is solid", () => {
  for (const [key, solute] of Object.entries(SOLUTES)) {
    const cap = maxDissolved(solute, 100);
    near(cap, solute.solubility);
    const under = solution(make({ solute: key, added: cap / 2, water: 100 }));
    near(under.dissolved, cap / 2);
    assert.equal(under.solid, 0);
    assert.equal(under.saturated, false);
    const over = solution(make({ solute: key, added: cap + 15, water: 100 }));
    near(over.dissolved, cap);
    near(over.solid, 15);
    assert.equal(over.saturated, true);
    near(over.dissolved + over.solid, cap + 15); // nothing is lost
    // a saturated solution has the same concentration whatever the excess
    near(over.cPercent, (solute.solubility / (100 + solute.solubility)) * 100);
    near(over.cM, solute.solubility / solute.molarMass / 0.1);
    near(solution(make({ solute: key, added: cap + 60, water: 100 })).cM, over.cM);
  }
  // 36 g NaCl in 100 g water: just saturated, no solid
  const exact = solution(make({ solute: "nacl", added: 36, water: 100 }));
  assert.equal(exact.saturated, true);
  near(exact.solid, 0);
});

test("evaporating water from a saturated solution precipitates solute", () => {
  const s = make({ solute: "nacl", added: 72, water: 200 }); // exactly saturated
  const before = solution(s);
  near(before.solid, 0);
  evaporate(s, 50);
  const after = solution(s);
  assert.equal(s.water, 150);
  near(after.solid, 72 - 54); // 150 g water holds 54 g
  near(after.cPercent, before.cPercent); // still saturated: same concentration
  // an unsaturated solution only gets more concentrated
  const u = make({ solute: "nacl", added: 10, water: 200 });
  const c1 = solution(u).cM;
  evaporate(u, 100);
  assert.equal(solution(u).solid, 0);
  near(solution(u).cM, 2 * c1);
  // adding water back dissolves the solid again
  addWater(s, 50);
  near(solution(s).solid, 0);
});

test("water stays within the limits of the beaker", () => {
  const s = make({ water: 30 });
  evaporate(s);
  evaporate(s);
  assert.equal(s.water, LIMITS.water[0]);
  s.water = 490;
  addWater(s);
  assert.equal(s.water, LIMITS.water[1]);
});

test("colour deepens with concentration; colourless solutes stay colourless", () => {
  let last = -1;
  for (const added of [0, 2, 5, 10, 20, 40]) {
    const d = colorDepth(make({ solute: "cuso4", added, water: 200 }));
    assert.ok(d > last && d >= 0 && d < 1);
    last = d;
  }
  assert.equal(colorDepth(make({ added: 0 })), 0);
  assert.equal(colorDepth(make({ solute: "nacl", added: 50 })), 0);
  // beyond saturation the colour no longer changes
  assert.equal(colorDepth(make({ solute: "kmno4", added: 100 })), colorDepth(make({ solute: "kmno4", added: 200 })));
});

test("the saturation goal fires once per session, and a fresh state re-arms it", () => {
  const s = make({ solute: "kmno4", added: 5, water: 100 });
  assert.equal(crossedIntoSaturation(s), false);
  s.added = 10;
  assert.equal(crossedIntoSaturation(s), true);
  s.added = 20;
  assert.equal(crossedIntoSaturation(s), false);
  addWater(s, 400);
  assert.equal(crossedIntoSaturation(s), false); // 500 mL holds 38 g
  evaporate(s, 300);
  assert.equal(solution(s).saturated, true); // 200 mL holds 15,2 g: saturated again…
  assert.equal(crossedIntoSaturation(s), false); // …but already reported
  const fresh = make({ solute: "kmno4", added: 20, water: 100 });
  assert.equal(crossedIntoSaturation(fresh), true);
});
