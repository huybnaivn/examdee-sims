import test from "node:test";
import assert from "node:assert/strict";
import { initialState, frequency, omega, fluxMax, E0, Eeff, flux, emf, output, coilAngle, step, period } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1), `${a} ≠ ${b}`);
const at = over => ({ ...initialState(), ...over });

test("Φ = N·B·S·cos ωt", () => {
  const s = at({ turns: 200, B: 0.5, area: 100 });
  near(fluxMax(s), 200 * 0.5 * 0.01);
  for (const t of [0, 0.001, 0.0037, 0.013]) near(flux(s, t), 200 * 0.5 * 0.01 * Math.cos(2 * Math.PI * 50 * t));
});

test("E₀ = N·B·S·ω; default 100 vòng, 0,2 T, 200 cm², 50 vòng/s gives about 125,7 V", () => {
  const s = at({});
  near(E0(s), 100 * 0.2 * 0.02 * 2 * Math.PI * 50);
  near(E0(s), 125.66, 1e-4);
  near(E0(at({ turns: 300 })), 3 * E0(s));
  near(E0(at({ B: 0.4 })), 2 * E0(s));
  near(E0(at({ n: 25 })), E0(s) / 2);
});

test("e = −dΦ/dt", () => {
  const s = at({ phase: 30, p: 2, n: 7 });
  const h = 1e-7;
  for (const t of [0, 0.01, 0.023, 0.05]) near(emf(s, t), -(flux(s, t + h) - flux(s, t - h)) / (2 * h), 1e-5);
});

test("effective value E₀/√2 equals the rms of e over one period", () => {
  const s = at({ n: 13, turns: 250 });
  const T = period(s);
  let sum = 0;
  const k = 10000;
  for (let i = 0; i < k; i++) sum += emf(s, (T * i) / k) ** 2;
  near(Math.sqrt(sum / k), Eeff(s), 1e-9);
  near(Eeff(s), E0(s) / Math.SQRT2);
});

test("f = n·p", () => {
  assert.equal(frequency(at({ n: 50, p: 1 })), 50);
  assert.equal(frequency(at({ n: 12.5, p: 4 })), 50);
  near(omega(at({ n: 10, p: 3 })), 2 * Math.PI * 30);
  // with p pole pairs the coil turns 1/p of a revolution per electrical period
  const s = at({ n: 10, p: 3 });
  near(coilAngle(s, period(s)) - coilAngle(s, 0), (2 * Math.PI) / 3);
});

test("emf is zero when the flux is extreme, and extreme when the flux is zero", () => {
  const s = at({});
  const T = period(s);
  for (const t of [0, T / 2, T]) {
    near(Math.abs(flux(s, t)), fluxMax(s));
    near(emf(s, t), 0, 1e-12);
  }
  for (const t of [T / 4, (3 * T) / 4]) {
    near(flux(s, t), 0, 1e-12);
    near(Math.abs(emf(s, t)), E0(s));
  }
  near(emf(s, T / 4), E0(s)); // e = E₀·sin ωt: positive maximum a quarter period in
});

test("phase φ shifts e: e(0) = E₀·sin φ", () => {
  near(emf(at({ phase: 90 }), 0), E0(at({})));
  near(emf(at({ phase: 30 }), 0), E0(at({})) / 2);
});

test("commutator output never changes sign, and equals |e|", () => {
  const ac = at({});
  const dc = at({ dc: true });
  let neg = 0;
  for (let i = 0; i < 2000; i++) {
    const t = (i / 2000) * 3 * period(dc);
    assert.ok(output(dc, t) >= 0);
    near(output(dc, t), Math.abs(emf(ac, t)));
    if (output(ac, t) < -1e-9) neg++;
  }
  assert.ok(neg > 500); // slip rings: alternating
});

test("step keeps t in [0, about 1 s) without jumping the coil", () => {
  const s = at({ n: 7.5, p: 2 });
  const before = [];
  for (let i = 0; i < 300; i++) {
    const a = coilAngle(s);
    step(s, 1 / 120);
    before.push(a);
    assert.ok(s.t >= 0 && s.t < 1.2);
  }
  // after wrapping the coil is where continuous time would put it
  const c = at({ n: 7.5, p: 2 });
  near(Math.cos(coilAngle(s)), Math.cos(coilAngle(c, 0.003 + 300 / 120)), 1e-6);
  near(Math.sin(coilAngle(s)), Math.sin(coilAngle(c, 0.003 + 300 / 120)), 1e-6);
});
