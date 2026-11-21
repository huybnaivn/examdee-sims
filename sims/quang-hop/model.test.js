import test from "node:test";
import assert from "node:assert/strict";
import { initialState, rate, ceilings, tempFactor, curve, COLOURS, T_OPT } from "./model.js";

const at = extra => ({ ...initialState(), ...extra });
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("rate is the lowest of the three ceilings (law of limiting factors)", () => {
  for (const s of [at({}), at({ light: 100, colour: "red" }), at({ temp: 45 }), at({ co2: 0.1 })]) {
    const c = ceilings(s);
    const r = rate(s);
    close(r.rate, Math.min(...c));
    assert.equal(c[r.limiting], r.rate);
  }
  // the initial picture: white light at 50 % limits, 0,6 × 50 × 0,8 = 24 bubbles/min
  close(rate(at({})).rate, 24);
  assert.equal(rate(at({})).limiting, 0);
});

test("rate rises with light, then plateaus when CO₂ limits", () => {
  const s = at({ co2: 0.5, temp: T_OPT, colour: "red" });
  const pts = curve(s, "light");
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][1] >= pts[i - 1][1]);
  close(rate({ ...s, light: 20 }).rate, 0.6 * 20); // linear part: light limits
  close(rate({ ...s, light: 100 }).rate, 80 * 0.5); // plateau at the CO₂ ceiling
  close(rate({ ...s, light: 80 }).rate, rate({ ...s, light: 100 }).rate);
  assert.equal(rate({ ...s, light: 100 }).limiting, 1);
});

test("raising the limiting factor raises the rate, raising a non-limiting one does not", () => {
  const s = at({ light: 100, colour: "red", co2: 0.3, temp: T_OPT }); // CO₂ limits: 24 < 60
  assert.equal(rate(s).limiting, 1);
  assert.ok(rate({ ...s, co2: 0.5 }).rate > rate(s).rate);
  close(rate({ ...s, light: 90 }).rate, rate(s).rate);
  close(rate({ ...s, temp: 28 }).rate, rate(s).rate);
  const dim = at({ light: 20, co2: 0.5, temp: T_OPT }); // light limits
  assert.equal(rate(dim).limiting, 0);
  assert.ok(rate({ ...dim, light: 40 }).rate > rate(dim).rate);
  close(rate({ ...dim, co2: 1 }).rate, rate(dim).rate);
});

test("temperature: optimum at 30 °C and a sharper drop-off above it", () => {
  assert.equal(tempFactor(T_OPT), 1);
  const s = at({ light: 100, colour: "red", co2: 1 }); // light and CO₂ high: temperature limits
  const pts = curve(s, "temp", 50);
  for (const [T, r] of pts) assert.ok(r <= rate({ ...s, temp: T_OPT }).rate && tempFactor(T) <= 1);
  const ceil = Array.from({ length: 51 }, (_, T) => [T, ceilings({ ...s, temp: T })[2]]);
  assert.equal(ceil.reduce((a, b) => (b[1] > a[1] ? b : a))[0], T_OPT);
  close(rate({ ...s, temp: 30 }).rate, 60); // light ceiling 60 < temperature ceiling 70 here
  // same distance from the optimum: colder side keeps more activity than the hotter side
  assert.ok(tempFactor(T_OPT - 10) > tempFactor(T_OPT + 10));
  assert.ok(rate({ ...s, temp: 45 }).rate < 1);
  assert.equal(rate({ ...s, temp: 45 }).limiting, 2);
});

test("green light is the least effective colour", () => {
  const effs = Object.values(COLOURS).map(c => c.eff);
  assert.equal(Math.min(...effs), COLOURS.green.eff);
  assert.ok(COLOURS.red.eff > COLOURS.green.eff && COLOURS.blue.eff > COLOURS.green.eff);
  const base = { light: 60, co2: 1, temp: T_OPT };
  const rates = Object.keys(COLOURS).map(colour => rate(at({ ...base, colour })).rate);
  assert.equal(Math.min(...rates), rate(at({ ...base, colour: "green" })).rate);
  close(rate(at({ ...base, colour: "green" })).rate, 0.6 * 60 * 0.25);
});

test("no light, no photosynthesis; forged values are clamped", () => {
  for (const colour of Object.keys(COLOURS)) assert.equal(rate(at({ light: 0, colour })).rate, 0);
  assert.equal(rate(at({ light: 0 })).limiting, 0);
  assert.equal(rate(at({ co2: 0 })).rate, 0);
  assert.ok(rate(at({ light: 1e9 })).rate <= 80);
  assert.ok(rate(at({ light: -5 })).rate === 0);
  close(rate(at({ colour: "x" })).rate, rate(at({ colour: "white" })).rate);
});
