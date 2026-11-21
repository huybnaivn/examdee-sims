import test from "node:test";
import assert from "node:assert/strict";
import { G, RHO, BETZ, solarPower, sweptArea, windPower, dailyEnergy, outputs, initialState } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("solar panel: P = η·G·A·cos θ", () => {
  near(solarPower(10, 18, 30), 0.18 * 1000 * 10 * Math.cos(Math.PI / 6));
  near(solarPower(1, 100, 0), G);
  near(solarPower(2, 20, 60), 0.2 * 1000 * 2 * 0.5);
  assert.ok(solarPower(10, 18, 89.9) < 5);
  assert.ok(solarPower(10, 18, 90) < 1e-9);
  near(solarPower(20, 18, 30), 2 * solarPower(10, 18, 30)); // proportional to area
});

test("wind turbine: P = ½ρAv³·Cp with A = πR²", () => {
  near(sweptArea(2), Math.PI * 4);
  near(windPower(1.5, 6, 0.35), 0.5 * RHO * Math.PI * 2.25 * 216 * 0.35);
  near(windPower(3, 6, 0.35), 4 * windPower(1.5, 6, 0.35)); // double the blade, four times the area
  assert.equal(windPower(2, 0, 0.4), 0);
});

test("doubling the wind speed gives eight times the power", () => {
  for (const v of [2, 4.5, 7]) near(windPower(2, 2 * v, 0.4) / windPower(2, v, 0.4), 8);
});

test("Betz limit: Cp is never above 16/27", () => {
  near(BETZ, 0.5925925925925926);
  near(windPower(2, 8, 0.9), windPower(2, 8, BETZ));
  near(windPower(2, 8, 1), 0.5 * RHO * sweptArea(2) * 512 * (16 / 27));
  assert.ok(windPower(2, 8, 0.5) < windPower(2, 8, BETZ));
});

test("daily energy = power × hours, in kWh", () => {
  near(dailyEnergy(1000, 5), 5);
  near(dailyEnergy(250, 24), 6);
  const o = outputs(initialState());
  near(o.solarKWh, (o.solarW * 4) / 1000);
  near(o.windKWh, (o.windW * 10) / 1000);
  near(o.total, o.solarKWh + o.windKWh);
  assert.ok(o.total < initialState().need); // the opening state is a little short of the household's need
});

test("forged inputs stay physical", () => {
  assert.equal(solarPower(-5, 18, 30), 0);
  assert.equal(windPower(2, -10, 0.4), 0);
  assert.equal(dailyEnergy(100, NaN), 0);
  near(dailyEnergy(100, 99), 2.4);
});
