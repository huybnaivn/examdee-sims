import test from "node:test";
import assert from "node:assert/strict";
import {
  R, EA, EA_CATALYST, MASS, PER_MOLAR, RATE_FRACTION, initialState, restart, step, ensure, bounce, random, sanitize,
  activationEnergy, effectiveFraction, thermalSpeed, collisionEnergy, collisionRate, concentration, finished, predictedProduct,
} from "./model.js";

const DT = 1 / 120;
const make = over => restart({ ...initialState(), ...over });
const run = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(s, DT);
  return s;
};
const count = (s, k) => ensure(s).filter(p => p.k === k).length;
/** Totals over several seeded runs of `seconds` each. */
const sample = (over, seconds, seeds) => {
  const sum = { collisions: 0, effective: 0, expected: 0 };
  for (let seed = 1; seed <= seeds; seed++) {
    const s = make({ ...over, seed });
    sum.expected += collisionRate(s) * seconds;
    run(s, seconds);
    sum.collisions += s.collisions;
    sum.effective += s.effective;
  }
  return { ...sum, fraction: sum.effective / sum.collisions };
};

test("initial amounts follow the concentrations", () => {
  const s = initialState();
  assert.equal(s.nA, 0.8 * PER_MOLAR);
  assert.equal(s.nB, 0.4 * PER_MOLAR);
  assert.equal(s.nAB, 0);
  assert.equal(concentration(s.nA), 0.8);
  assert.equal(count(s, 0), s.nA);
  assert.equal(count(s, 1), s.nB);
});

test("A + B → AB: every reaction removes one A and one B and makes one AB", () => {
  const s = initialState();
  const a0 = s.nA;
  const b0 = s.nB;
  let last = 0;
  for (let i = 0; i < 20 * 120; i++) {
    step(s, DT);
    assert.equal(s.nA + s.nAB, a0);
    assert.equal(s.nB + s.nAB, b0);
    assert.equal(s.nAB, s.effective);
    assert.ok(s.nAB >= last && s.effective <= s.collisions);
    last = s.nAB;
    if (i % 60 === 0) {
      assert.deepEqual([count(s, 0), count(s, 1), count(s, 2)], [s.nA, s.nB, s.nAB]);
    }
  }
  assert.ok(s.nAB > 10);
  assert.equal(s._hist.at(-1)[3], s.nAB);
});

test("Arrhenius factor exp(−Ea/RT); the catalyst lowers Ea", () => {
  assert.equal(activationEnergy({ catalyst: false }), EA);
  assert.equal(activationEnergy({ catalyst: true }), EA_CATALYST);
  assert.ok(EA_CATALYST < EA);
  assert.ok(Math.abs(effectiveFraction({ temperature: 400, catalyst: false }) - Math.exp(-EA / (R * 400))) < 1e-12);
  assert.ok(Math.abs(effectiveFraction({ temperature: 400, catalyst: false }) - 0.2223) < 1e-3);
  // a head-on collision at the thermal relative speed √2·σ·√2 carries RT... check the energy scale:
  // closing speed v along the line of centres, reduced mass ½ → E = ¼ v² (in units where σ² ↔ RT)
  const sigma = thermalSpeed(400);
  assert.ok(Math.abs(collisionEnergy(2 * sigma) - R * 400) < 1e-9);
  assert.ok(Math.abs(thermalSpeed(600) / thermalSpeed(300) - Math.SQRT2) < 1e-12);
  assert.ok(Math.abs(thermalSpeed(300, 2) / thermalSpeed(300, 1) - Math.SQRT1_2) < 1e-12);
});

test("a higher temperature gives a higher fraction of effective collisions", () => {
  const both = { concA: 1, concB: 1 };
  const cold = sample({ ...both, temperature: 250 }, 0.5, 40);
  const mid = sample({ ...both, temperature: 400 }, 0.5, 40);
  const hot = sample({ ...both, temperature: 600 }, 0.5, 40);
  assert.ok(cold.collisions > 1000);
  assert.ok(cold.fraction < mid.fraction && mid.fraction < hot.fraction);
  // and each agrees with exp(−Ea/RT) within the statistical tolerance of the particle model
  for (const [m, T] of [[cold, 250], [mid, 400], [hot, 600]]) {
    const theory = effectiveFraction({ temperature: T, catalyst: false });
    assert.ok(Math.abs(m.fraction - theory) / theory < 0.25, `T=${T}: ${m.fraction} vs ${theory}`);
  }
});

