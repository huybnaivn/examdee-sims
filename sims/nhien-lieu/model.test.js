import test from "node:test";
import assert from "node:assert/strict";
import {
  FUELS, FUEL_IDS, DH_CO, C_WATER, T_HOT, T_COLD, MOLAR_VOLUME, O2_IN_AIR, BURN_TIME,
  molarMass, oxygenPerMole, heatingValue, equation, burn, perKg, leastCo2Fuel, initialState, progress, step, pretty,
} from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

// atom counts on each side of "aA + bB -> cC + dD" (formulas without brackets)
const count = side => {
  const total = {};
  for (const term of side.split(" + ")) {
    const [, k, formula] = term.match(/^(\d*)(.+)$/);
    for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) total[m[1]] = (total[m[1]] || 0) + (Number(k) || 1) * (Number(m[2]) || 1);
  }
  return total;
};

test("complete-combustion equations are the textbook ones and are balanced", () => {
  assert.equal(equation(FUELS.than), "C + O2 -> CO2");
  assert.equal(equation(FUELS.xang), "2C8H18 + 25O2 -> 16CO2 + 18H2O");
  assert.equal(equation(FUELS.gas), "C3H8 + 5O2 -> 3CO2 + 4H2O");
  assert.equal(equation(FUELS.con), "C2H5OH + 3O2 -> 2CO2 + 3H2O");
  assert.equal(equation(FUELS.hydro), "2H2 + O2 -> 2H2O");
  for (const id of FUEL_IDS) {
    const [l, r] = equation(FUELS[id]).split(" -> ").map(count);
    assert.deepEqual(l, { C: 0, ...l, ...r }.C === 0 ? l : l, id);
    for (const e of new Set([...Object.keys(l), ...Object.keys(r)])) assert.equal(l[e], r[e], `${id}: ${e}`);
  }
  assert.equal(pretty(equation(FUELS.xang)), "2C₈H₁₈ + 25O₂ → 16CO₂ + 18H₂O");
});

test("oxygen needed per mole of fuel and molar masses", () => {
  assert.deepEqual(FUEL_IDS.map(id => oxygenPerMole(FUELS[id])), [1, 12.5, 5, 3, 0.5]);
  assert.deepEqual(FUEL_IDS.map(id => molarMass(FUELS[id])), [12, 114, 44, 46, 2]);
  // 44 g of propane is 1 mol and needs 5 mol O2 = 5 · 24,79 / 0,21 L of air
  const b = burn("gas", 44, 100);
  near(b.o2Needed, 5);
  near(b.airVolume, (5 * MOLAR_VOLUME) / O2_IN_AIR);
});

test("heat = mass × heating value when the fuel burns completely", () => {
  for (const id of FUEL_IDS) {
    for (const mass of [10, 250, 1000]) {
      for (const air of [100, 130]) near(burn(id, mass, air).heat, mass * heatingValue(FUELS[id]));
    }
  }
  near(heatingValue(FUELS.than), 393.5 / 12);
  near(heatingValue(FUELS.hydro), 142.9);
  // extra air adds no heat and leaves oxygen over
  assert.ok(burn("xang", 100, 150).o2Supplied > burn("xang", 100, 150).o2Used);
});

test("CO2 mass follows from the carbon balance", () => {
  near(burn("than", 12, 100).co2, 44);
  near(burn("xang", 114, 100).co2, 8 * 44);
  near(burn("con", 46, 100).co2, 88);
  near(burn("con", 46, 100).h2o, 54);
  for (const id of FUEL_IDS) {
    for (const air of [40, 55, 70, 85, 99, 100, 150]) {
      const { carbon } = burn(id, 100, air);
      near(carbon.co2 + carbon.co + carbon.soot, carbon.fuel);
    }
  }
});

test("hydrogen produces no CO2, whatever the air supply", () => {
  for (const air of [40, 100, 150]) {
    const b = burn("hydro", 100, air);
    assert.equal(b.co2, 0);
    assert.equal(b.co, 0);
    assert.equal(b.soot, 0);
  }
  near(burn("hydro", 2, 100).h2o, 18);
  near(burn("hydro", 2, 50).h2, 1); // half of it stays unburnt
  near(burn("hydro", 2, 50).heat, 285.8 / 2);
  assert.equal(leastCo2Fuel(), "hydro");
});

test("incomplete combustion below the stoichiometric amount of oxygen", () => {
  for (const id of ["than", "xang", "gas", "con"]) {
    const full = burn(id, 100, 100);
    assert.ok(full.complete);
    assert.equal(full.co, 0);
    assert.equal(full.soot, 0);
    const short = burn(id, 100, 95);
    assert.ok(!short.complete);
    assert.ok(short.co > 0, `${id} gives CO`);
    assert.ok(short.co2 < full.co2);
    assert.ok(short.heat < full.heat);
    const starved = burn(id, 100, 40);
    assert.ok(starved.soot > 0, `${id} gives soot`);
    assert.ok(starved.heat > 0);
  }
  // carbon with exactly half the oxygen burns to CO only: C + ½O2 → CO, 393,5 − 283,0 kJ/mol
  const half = burn("than", 12, 50);
  near(half.co, 28);
  near(half.co2, 0);
  near(half.soot, 0);
  near(half.heat, 393.5 - DH_CO);
});

test("mass is conserved: fuel + oxygen used = products", () => {
  for (const id of FUEL_IDS) {
    for (const air of [40, 60, 80, 100, 150]) {
      const b = burn(id, 100, air);
      near(100 + b.o2Used * 32, b.co2 + b.co + b.soot + b.h2o + b.h2, 1e-9);
    }
  }
});

test("mass of water heated: Q = m·c·Δt", () => {
  const b = burn("gas", 100, 100);
  near(b.water * C_WATER * (T_HOT - T_COLD), b.heat);
  near(burn("than", 12, 100).water, 393.5 / (4.2 * 80));
});

test("comparison per kg and per unit of heat", () => {
  near(perKg("than").co2, 44 / 12);
  near(perKg("xang").heat, 5470 / 114);
  near(perKg("gas").co2PerMJ, (132 * 1000) / 2220);
  const order = [...FUEL_IDS].sort((a, b) => perKg(a).co2PerMJ - perKg(b).co2PerMJ);
  assert.equal(order[0], "hydro");
  assert.equal(order.at(-1), "than");
  assert.equal([...FUEL_IDS].sort((a, b) => perKg(b).heat - perKg(a).heat)[0], "hydro");
});

test("forged inputs cannot break the model", () => {
  near(burn("xang", 100, 5).heat, burn("xang", 100, 40).heat); // air is clamped to 40–150 %
  near(burn("xang", 100, 9999).heat, burn("xang", 100, 150).heat);
  assert.equal(burn("xang", -5, 100).heat, 0);
  assert.equal(burn("xang", NaN, 100).co2, 0);
  near(burn("nope", 100, 100).heat, burn("xang", 100, 100).heat);
  assert.equal(progress({ progress: -3 }), 0);
  assert.equal(progress({ progress: 1e9 }), 1);
  assert.equal(progress({ progress: "x" }), 0);
});

test("a burn takes BURN_TIME and reports its end once", () => {
  const s = { ...initialState(), progress: 0 };
  let ends = 0;
  const steps = Math.round(BURN_TIME * 120);
  for (let i = 0; i < steps + 2 && !ends; i++) if (step(s, 1 / 120)) ends++;
  assert.equal(ends, 1);
  assert.equal(s.progress, 1);
  step(s, 1 / 120); // a finished burn starts again from the beginning
  assert.ok(s.progress < 0.01);
});
