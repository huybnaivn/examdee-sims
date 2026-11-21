import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, phase, position, velocity, acceleration, period, vMax, aMax, piFrac } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const cases = [
  { amplitude: 5, omega: 2, phaseDeg: 30 },
  { amplitude: 8, omega: 0.5, phaseDeg: -135 },
  { amplitude: 1, omega: 6, phaseDeg: 180 },
].map(c => ({ ...initialState(), ...c }));

test("x = A·cos(ωt + φ), v = −Aω·sin(ωt + φ), a = −ω²·x", () => {
  for (const s of cases) {
    const phi = (s.phaseDeg * Math.PI) / 180;
    for (const t of [0, 0.37, 1.9, 12.5]) {
      near(position(s, t), s.amplitude * Math.cos(s.omega * t + phi));
      near(velocity(s, t), -s.amplitude * s.omega * Math.sin(s.omega * t + phi));
      near(acceleration(s, t), -s.omega * s.omega * position(s, t));
    }
  }
});

test("v and a are the time derivatives of x and v", () => {
  const h = 1e-5;
  for (const s of cases) {
    for (const t of [0.2, 1.1, 4.4]) {
      near((position(s, t + h) - position(s, t - h)) / (2 * h), velocity(s, t), 1e-6);
      near((velocity(s, t + h) - velocity(s, t - h)) / (2 * h), acceleration(s, t), 1e-6);
    }
  }
});

test("v_max = Aω and a_max = Aω² are the largest values over a period", () => {
  for (const s of cases) {
    let v = 0;
    let a = 0;
    const T = period(s);
    for (let i = 0; i <= 20000; i++) {
      v = Math.max(v, Math.abs(velocity(s, (i / 20000) * T)));
      a = Math.max(a, Math.abs(acceleration(s, (i / 20000) * T)));
    }
    near(v, vMax(s), 1e-6);
    near(a, aMax(s), 1e-6);
    near(vMax(s), s.amplitude * s.omega);
    near(aMax(s), s.amplitude * s.omega ** 2);
  }
});

test("T = 2π/ω and the motion repeats after T", () => {
  for (const s of cases) {
    near(period(s), (2 * Math.PI) / s.omega);
    near(position(s, 0.7 + period(s)), position(s, 0.7));
    near(velocity(s, 0.7 + period(s)), velocity(s, 0.7));
  }
});

test("v leads x by π/2, a is in antiphase with x", () => {
  for (const s of cases) {
    const T = period(s);
    for (const t of [0, 0.3, 2.2]) {
      // v/v_max now equals x/A a quarter period later
      near(velocity(s, t) / vMax(s), position(s, t + T / 4) / s.amplitude);
      near(velocity(s, t) / vMax(s), Math.cos(phase(s, t) + Math.PI / 2));
      near(acceleration(s, t) / aMax(s), -position(s, t) / s.amplitude);
    }
  }
});

test("step reports the completed period exactly once", () => {
  const s = initialState();
  let hits = 0;
  let at = 0;
  for (let i = 0; i < 120 * 12; i++) {
    if (step(s, 1 / 120)) {
      hits++;
      at = s.time;
    }
  }
  assert.equal(hits, 1);
  assert.ok(Math.abs(at - period(s)) <= 1 / 120);
});

test("piFrac writes angles as fractions of π", () => {
  assert.equal(piFrac(0), "0");
  assert.equal(piFrac(180), "π");
  assert.equal(piFrac(60), "π/3");
  assert.equal(piFrac(-90), "−π/2");
  assert.equal(piFrac(75), "5π/12");
  assert.equal(piFrac(-120), "−2π/3");
});
