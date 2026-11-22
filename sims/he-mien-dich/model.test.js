import test from "node:test";
import assert from "node:assert/strict";
import {
  DAYS, PROTECT, INCUBATION, MEMORY_AFTER, MAX_EXPOSURES, PRIMARY, SECONDARY, N, INDEX_CASES, INFECTIOUS_DAYS, Q, R0,
  initialState, cleanExposures, response, responses, antibody, illness, stats, outbreak, census, nextSeed, sanitize,
} from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const P = t => ({ t, kind: "pathogen" });
const V = t => ({ t, kind: "vaccine" });

test("one response follows the documented curve: lag, rise to the peak, exponential decay", () => {
  for (const r of [PRIMARY, SECONDARY]) {
    assert.equal(response(r, 0), 0);
    assert.equal(response(r, r.lag), 0);
    near(response(r, r.lag + r.rise / 2), r.peak / 2);
    near(response(r, r.lag + r.rise), r.peak);
    near(response(r, r.lag + r.rise + r.decay), r.peak / Math.E);
    // nothing on the whole curve is above the peak
    for (let t = 0; t <= DAYS; t += 0.25) assert.ok(response(r, t) <= r.peak + 1e-12);
  }
  // a single exposure on day 5: the total level is that one response
  near(antibody([P(5)], 19), 1);
  assert.equal(antibody([P(5)], 12), 0);
});

test("the secondary response comes earlier and is higher than the primary one", () => {
  const list = initialState().exposures; // the same pathogen on day 5 and on day 45
  const [first, second] = [stats(list, 0), stats(list, 1)];
  assert.deepEqual([first.secondary, second.secondary], [0, 1]);
  assert.equal(first.timeToPeak, 14);
  assert.equal(second.timeToPeak, 5);
  near(first.peak, 1);
  assert.ok(second.peak >= 10 * first.peak);
  near(second.peak, 10 + Math.exp(-(50 - 19) / 10)); // plus what is left of the first response
  // the peak days are where the curve really tops out
  for (const [from, to, at] of [[5, 44, 19], [45, 100, 50]]) {
    let best = from;
    for (let t = from; t <= to; t += 0.25) if (antibody(list, t) > antibody(list, best)) best = t;
    assert.equal(best, at);
  }
  // memory needs MEMORY_AFTER days: a second exposure before that is still a primary response
  assert.equal(responses([P(5), P(5 + MEMORY_AFTER - 1)])[1].type, PRIMARY);
  assert.equal(responses([P(5), P(5 + MEMORY_AFTER)])[1].type, SECONDARY);
});

test("a vaccine leaves memory without illness", () => {
  // unvaccinated: ill from the end of incubation until antibodies reach the protective level
  near(illness([P(5)], 0).days, PRIMARY.lag + PRIMARY.rise / 2 - INCUBATION, 0.011);
  near(antibody([P(5)], 5 + PRIMARY.lag + PRIMARY.rise / 2), PROTECT);
  // vaccine first: no illness from the vaccine, a secondary response and no illness on infection
  const list = [V(5), P(40)];
  assert.equal(stats(list, 0).illnessDays, 0);
  assert.deepEqual([stats(list, 0).vaccine, stats(list, 0).secondary], [1, 0]);
  assert.deepEqual([stats(list, 1).secondary, stats(list, 1).illnessDays, stats(list, 1).timeToPeak], [1, 0, 5]);
  // the first natural infection makes ill, the second one (memory) does not
  assert.ok(stats([P(5), P(45)], 0).illnessDays > 7);
  assert.equal(stats([P(5), P(45)], 1).illnessDays, 0);
});

test("spread falls as vaccination coverage rises (fixed seeds)", () => {
  for (const seed of [2026, nextSeed(2026), 7, 123456789]) {
    let prev = Infinity;
    for (let coverage = 0; coverage <= 100; coverage += 5) {
      const run = outbreak(seed, coverage);
      assert.ok(run.infected <= prev, `seed ${seed}, coverage ${coverage}: ${run.infected} > ${prev}`);
      prev = run.infected;
    }
    assert.ok(outbreak(seed, 0).fraction > 0.9); // nobody vaccinated: nearly everyone is infected
    assert.equal(outbreak(seed, 0).stopped, false);
    assert.equal(outbreak(seed, 100).infected, INDEX_CASES); // everybody else vaccinated: only the index cases
    assert.equal(outbreak(seed, 80).stopped, true);
  }
  near(Q, 1 - 0.9 ** INFECTIOUS_DAYS);
  near(R0, 8 * Q);
});

test("a spread run is deterministic and its counts add up", () => {
  const a = outbreak(2026, 40);
  const b = outbreak(2026, 40);
  assert.deepEqual([...a.infDay], [...b.infDay]);
  assert.deepEqual([...a.vaccinated], [...b.vaccinated]);
  assert.notDeepEqual([...a.infDay], [...outbreak(nextSeed(2026), 40).infDay]);
  for (const day of [0, 3, 10, a.end, a.end + 50]) {
    const c = census(a, day);
    assert.equal(c.vaccinated + c.sick + c.recovered + c.susceptible, N);
    for (let i = 0; i < N; i++) assert.ok(!(a.vaccinated[i] && a.infDay[i] >= 0)); // vaccinated people are never infected
  }
  assert.equal(census(a, 0).sick, INDEX_CASES);
  assert.deepEqual([census(a, a.end).sick, census(a, a.end).recovered], [0, a.infected]);
  assert.ok(Math.abs(census(a, 0).vaccinated / N - 0.4) < 0.05);
  // raising the coverage only adds vaccinated people
  const more = outbreak(2026, 60);
  for (let i = 0; i < N; i++) assert.ok(more.vaccinated[i] >= a.vaccinated[i]);
});

test("state from the host is cleaned", () => {
  const list = cleanExposures([P(50), { t: "x", kind: "pathogen" }, { t: 3, kind: "poison" }, V(-20), P(1e9), null, P(7), P(8)]);
  assert.equal(list.length, MAX_EXPOSURES);
  assert.deepEqual(list.map(e => e.t), [0, 7, 8, 50]);
  assert.deepEqual(cleanExposures("nope"), []);
  const base = initialState();
  const out = sanitize({ view: 7, exposures: [V(10), 5], time: -4, day: 1e12, seed: -1, coverage: 55, extra: 1 }, base);
  assert.deepEqual(out, { exposures: [V(10)], time: 0, day: 1e4, seed: 4294967295, coverage: 55 });
});
