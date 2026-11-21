import test from "node:test";
import assert from "node:assert/strict";
import {
  MEDIA, I0, initialState, frequency, speed, wavelength, intensity, intensityOf, levelOf, level,
  soundClass, displacement, pressure,
} from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const make = over => ({ ...initialState(), ...over });

test("λ = v/f in each medium", () => {
  assert.deepEqual(Object.values(MEDIA).map(m => m.speed), [340, 1500, 6000]);
  close(wavelength(make({ logFrequency: 3, medium: "air" })), 0.34);
  close(wavelength(make({ logFrequency: 3, medium: "water" })), 1.5);
  close(wavelength(make({ logFrequency: 3, medium: "steel" })), 6);
  for (const logFrequency of [0.5, 1.2, 2.64, 4.3, 5]) {
    for (const medium of Object.keys(MEDIA)) {
      const s = make({ logFrequency, medium });
      close(wavelength(s) * frequency(s), speed(s), 1e-9);
    }
  }
  assert.equal(speed(make({ medium: "nonsense" })), 340);
});

test("slider frequency is rounded to 2 significant figures and reaches the boundaries", () => {
  assert.equal(frequency(make({ logFrequency: 3 })), 1000);
  assert.equal(frequency(make({ logFrequency: 1.2 })), 16);
  assert.equal(frequency(make({ logFrequency: 4.3 })), 20000);
  assert.equal(frequency(make({ logFrequency: 0.5 })), 3.2);
  assert.equal(frequency(make({ logFrequency: 5 })), 100000);
});

test("intensity grows as amplitude squared", () => {
  close(intensityOf(1), 1e-6, 1e-18);
  for (const a of [0.1, 0.7, 3, 10]) close(intensityOf(2 * a) / intensityOf(a), 4, 1e-12);
  close(intensity(make({ amplitude: 5 })), 25e-6, 1e-15);
});

test("L = 10·log₁₀(I/I₀): reference, ×2 adds ≈ 3 dB, ×10 adds 10 dB", () => {
  close(levelOf(I0), 0);
  close(levelOf(1e-6), 60, 1e-9);
  close(levelOf(1), 120, 1e-9);
  for (const I of [1e-11, 3e-7, 1e-4, 0.5]) {
    close(levelOf(2 * I) - levelOf(I), 3.0103, 1e-4);
    close(levelOf(10 * I) - levelOf(I), 10, 1e-9);
  }
  // doubling the amplitude quadruples I: +6 dB
  close(level(make({ amplitude: 4 })) - level(make({ amplitude: 2 })), 6.0206, 1e-4);
  close(level(make({ amplitude: 1 })), 60, 1e-9);
  close(level(make({ amplitude: 10 })), 80, 1e-9);
});

test("classification boundaries at 16 Hz and 20 kHz", () => {
  assert.equal(soundClass(15.9), 0);
  assert.equal(soundClass(16), 1);
  assert.equal(soundClass(1000), 1);
  assert.equal(soundClass(20000), 1);
  assert.equal(soundClass(20001), 2);
  assert.equal(soundClass(frequency(make({ logFrequency: 1.19 }))), 0); // 15 Hz
  assert.equal(soundClass(frequency(make({ logFrequency: 4.32 }))), 2); // 21 000 Hz
});

test("pressure is highest where particles are compressed, and repeats every wavelength", () => {
  for (const phase of [0, 0.7, 2]) {
    for (const x of [0, 0.13, 0.5, 0.81]) {
      const h = 1e-6;
      // p ∝ −∂ξ/∂x, with x in wavelengths
      close(pressure(x, phase), -(displacement(x + h, phase) - displacement(x - h, phase)) / (2 * h) / (2 * Math.PI), 1e-6);
      close(pressure(x + 1, phase), pressure(x, phase), 1e-9);
      close(displacement(x + 1, phase), displacement(x, phase), 1e-9);
    }
  }
});
