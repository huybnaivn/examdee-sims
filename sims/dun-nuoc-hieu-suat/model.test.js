import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, C_WATER, PRESETS, PRICE_KWH, GAS_HEAT, GAS_PRICE, heatNeeded, boilTime, elapsed, tempAt, boiled,
  energySupplied, toKwh, gasMass, cost, summary, other, restart, step, predictionOk,
} from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("Q = m·c·Δt with c = 4200 J/(kg·K)", () => {
  assert.equal(C_WATER, 4200);
  near(heatNeeded(1, 20), 336000);
  near(heatNeeded(1.5, 25), 472500);
  near(heatNeeded(2, 100), 0);
  near(heatNeeded(2, 120), 0); // never negative
});

test("time = Q / (H·P)", () => {
  near(boilTime(initialState()), 472500 / (0.9 * 1500)); // 350 s
  near(boilTime({ ...initialState(), mass: 2, startTemp: 20, power: 1000, efficiency: 80 }), 840);
  near(boilTime({ ...initialState(), efficiency: 100 }), 315);
});

test("energy in kW·h", () => {
  near(toKwh(3.6e6), 1);
  near(toKwh(energySupplied({ power: 1000 }, 3600)), 1);
  const r = summary(initialState());
  near(r.energy, 1500 * 350);
  near(r.kwh, 525000 / 3.6e6);
  near(r.heat / r.energy, 0.9); // H = Q / A
  near(r.loss, 52500);
});

test("lower efficiency means more time and more energy for the same heat", () => {
  const good = summary({ ...initialState(), efficiency: 90 });
  const poor = summary({ ...initialState(), efficiency: 45 });
  near(poor.heat, good.heat);
  near(poor.time, 2 * good.time);
  near(poor.energy, 2 * good.energy);
  assert.ok(poor.cost > good.cost);
});

test("doubling the mass doubles the time; doubling the power halves it", () => {
  const s = initialState();
  near(boilTime({ ...s, mass: 3 }), 2 * boilTime(s));
  near(boilTime({ ...s, power: 3000 }), boilTime(s) / 2);
});

test("temperature rises linearly and stops at 100 °C", () => {
  const s = initialState();
  near(tempAt(s, 0), 25);
  near(tempAt(s, 175), 62.5);
  near(tempAt(s, 350), 100);
  assert.equal(tempAt(s, 5000), 100);
});

test("stepping reaches the boil at exactly the formula time, once", () => {
  for (const s of [initialState(), { ...initialState(), appliance: "gas", ...PRESETS.gas, mass: 0.7, startTemp: 13 }]) {
    let hits = 0;
    let n = 0;
    while (!boiled(s) && n++ < 1e6) if (step(s, 1 / 120)) hits++;
    assert.equal(hits, 1);
    assert.equal(s.time, boilTime(s));
    assert.equal(tempAt(s, elapsed(s)), 100);
    // playing again starts over with cold water
    assert.equal(step(s, 1), false);
    near(s.time, 1);
    assert.equal(restart(s).time, 0);
  }
});

test("a forged time cannot leave [0, boil time]", () => {
  assert.equal(elapsed({ ...initialState(), time: -50 }), 0);
  assert.equal(elapsed({ ...initialState(), time: 1e12 }), 350);
  assert.equal(elapsed({ ...initialState(), time: "x" }), 0);
});

test("cost and gas burnt at the illustrative prices", () => {
  near(cost("kettle", 3.6e6), PRICE_KWH);
  near(gasMass(GAS_HEAT), 1);
  near(cost("gas", GAS_HEAT), GAS_PRICE);
  const gas = summary(other(initialState())); // same water on the gas stove: 2000 W, 50 %
  near(gas.time, 472500 / 1000);
  near(gas.energy, 945000);
  near(gasMass(gas.energy), 945000 / 44e6);
  assert.equal(other(other(initialState())).appliance, "kettle");
});

test("prediction tolerance: 5 % or 10 s", () => {
  assert.equal(predictionOk(350, 350), true);
  assert.equal(predictionOk(365, 350), true);
  assert.equal(predictionOk(370, 350), false);
  assert.equal(predictionOk(60, 52), true);
  assert.equal(predictionOk(70, 52), false);
  assert.equal(predictionOk(0, 5), false); // no prediction made
});

test("every slider combination boils within the prediction slider's range", () => {
  near(boilTime({ mass: 3, startTemp: 10, power: 800, efficiency: 40 }), 3543.75);
});
