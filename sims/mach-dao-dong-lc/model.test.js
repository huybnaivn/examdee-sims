import test from "node:test";
import assert from "node:assert/strict";
import { VISUAL_PERIOD, initialState, recharge, tidy, step, omega, period, maxCurrent, initialEnergy, energy } from "./model.js";

const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b) + 1e-15, `${a} vs ${b}`);
const fresh = over => recharge({ ...initialState(), ...over });
/** Run n periods; returns samples [t, q, i]. */
function run(s, periods) {
  const out = [];
  for (let k = 0; k < periods * VISUAL_PERIOD * 120; k++) {
    step(s, 1 / 120);
    out.push([s.time, s.q, s.i]);
  }
  return out;
}

test("ω = 1/√(LC), T = 2π√(LC), I₀ = ω·Q₀", () => {
  const s = fresh({ inductance: 10, capacitance: 10, charge0: 100 }); // L = 0,01 H, C = 1e-5 F
  close(omega(s), 1 / Math.sqrt(1e-7));
  close(period(s), 2 * Math.PI * Math.sqrt(1e-7));
  close(maxCurrent(s), 1e-4 / Math.sqrt(1e-7));
  close(initialEnergy(s), (1e-4) ** 2 / (2 * 1e-5));
  close(period(fresh({ inductance: 40, capacitance: 10 })), 2 * period(s)); // T ∝ √L
  close(period(fresh({ inductance: 10, capacitance: 90 })), 3 * period(s)); // T ∝ √C
});

test("simulated period and peak current match the formulas", () => {
  for (const [inductance, capacitance, charge0] of [[10, 10, 100], [1, 100, 50], [100, 1, 200], [37, 64, 10]]) {
    const s = fresh({ inductance, capacitance, charge0 });
    const samples = run(s, 3.2);
    close(s.measuredPeriod, period(s), 1e-6);
    const peak = Math.max(...samples.map(([, , i]) => Math.abs(i)));
    close(peak, maxCurrent(s), 1e-3);
  }
});

test("without resistance total energy Q₀²/(2C) is conserved and swaps between C and L", () => {
  const s = fresh({ inductance: 25, capacitance: 4, charge0: 80 });
  const W = initialEnergy(s);
  close(energy(s).total, W);
  close(energy(s).electric, W);
  let minElectric = Infinity;
  let maxMagnetic = 0;
  for (let k = 0; k < 20 * VISUAL_PERIOD * 120; k++) {
    step(s, 1 / 120);
    close(energy(s).total, W, 1e-6);
    minElectric = Math.min(minElectric, energy(s).electric);
    maxMagnetic = Math.max(maxMagnetic, energy(s).magnetic);
  }
  assert.ok(minElectric < 1e-3 * W);
  close(maxMagnetic, W, 1e-3);
});

test("q = Q₀cos ωt and i = I₀cos(ωt + π/2): i leads q by a quarter period", () => {
  const s = fresh({ inductance: 10, capacitance: 10, charge0: 100 });
  const Q0 = 100e-6;
  const I0 = maxCurrent(s);
  const w = omega(s);
  for (const [t, q, i] of run(s, 2)) {
    assert.ok(Math.abs(q - Q0 * Math.cos(w * t)) < 1e-6 * Q0);
    assert.ok(Math.abs(i - I0 * Math.cos(w * t + Math.PI / 2)) < 1e-6 * I0);
  }
  // i reaches its maximum T/4 before q does
  const samples = run(fresh({}), 1.5);
  const T = period(s);
  const tq = samples.filter(([t]) => t > 0.5 * T).reduce((a, b) => (b[1] > a[1] ? b : a))[0]; // q max near t = T
  const ti = samples.filter(([t]) => t > 0.5 * T).reduce((a, b) => (b[2] > a[2] ? b : a))[0]; // i max near t = 3T/4
  close(tq - ti, T / 4, 5e-3);
});

test("resistance damps the oscillation: energy only falls, amplitude shrinks", () => {
  const s = fresh({ inductance: 10, capacitance: 10, charge0: 100, resistance: 2 });
  const W = initialEnergy(s);
  let prev = W;
  const peaks = [];
  let lastQ = s.q;
  let rising = false;
  for (let k = 0; k < 4 * VISUAL_PERIOD * 120; k++) {
    step(s, 1 / 120);
    assert.ok(energy(s).total <= prev * (1 + 1e-12));
    prev = energy(s).total;
    if (rising && s.q < lastQ) peaks.push(lastQ);
    rising = s.q > lastQ;
    lastQ = s.q;
  }
  assert.ok(peaks.length >= 3);
  for (let k = 1; k < peaks.length; k++) assert.ok(peaks[k] < peaks[k - 1]);
  // envelope e^(−Rt/2L): after one period the peak charge is about Q₀·e^(−R·T/(2L))
  const T = period(s);
  close(peaks[0] / 100e-6, Math.exp((-2 * T) / (2 * 0.01)), 5e-3);
  assert.ok(prev < 0.5 * W);
});

test("forged state is clamped to physical values", () => {
  const s = tidy({ ...initialState(), inductance: 1e9, capacitance: -5, charge0: 50, q: 1, i: -1e9, time: -3, lastCross: 99 });
  assert.equal(s.inductance, 100);
  assert.equal(s.capacitance, 1);
  close(s.q, 50e-6);
  close(s.i, -maxCurrent(s));
  assert.equal(s.time, 0);
  assert.equal(s.lastCross, -1);
});

test("initial state: 1⅛ periods in, energy shared equally, graphs already filled", () => {
  const s = initialState();
  close(s.time, 1.125 * period(s), 1e-6);
  close(energy(s).electric, energy(s).magnetic, 1e-4);
  assert.ok(s._hist.length > 300);
});
