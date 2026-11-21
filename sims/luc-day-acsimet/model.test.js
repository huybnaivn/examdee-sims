import test from "node:test";
import assert from "node:assert/strict";
import {
  G, TANK_AREA, LEVEL0, LIQUIDS, initialState, step, lift, unsettle, level, submergedVolume, submergedFraction,
  weight, buoyancy, outcome, blockDensity, blockVolume, blockSide, liquidDensity, equilibriumZ,
} from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);
const make = over => ({ ...initialState(), ...over });
/** Drop the block from above the liquid and run until it settles. */
const settle = over => {
  const s = lift(make(over));
  for (let i = 0; i < 120 * 60 && !s.settled; i++) step(s, 1 / 120);
  assert.ok(s.settled, "block did not settle within 60 s");
  return s;
};
const CASES = [
  { mass: 1.2, volume: 2, liquid: "water" },
  { mass: 0.1, volume: 4, liquid: "mercury" },
  { mass: 10, volume: 0.5, liquid: "water" },
  { mass: 10, volume: 4, liquid: "oil" },
  { mass: 2, volume: 2.5, liquid: "brine" },
  { mass: 10, volume: 0.5, liquid: "mercury" },
  { mass: 2.4, volume: 2, liquid: "custom", customDensity: 1500 },
  { mass: 3.5, volume: 0.7, liquid: "custom", customDensity: 700 },
];

test("F_A = d·V_chìm with d = D·g, at every height of the block", () => {
  for (const c of CASES) {
    const s = make(c);
    for (let z = 0; z <= 0.42; z += 0.007) {
      near(buoyancy(s, z), liquidDensity(s) * G * submergedVolume(s, z));
      assert.ok(submergedVolume(s, z) <= blockVolume(s) * (1 + 1e-12));
    }
    near(buoyancy(s, 0), liquidDensity(s) * G * blockVolume(s)); // fully under at the floor
    assert.equal(buoyancy(s, LEVEL0 + 0.01), 0); // out of the liquid
  }
});

test("displaced volume equals the rise of the liquid level", () => {
  for (const c of CASES) {
    const s = make(c);
    for (let z = 0; z <= 0.42; z += 0.007) {
      near((level(s, z) - LEVEL0) * TANK_AREA, submergedVolume(s, z), 1e-12);
    }
  }
});

test("floats iff D_vật < D_lỏng, sinks iff greater", () => {
  for (const c of CASES) {
    const s = settle(c);
    const lighter = blockDensity(s) < liquidDensity(s);
    assert.equal(outcome(s), lighter ? "floating" : "sunk");
    if (lighter) {
      assert.ok(s.z > 0 && submergedFraction(s) < 1, "a floating block is off the floor and partly out");
    } else {
      assert.equal(s.z, 0);
      assert.ok(buoyancy(s) < weight(s));
      near(buoyancy(s), liquidDensity(s) * G * blockVolume(s));
    }
  }
});

test("floating: submerged fraction = D_vật/D_lỏng and F_A = P", () => {
  for (const c of CASES) {
    const s = settle(c);
    if (outcome(s) !== "floating") continue;
    near(submergedFraction(s), blockDensity(s) / liquidDensity(s), 1e-9);
    near(buoyancy(s), weight(s), 1e-9);
  }
  near(submergedFraction(initialState()), 0.6); // 600 kg/m³ in water
});

test("the simulated motion itself converges to that equilibrium (before the final snap)", () => {
  const s = lift(make({ mass: 1.2, volume: 2 }));
  let prev = s.z;
  while (!s.settled) {
    prev = s.z;
    step(s, 1 / 120);
  }
  assert.ok(Math.abs(prev - equilibriumZ(s)) < 1e-4, "integration stopped within 0,1 mm of the analytic rest position");
});

test("equal densities: suspended, fully under, F_A = P, and it stays where it is put", () => {
  const s = settle({ mass: 2, volume: 2, liquid: "water" });
  assert.equal(outcome(s), "suspended");
  near(submergedFraction(s), 1);
  near(buoyancy(s), weight(s));
  const held = unsettle(make({ mass: 0.8, volume: 1, liquid: "oil", z: 0.1 }));
  for (let i = 0; i < 600; i++) step(held, 1 / 120);
  assert.equal(outcome(held), "suspended");
  assert.ok(held.settled && Math.abs(held.z - 0.1) < 1e-6);
});

test("a block pushed under and let go comes back to the same floating position", () => {
  const s = unsettle(make({ z: 0 }));
  for (let i = 0; i < 1200 && !s.settled; i++) step(s, 1 / 120);
  near(s.z, initialState().z);
  near(blockSide(s) ** 2 * 0.1, blockVolume(s));
  assert.equal(LIQUIDS.water, 1000);
});