test("the catalyst raises the fraction of effective collisions", () => {
  const base = { concA: 1, concB: 1, temperature: 400 };
  const without = sample({ ...base, catalyst: false }, 0.5, 40);
  const withCat = sample({ ...base, catalyst: true }, 0.5, 40);
  assert.ok(withCat.fraction > without.fraction * 1.5);
  const theory = effectiveFraction({ temperature: 400, catalyst: true });
  assert.ok(Math.abs(withCat.fraction - theory) / theory < 0.25);
});

test("doubling a concentration about doubles the initial collision rate", () => {
  const base = { temperature: 250, concA: 0.4, concB: 0.5 };
  const one = sample(base, 3, 20);
  const doubleA = sample({ ...base, concA: 0.8 }, 3, 20);
  const doubleB = sample({ ...base, concB: 1 }, 3, 20);
  for (const two of [doubleA, doubleB]) {
    const ratio = two.collisions / one.collisions;
    assert.ok(ratio > 1.75 && ratio < 2.25, `ratio ${ratio}`);
  }
  // and the rate itself is what kinetic theory predicts for these discs
  assert.ok(Math.abs(one.collisions - one.expected) / one.expected < 0.2, `${one.collisions} vs ${one.expected}`);
});

test("the reaction stops when a reactant runs out", () => {
  const s = make({ temperature: 600, catalyst: true, concA: 1, concB: 0.2 });
  const b0 = s.nB;
  for (let i = 0; i < 600 * 120 && !finished(s); i++) step(s, DT);
  assert.ok(finished(s));
  assert.equal(s.nB, 0);
  assert.equal(s.nAB, b0);
  assert.equal(s.nA, 1 * PER_MOLAR - b0);
  assert.ok(s.halfTime > 0 && s.halfTime < s.endTime);
  assert.equal(s.endTime, s.time);
  assert.ok(s.initialRate > 0);
  const frozen = { time: s.time, nA: s.nA, nAB: s.nAB, effective: s.effective };
  run(s, 5);
  assert.deepEqual({ time: s.time, nA: s.nA, nAB: s.nAB, effective: s.effective }, frozen);
  assert.equal(count(s, 1), 0);
});

test("half-way and initial-rate marks are taken at the right moments", () => {
  const s = make({ concA: 0.5, concB: 0.5 });
  const n0 = s.nA;
  while (!s.halfTime) step(s, DT);
  assert.equal(s.nAB, n0 / 2);
  assert.equal(s.halfTime, s.time);
  // initial rate = Δ[AB] / Δt over the first quarter of the limiting reactant
  const entry = s._hist.find(h => h[3] >= RATE_FRACTION * n0);
  assert.ok(Math.abs(s.initialRate - concentration(entry[3]) / entry[0]) < 1e-12);
  assert.equal(s.endTime, 0);
});

test("the run is reproducible from the seed in the state", () => {
  const a = run(make({ seed: 7 }), 5);
  const b = run(make({ seed: 7 }), 5);
  const c = run(make({ seed: 8 }), 5);
  assert.deepEqual(a._p, b._p);
  assert.equal(a.rng, b.rng);
  assert.notDeepEqual(a._p, c._p);
  // restart goes back to t = 0 with the same particles
  const first = JSON.stringify(ensure(make({ seed: 7 })));
  assert.equal(JSON.stringify(ensure(restart(a))), first);
  assert.equal(a.time, 0);
  assert.equal(a.nAB, 0);
  const u = random(make({ seed: 3 }));
  assert.ok(u >= 0 && u < 1);
});

