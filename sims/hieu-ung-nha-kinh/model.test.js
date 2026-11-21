import test from "node:test";
import assert from "node:assert/strict";
import {
  SOLAR, SIGMA, CO2_PRE, CLOUD_REF, albedo, absorptivity, absorbedSolar, bareTemperature, surfaceTemperature, equilibrium, fluxes, baseline, rise,
  initialState, step, toC, T_MIN, T_MAX,
} from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("without an atmosphere T = (S(1 − α)/(4σ))^¼, about 255 K for α = 0,3", () => {
  for (const cloud of [0, 30, CLOUD_REF, 100]) {
    const s = { ...initialState(), cloud, atmosphere: false };
    near(equilibrium(s), ((SOLAR * (1 - albedo(cloud))) / (4 * SIGMA)) ** 0.25);
    near(equilibrium(s), bareTemperature(cloud));
  }
  const T = ((SOLAR * 0.7) / (4 * SIGMA)) ** 0.25;
  assert.ok(T > 254 && T < 256);
  near(albedo(CLOUD_REF), 0.301);
  near(surfaceTemperature(0, CLOUD_REF), bareTemperature(CLOUD_REF));
});

test("one-layer model: T = T_e·(2/(2 − ε))^¼ and more absorption warms the surface monotonically", () => {
  near(surfaceTemperature(1, 50), bareTemperature(50) * 2 ** 0.25);
  let last = -Infinity;
  for (let eps = 0; eps <= 0.99; eps += 0.03) {
    const T = surfaceTemperature(eps, CLOUD_REF);
    assert.ok(T > last);
    last = T;
  }
  last = -Infinity;
  for (let co2 = 180; co2 <= 1200; co2 += 20) {
    const T = equilibrium({ ...initialState(), co2 });
    assert.ok(T > last);
    last = T;
  }
  // calibration: about 14 °C before industry, about +3 °C for doubled CO₂
  assert.ok(toC(baseline()) > 13 && toC(baseline()) < 15);
  const doubled = equilibrium({ ...initialState(), co2: 2 * CO2_PRE }) - baseline();
  assert.ok(doubled > 2.7 && doubled < 3.3);
  near(rise({ ...initialState(), co2: CO2_PRE }), 0);
});

test("energy in equals energy out at equilibrium, for the planet and for the layer", () => {
  for (const s of [initialState(), { ...initialState(), co2: 1000, cloud: 20 }, { ...initialState(), atmosphere: false }]) {
    const eps = absorptivity(s.co2, s.atmosphere);
    const f = fluxes(equilibrium(s), eps, s.cloud);
    near(f.outgoing, f.absorbed); // top of the atmosphere
    near(f.absorbed + f.back, f.ground); // the ground
    near(eps * f.ground, 2 * f.back); // the layer: absorbs ε·σT⁴, emits half up and half down
    near(f.incoming, f.reflected + f.absorbed);
  }
});

test("clouds reflect sunlight: more cloud, less absorbed, colder", () => {
  let last = Infinity;
  for (let cloud = 0; cloud <= 100; cloud += 10) {
    assert.ok(absorbedSolar(cloud) < last);
    last = absorbedSolar(cloud);
  }
  near(absorbedSolar(0), (SOLAR * 0.9) / 4);
  assert.ok(equilibrium({ ...initialState(), cloud: 90 }) < equilibrium({ ...initialState(), cloud: 30 }));
});

test("the surface warms towards the new balance and stops there", () => {
  const s = { ...initialState(), co2: CO2_PRE, temp: baseline() };
  s.co2 = 800;
  const target = equilibrium(s);
  let last = s.temp;
  for (let i = 0; i < 120 * 30; i++) {
    step(s, 1 / 120);
    assert.ok(s.temp >= last - 1e-9 && s.temp <= target + 1e-6);
    last = s.temp;
  }
  near(s.temp, target, 1e-6);
  // forged or missing temperatures are pulled back into range
  for (const bad of [0, -5, 1e9, NaN]) {
    const t = step({ ...initialState(), temp: bad }, 1 / 120);
    assert.ok(t.temp >= T_MIN && t.temp <= T_MAX);
  }
  assert.equal(absorptivity(1e9), 0.99);
  assert.ok(absorptivity(-10) >= 0);
});
