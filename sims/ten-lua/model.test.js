import test from "node:test";
import assert from "node:assert/strict";
import { initialState, stepRocket, burnTime, thrust, mass, fuelLeft, formulaSpeed, tsiolkovsky, burstSpeed, recoilSpeed, G } from "./model.js";

const fly = patch => {
  const s = { ...initialState(), ...patch, launched: true };
  while (!s.done) stepRocket(s, 1 / 120);
  return s;
};
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

test("recoil: m₁v₁ + m₂v₂ = 0", () => {
  for (const [gunMass, bulletMass, bulletSpeed] of [[4, 10, 800], [1, 50, 300], [10, 5, 900]]) {
    const s = { ...initialState(), gunMass, bulletMass, bulletSpeed };
    assert.ok(Math.abs(gunMass * recoilSpeed(s) + (bulletMass / 1000) * bulletSpeed) < 1e-12);
    assert.ok(recoilSpeed(s) < 0);
  }
  assert.equal(recoilSpeed(initialState()), -2);
});

test("thrust F = u·|dm/dt| and the burn lasts m_fuel/μ", () => {
  const s = initialState();
  assert.equal(thrust(s), 2500 * 100);
  assert.equal(burnTime(s), 30);
  assert.equal(mass({ ...s, time: 10 }), 3000);
  assert.equal(fuelLeft({ ...s, time: 1e9 }), 0);
});

test("in free space the stepped integration gives Δv = u·ln(m₀/m)", () => {
  for (const patch of [{}, { exhaustSpeed: 4000, fuelMass: 9000, massFlow: 37 }, { dryMass: 200, massFlow: 500 }]) {
    const s = fly(patch);
    assert.ok(rel(s.v, formulaSpeed(s)) < 1e-5, `${s.v} vs ${formulaSpeed(s)}`);
    assert.ok(rel(formulaSpeed(s), tsiolkovsky(s.exhaustSpeed, s.dryMass + s.fuelMass, s.dryMass)) < 1e-12);
  }
  assert.ok(Math.abs(fly({}).v - 2500 * Math.log(4)) < 0.01);
});

test("momentum of rocket and gas adds up to zero in free space", () => {
  const s = { ...initialState(), launched: true };
  for (let i = 0; i < 1000; i++) {
    stepRocket(s, 1 / 120);
    assert.ok(Math.abs(mass(s) * s.v + s.pGas) < 1e-6 * mass(s) * s.v + 1e-9);
  }
});

test("throwing the fuel out in N portions approaches Tsiolkovsky from below", () => {
  const exact = tsiolkovsky(2500, 4000, 1000);
  let prev = 0;
  for (const n of [1, 2, 5, 20, 100, 10000]) {
    const v = burstSpeed(2500, 4000, 3000, n);
    assert.ok(v < exact && v > prev);
    prev = v;
  }
  assert.equal(burstSpeed(2500, 4000, 3000, 1), (2500 * 3000) / 4000); // one throw: m₀v... = Δm·u
  assert.ok(rel(prev, exact) < 1e-3);
});

test("with gravity: no lift-off while thrust < weight", () => {
  // thrust 5 kN < weight of the empty rocket 9,81 kN: never leaves the pad
  const stuck = fly({ gravity: true, exhaustSpeed: 500, massFlow: 10 });
  assert.equal(stuck.x, 0);
  assert.equal(stuck.v, 0);
  // thrust 250 kN > 39 kN: lifts at once and v = u·ln(m₀/m) − g·t
  const s = fly({ gravity: true });
  assert.ok(rel(s.v, formulaSpeed(s) - G * burnTime(s)) < 1e-6);
  // thrust 25 kN: waits until m·g < F, i.e. m < 2548 kg, then lifts
  const late = { ...initialState(), gravity: true, massFlow: 10, launched: true };
  while (mass(late) * G > thrust(late) + 1) stepRocket(late, 1 / 120);
  assert.equal(late.x, 0);
  while (!late.done) stepRocket(late, 1 / 120);
  assert.ok(late.x > 0 && late.v > 0);
});

test("forged time is clamped", () => {
  const s = { ...initialState(), time: -5 };
  stepRocket(s, 1 / 120);
  assert.ok(s.time > 0 && s.time < 0.01);
});
