import test from "node:test";
import assert from "node:assert/strict";
import {
  START, KEYS, YEARS, TARGET_PPM, GTC_PER_PPM, initialState, fluxes, netChange, advance, simulate, total, ppm, peakPpm, meetsTarget, yearOf,
} from "./model.js";

const NONE = { burning: 0, deforestation: 0 };
const SCENARIOS = [NONE, { burning: 10, deforestation: 10 }, { burning: 20, deforestation: 50 }, { burning: 3, deforestation: 0 }];

test("year 0 is 280 ppm and uses the textbook fluxes", () => {
  assert.ok(Math.abs(ppm(START) - 280) < 1e-9);
  assert.equal(GTC_PER_PPM, 2.13);
  const f = fluxes(START, NONE);
  const want = { photosynthesis: 120, plantRespiration: 60, eaten: 5, litter: 55, animalRespiration: 4, animalWaste: 1, decomposition: 56, oceanUptake: 90, oceanRelease: 90, combustion: 0 };
  for (const [k, v] of Object.entries(want)) assert.ok(Math.abs(f[k] - v) < 1e-9, k);
});

test("total carbon is conserved across all six reservoirs", () => {
  for (const p of SCENARIOS) {
    const d = netChange(START, p);
    assert.ok(Math.abs(KEYS.reduce((sum, k) => sum + d[k], 0)) < 1e-9);
    for (const r of simulate(p)) assert.ok(Math.abs(total(r) - total(START)) < 1e-6 * total(START));
  }
});

test("steady state when the fluxes balance (no burning, no deforestation)", () => {
  const d = netChange(START, NONE);
  for (const k of KEYS) assert.ok(Math.abs(d[k]) < 1e-9, k);
  const end = simulate(NONE).at(-1);
  for (const k of KEYS) assert.ok(Math.abs(end[k] - START[k]) < 1e-6, k);
});

test("more burning raises atmospheric carbon", () => {
  let before = -Infinity;
  for (const burning of [0, 2, 5, 10, 20]) {
    const run = simulate({ burning, deforestation: 0 });
    assert.ok(run.at(-1).atm > before);
    before = run.at(-1).atm;
    if (burning) for (let y = 1; y < run.length; y++) assert.ok(run[y].atm > run[y - 1].atm);
  }
  assert.equal(fluxes(START, { burning: 7, deforestation: 0 }).combustion, 7);
  assert.ok(Math.abs(simulate({ burning: 10, deforestation: 0 }).at(-1).fossil - (START.fossil - 10 * YEARS)) < 1e-6);
});

test("deforestation reduces uptake and raises atmospheric carbon", () => {
  assert.ok(Math.abs(fluxes(START, { burning: 0, deforestation: 25 }).photosynthesis - 90) < 1e-9);
  let uptake = Infinity;
  let atm = -Infinity;
  for (const deforestation of [0, 10, 30, 50]) {
    const f = fluxes(START, { burning: 0, deforestation });
    assert.ok(f.photosynthesis < uptake);
    uptake = f.photosynthesis;
    const end = simulate({ burning: 0, deforestation }).at(-1);
    assert.ok(end.atm > atm);
    atm = end.atm;
    if (deforestation) assert.ok(end.plants < START.plants);
  }
});

test("fluxes are never negative and reservoirs never go below zero", () => {
  const starts = [START, { atm: 0, plants: 0, animals: 0, soil: 0, ocean: 0, fossil: 5 }, { atm: 5000, plants: 1, animals: 50, soil: 1, ocean: 100, fossil: 30 }, { atm: -5, plants: NaN, animals: 1e9, soil: -1, ocean: 1e12, fossil: -3 }];
  for (const start of starts) {
    for (const p of [...SCENARIOS, { burning: 1e9, deforestation: 1e9 }, { burning: -5, deforestation: -5 }]) {
      let r = start;
      for (let y = 0; y < 300; y++) {
        r = advance(r, p, 1);
        for (const k of KEYS) assert.ok(r[k] >= 0 && Number.isFinite(r[k]), `${k} = ${r[k]}`);
        for (const [k, v] of Object.entries(fluxes(r, p))) assert.ok(v >= 0 && Number.isFinite(v), `${k} = ${v}`);
      }
    }
  }
});

test("burning stops when the fossil reservoir is empty", () => {
  const r = advance({ ...START, fossil: 30 }, { burning: 20, deforestation: 0 }, 50);
  assert.ok(r.fossil >= 0 && r.fossil < 1e-6);
  assert.ok(fluxes(r, { burning: 20, deforestation: 0 }).combustion < 1e-6);
});

test("goal: the default run misses the target, a low-carbon run meets it", () => {
  const s = initialState();
  assert.ok(!meetsTarget(simulate(s)));
  assert.ok(peakPpm(simulate(s)) > TARGET_PPM);
  assert.ok(meetsTarget(simulate({ burning: 5, deforestation: 10 })));
  assert.ok(meetsTarget(simulate(NONE)));
});

test("a forged year is clamped", () => {
  assert.equal(yearOf({ year: -4 }), 0);
  assert.equal(yearOf({ year: 1e9 }), YEARS);
  assert.equal(yearOf({ year: NaN }), 0);
  assert.equal(yearOf({ year: 41.7 }), 41);
});
