import test from "node:test";
import assert from "node:assert/strict";
import { initialState, expansion, exactRel, waterDensity, fitLiquid, railGap, bimetalCurvature, bendToward, bimetalDeflection, material, materialIndex, MATERIALS, WATER_DENSITY, RAIL, ALPHA } from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-12), `${a} ≠ ${b}`);
const at = over => ({ ...initialState(), ...over });

test("rod: Δl = α·l₀·Δt (shown in mm)", () => {
  const e = expansion(at({ object: "rod", solid: "steel", l0: 10, dT: 30 }));
  near(e.delta, 11e-6 * 10 * 30 * 1000); // 3,3 mm
  near(e.delta, 3.3);
  near(expansion(at({ solid: "aluminium", l0: 2, dT: 100 })).delta, 24e-6 * 2 * 100 * 1000);
  near(expansion(at({ dT: -30 })).delta, -3.3); // cooling shortens the rod
  assert.equal(expansion(at({ dT: 0 })).delta, 0);
});

test("plate: ΔS ≈ 2α·S₀·Δt, within (αΔt)² of the exact value", () => {
  const s = at({ object: "plate", solid: "copper", s0: 400, dT: 150 });
  const e = expansion(s);
  near(e.delta, 2 * 17e-6 * 400 * 150);
  const exact = 400 * exactRel(17e-6, 150, 2);
  assert.ok(Math.abs(e.delta - exact) <= 400 * (17e-6 * 150) ** 2 * 1.0001);
  near(e.delta, exact, 2e-3);
});

test("block: β = 3α for solids, ΔV ≈ 3α·V₀·Δt", () => {
  for (const solid of ["steel", "aluminium", "copper", "glass"]) {
    const e = expansion(at({ object: "block", solid, v0: 1000, dT: 80 }));
    near(e.coef, 3 * ALPHA(solid));
    near(e.delta, 3 * ALPHA(solid) * 1000 * 80);
    near(e.delta, 1000 * exactRel(ALPHA(solid), 80, 3), 5e-3);
  }
});

test("liquids: ΔV = β·V₀·Δt for ethanol; liquids expand much more than solids", () => {
  const e = expansion(at({ object: "liquid", liquid: "alcohol", v0: 500, t0: 20, dT: 40 }));
  near(e.delta, 1.1e-3 * 500 * 40); // 22 cm³
  const glass = expansion(at({ object: "block", solid: "glass", v0: 500, dT: 40 }));
  assert.ok(e.delta > 30 * glass.delta);
});

test("water: the density table peaks at 4 °C, so water contracts from 0 to 4 °C and expands above", () => {
  const max = WATER_DENSITY.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.equal(max[0], 4);
  for (let i = 1; i < WATER_DENSITY.length; i++) {
    const [t, r] = WATER_DENSITY[i];
    const r0 = WATER_DENSITY[i - 1][1];
    assert.ok(t <= 4 ? r > r0 : r < r0, `density at ${t} °C`);
  }
  near(waterDensity(4), 0.99997);
  near(waterDensity(17.5), (0.9991 + 0.99821) / 2);
  const cool = expansion(at({ object: "liquid", liquid: "water", v0: 1000, t0: 0, dT: 4 }));
  assert.ok(cool.delta < 0); // heating from 0 °C to 4 °C: the volume shrinks
  near(cool.delta, 1000 * (0.99984 / 0.99997 - 1));
  const warm = expansion(at({ object: "liquid", liquid: "water", v0: 1000, t0: 4, dT: 16 }));
  assert.ok(warm.delta > 0);
  // the smallest volume of a given mass is at 4 °C
  let best = 0;
  for (let t = 0; t <= 100; t += 0.5) if (waterDensity(t) > waterDensity(best)) best = t;
  assert.equal(best, 4);
  // 20 → 80 °C: about 2,7 %
  near(expansion(at({ object: "liquid", liquid: "water", v0: 1000, t0: 20, dT: 60 })).delta, 1000 * (0.99821 / 0.97182 - 1));
});

test("liquids stay liquid: t₀ and Δt are fitted into 0…100 °C (water) or 0…78 °C (ethanol)", () => {
  const w = fitLiquid(at({ object: "liquid", liquid: "water", t0: 20, dT: 150 }));
  assert.equal(w.t0 + w.dT, 100);
  const a = fitLiquid(at({ object: "liquid", liquid: "alcohol", t0: 90, dT: -200 }));
  assert.equal(a.t0, 78);
  assert.equal(a.t0 + a.dT, 0);
  const rod = fitLiquid(at({ object: "rod", dT: 200 }));
  assert.equal(rod.dT, 200); // solids are not limited
});

test("material index points into the combined list", () => {
  assert.equal(materialIndex(at({})), 0);
  assert.equal(materialIndex(at({ object: "liquid", liquid: "alcohol" })), 5);
  assert.equal(material(at({ object: "plate", solid: "glass" })).name, "Thủy tinh");
  assert.equal(MATERIALS.length, 6);
});

test("rails: the 6 mm gap closes by α·L·Δt", () => {
  near(railGap(0), RAIL.gap);
  near(railGap(30), 6 - 11e-6 * 12.5 * 30 * 1000);
  near(railGap(-20), 6 + 11e-6 * 12.5 * 20 * 1000);
  assert.ok(railGap(40) > 0 && railGap(45) < 0);
});

test("bimetal: bends toward the metal that expands less, both ways", () => {
  const cu = ALPHA("copper");
  const fe = ALPHA("steel");
  assert.equal(bendToward(cu, fe, 50), "bottom"); // copper on top expands more → curls toward steel
  assert.equal(bendToward(fe, cu, 50), "top");
  assert.equal(bendToward(cu, fe, -50), "top"); // cooled: copper shrinks more → curls toward copper
  assert.equal(bendToward(cu, cu, 80), "none");
  const k = bimetalCurvature(cu, fe, 30, 1e-3);
  near(k, (1.5 * 6e-6 * 30) / 1e-3);
  near(bimetalDeflection(k, 0.1), (k * 0.01) / 2);
  near(bimetalCurvature(cu, fe, 60), 2 * bimetalCurvature(cu, fe, 30));
});