test("elastic bounce conserves momentum and kinetic energy", () => {
  const a = { k: 0, x: 0, y: 0, vx: 3, vy: 1 };
  const b = { k: 2, x: 2, y: 1, vx: -2, vy: 0.5 };
  const p = q => [MASS[q.k] * q.vx, MASS[q.k] * q.vy];
  const ke = q => 0.5 * MASS[q.k] * (q.vx ** 2 + q.vy ** 2);
  const before = { px: p(a)[0] + p(b)[0], py: p(a)[1] + p(b)[1], e: ke(a) + ke(b) };
  bounce(a, b);
  assert.ok(Math.abs(p(a)[0] + p(b)[0] - before.px) < 1e-12);
  assert.ok(Math.abs(p(a)[1] + p(b)[1] - before.py) < 1e-12);
  assert.ok(Math.abs(ke(a) + ke(b) - before.e) < 1e-12);
  assert.ok((b.vx - a.vx) * 2 + (b.vy - a.vy) * 1 > 0); // now moving apart
});

test("the temperature is held: mean kinetic energy per particle stays at RT (two dimensions)", () => {
  for (const temperature of [300, 600]) {
    let sum = 0;
    let n = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const s = make({ temperature, seed, concA: 1, concB: 1 });
      for (let k = 0; k < 20; k++) {
        run(s, 1);
        for (const q of s._p) {
          sum += 0.5 * MASS[q.k] * (q.vx ** 2 + q.vy ** 2);
          n++;
        }
      }
    }
    const sigma2 = thermalSpeed(temperature) ** 2; // ½m<v²> = σ² ↔ RT
    assert.ok(Math.abs(sum / n / sigma2 - 1) < 0.1, `T=${temperature}: ${sum / n / sigma2}`);
  }
});

test("the predicted curve solves the rate law and matches the average of many runs", () => {
  for (const over of [{}, { concA: 0.5, concB: 0.5 }, { concA: 0.3, concB: 0.9, temperature: 550, catalyst: true }]) {
    const s0 = make(over);
    const k = effectiveFraction(s0) * collisionRate({ ...s0, nA: 1, nB: 1 });
    assert.equal(predictedProduct(s0, 0), 0);
    // dx/dt = k (a0 − x)(b0 − x), checked by a central difference
    for (const t of [0.5, 3, 20]) {
      const x = predictedProduct(s0, t);
      const slope = (predictedProduct(s0, t + 1e-4) - predictedProduct(s0, t - 1e-4)) / 2e-4;
      assert.ok(Math.abs(slope - k * (s0.nA - x) * (s0.nB - x)) < 1e-5 * Math.max(1, slope));
    }
    assert.ok(Math.abs(predictedProduct(s0, 1e9) - Math.min(s0.nA, s0.nB)) < 1e-3); // limiting reactant used up in the end
    // the same value when asked in the middle of a run
    const later = run(make(over), 2);
    assert.ok(Math.abs(predictedProduct(later, 3) - predictedProduct(s0, 3)) < 1e-9);
    // average of 30 runs after 3 s
    let sum = 0;
    for (let seed = 1; seed <= 30; seed++) sum += run(make({ ...over, seed }), 3).nAB;
    const expected = predictedProduct(s0, 3);
    assert.ok(Math.abs(sum / 30 - expected) / expected < 0.15, `${JSON.stringify(over)}: ${sum / 30} vs ${expected}`);
  }
});

test("state from the host: a saved run is kept, settings alone start a fresh consistent run", () => {
  const saved = JSON.parse(JSON.stringify(run(make({ seed: 4 }), 3), (k, v) => (k.startsWith("_") ? undefined : v)));
  const back = sanitize(saved, initialState());
  assert.deepEqual(back, saved);
  step(back, DT); // particles are rebuilt from the counts
  assert.deepEqual([count(back, 0), count(back, 1), count(back, 2)], [back.nA, back.nB, back.nAB]);

  const preset = sanitize({ temperature: 9999, concA: 0.3, concB: 1, catalyst: "yes", bogus: 1 }, initialState());
  assert.equal(preset.temperature, 600);
  assert.equal(preset.catalyst, false);
  assert.equal(preset.bogus, undefined);
  assert.deepEqual([preset.nA, preset.nB, preset.nAB, preset.time], [24, 80, 0, 0]);

  // counts that contradict the concentrations, or absurd ones, are not trusted
  const forged = sanitize({ ...saved, nA: 1e9 }, initialState());
  assert.deepEqual([forged.nA, forged.nB, forged.nAB, forged.time], [64, 32, 0, 0]);
});
