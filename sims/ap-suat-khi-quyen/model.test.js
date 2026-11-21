import test from "node:test";
import assert from "node:assert/strict";
import { P0, G, RHO_HG, MMHG, pressureAt, columnHeight, liquidPressure, tube, columnMass, toMmHg, toAtm, toHPa, cup, carton } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("p = ρ·g·h: 76 cmHg ≈ 1,013·10⁵ Pa", () => {
  near(liquidPressure(RHO_HG, 0.76), P0, 1e-5);
  near(columnHeight(P0), 0.76, 1e-5);
  near(columnHeight(liquidPressure(RHO_HG, 0.5)), 0.5);
  near(RHO_HG * G * columnHeight(80000), 80000);
});

test("conversions: mmHg, atm, hPa", () => {
  near(toMmHg(P0), 760, 1e-5);
  near(MMHG, 133.322, 1e-5);
  near(toAtm(P0), 1);
  near(toHPa(P0), 1013.25);
  near(toAtm(liquidPressure(RHO_HG, 0.38)), 0.5, 1e-5);
});

test("pressure falls with altitude per the standard atmosphere", () => {
  near(pressureAt(0), P0);
  let last = Infinity;
  for (let h = 0; h <= 9000; h += 500) {
    assert.ok(pressureAt(h) < last);
    last = pressureAt(h);
  }
  // near the ground: about 1 mmHg per 11 m (textbook: roughly 1 mmHg per 12 m)
  const perMm = 100 / toMmHg(pressureAt(0) - pressureAt(100));
  assert.ok(perMm > 10 && perMm < 12.5, `${perMm} m per mmHg`);
  // tabulated standard atmosphere values
  near(pressureAt(1000), 89876, 1e-3);
  near(pressureAt(5000), 54048, 1e-3);
  near(pressureAt(8848), 31400, 2e-2);
  near(pressureAt(-50), P0); // clamped
});

test("column height does not depend on cross-section or tilt (vertical height)", () => {
  for (const tilt of [0, 20, 40]) {
    const t = tube(P0, tilt);
    near(t.vertical, columnHeight(P0));
    near(t.along, columnHeight(P0) / Math.cos((tilt * Math.PI) / 180));
    assert.equal(t.full, false);
  }
  near(columnMass(P0, 0, 2), 2 * columnMass(P0, 0, 1)); // twice the area: twice the mercury, same height
  const steep = tube(P0, 45); // 0,76 / cos 45° > 1 m: the tube fills up
  assert.equal(steep.full, true);
  near(steep.along, 1);
  assert.ok(steep.vertical < columnHeight(P0));
});

test("upturned cup: the air pushes far harder than the water", () => {
  const c = cup(P0);
  near(c.down, 1000 * G * 0.1);
  assert.ok(c.up > 100 * c.down);
  near(c.maxWater, 10.33, 1e-3);
});

test("carton: the less air inside, the harder the outside air crushes it", () => {
  assert.equal(carton(P0, 0).force, 0);
  near(carton(P0, 50).inside, P0 / 2);
  near(carton(P0, 50).force, (P0 / 2) * 0.0072);
  assert.ok(carton(pressureAt(4000), 50).force < carton(P0, 50).force);
});
