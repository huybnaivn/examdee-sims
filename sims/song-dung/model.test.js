import test from "node:test";
import assert from "node:assert/strict";
import {
  L, MU, N, initialState, settled, rest, step, waveSpeed, wavelength, resonantFrequency,
  nearestHarmonic, harmonicNumber, nodePositions, antinodePositions, envelope,
} from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const base = initialState();
const make = over => rest({ ...base, ...over });

/** Run `seconds`, then return the largest |y| at every grid point over one more period. */
function settle(s, seconds) {
  const dt = 1 / 120;
  for (let i = 0; i < seconds / dt; i++) step(s, dt);
  const peak = new Float64Array(N + 1);
  for (let i = 0; i < 1 / s.frequency / dt + 1; i++) {
    step(s, dt);
    for (let j = 0; j <= N; j++) peak[j] = Math.max(peak[j], Math.abs(s._y[j]));
  }
  return peak;
}
const at = x => Math.round((x / L) * N);

test("v = √(T/μ) and λ = v/f", () => {
  for (const T of [0.2, 0.8, 1.8, 5]) {
    const s = make({ tension: T, frequency: 1.25 });
    close(waveSpeed(s), Math.sqrt(T / MU));
    close(wavelength(s), Math.sqrt(T / MU) / 1.25);
  }
  close(waveSpeed(make({ tension: 0.8 })), 2);
  close(wavelength(make({ tension: 0.8, frequency: 1.5 })), 4 / 3);
});

test("a pulse travels along the string at v", () => {
  const s = make({ tension: 1.8, damping: 0, frequency: 2 }); // v = 3 m/s
  for (let i = 0; i < 60; i++) step(s, 1 / 120); // 0.5 s -> front at 1.5 m
  assert.ok(Math.abs(s._y[at(1.3)]) > 0.2);
  assert.ok(Math.abs(s._y[at(1.7)]) < 0.02);
});

test("resonant frequencies: n·v/(2L) fixed end, (2n−1)·v/(4L) free end", () => {
  const fixed = make({ tension: 0.8 }); // v = 2 m/s, L = 2 m
  const free = make({ tension: 0.8, endType: "free" });
  for (let n = 1; n <= 8; n++) {
    close(resonantFrequency(fixed, n), (n * 2) / (2 * L));
    close(resonantFrequency(free, n), ((2 * n - 1) * 2) / (4 * L));
    assert.equal(harmonicNumber({ ...fixed, frequency: resonantFrequency(fixed, n) }), n);
    assert.equal(harmonicNumber({ ...free, frequency: resonantFrequency(free, n) }), n);
    // at resonance the string holds a whole number of half (or odd quarter) wavelengths
    close(L / (wavelength({ ...fixed, frequency: resonantFrequency(fixed, n) }) / 2), n);
    close(L / (wavelength({ ...free, frequency: resonantFrequency(free, n) }) / 4), 2 * n - 1);
  }
  assert.equal(harmonicNumber({ ...fixed, frequency: 1.25 }), 0);
  assert.equal(harmonicNumber({ ...free, frequency: 1.5 }), 0);
  assert.equal(nearestHarmonic({ ...fixed, frequency: 1.3 }), 3);
  assert.equal(nearestHarmonic({ ...free, frequency: 0.1 }), 1);
});

test("node and antinode positions", () => {
  assert.deepEqual(nodePositions("fixed", 1), [0, 2]);
  nodePositions("fixed", 3).forEach((x, j) => close(x, (j * L) / 3));
  antinodePositions("fixed", 3).forEach((x, j) => close(x, ((2 * j + 1) * L) / 6));
  nodePositions("free", 2).forEach((x, j) => close(x, [0, 4 / 3][j]));
  antinodePositions("free", 2).forEach((x, j) => close(x, [2 / 3, 2][j]));
  for (const type of ["fixed", "free"]) {
    for (let n = 1; n <= 6; n++) {
      const lambda = wavelength({ tension: 0.8, frequency: resonantFrequency({ tension: 0.8, endType: type }, n) });
      const nodes = nodePositions(type, n);
      const anti = antinodePositions(type, n);
      assert.equal(anti.length, n);
      assert.equal(nodes.length, type === "free" ? n : n + 1);
      for (let j = 1; j < nodes.length; j++) close(nodes[j] - nodes[j - 1], lambda / 2); // neighbours are λ/2 apart
      anti.forEach((x, j) => close(x - nodes[j], lambda / 4)); // antinode is λ/4 from a node
      close(type === "free" ? anti.at(-1) : nodes.at(-1), L); // free end: antinode, fixed end: node
    }
  }
});

test("simulated standing wave: nodes still, antinodes large, matches the steady-state envelope", () => {
  for (const type of ["fixed", "free"]) {
    const s = make({ endType: type, damping: 0.4 });
    s.frequency = resonantFrequency(s, 3);
    const peak = settle(s, 40);
    const anti = antinodePositions(type, 3).map(x => peak[at(x)]);
    const nodes = nodePositions(type, 3).slice(1).map(x => peak[at(x)]);
    assert.ok(Math.min(...anti) > 3 * s.amplitude, "resonance amplifies");
    assert.ok(Math.max(...nodes) < 0.3 * Math.min(...anti), "nodes barely move");
    for (let j = 0; j <= N; j += 20) {
      const expected = envelope(s, (j * L) / N);
      assert.ok(Math.abs(peak[j] - expected) < 0.03 * expected + 0.05, `${type} x=${j}: ${peak[j]} vs ${expected}`);
    }
  }
});

test("off resonance the amplitude stays small; more damping lowers the resonance peak", () => {
  const off = make({ frequency: 1.25 });
  assert.ok(Math.max(...settle(off, 40)) < 1.6 * off.amplitude);
  const peakAt = damping => Math.max(...Array.from({ length: N + 1 }, (_, j) => envelope(make({ damping }), (j * L) / N)));
  assert.ok(peakAt(0.2) > peakAt(0.4) && peakAt(0.4) > peakAt(1.5));
  close(envelope(make({}), 0), 2, 1e-9); // the source end moves with the source amplitude
  close(envelope(make({}), L), 0, 1e-9); // the fixed end does not move
});

test("initial state shows a built-up third harmonic", () => {
  const s = initialState();
  assert.equal(harmonicNumber(s), 3);
  const peak = settle(s, 0);
  assert.ok(Math.abs(peak[at(L / 6)] - envelope(s, L / 6)) < 0.05 * envelope(s, L / 6));
});

test("restored state is clamped and already settled on its own pattern", () => {
  const s = settled({ endType: "free", frequency: 1.25, tension: 0.8, damping: 99, amplitude: "x", junk: 1 });
  assert.equal(s.damping, 2);
  assert.equal(s.amplitude, 2);
  assert.equal(s.junk, undefined);
  assert.equal(harmonicNumber(s), 3);
  const peak = settle(s, 0);
  for (const x of [0.4, 1.2, 2]) assert.ok(Math.abs(peak[at(x)] - envelope(s, x)) < 0.05 * envelope(s, x));
});

test("sharpest case (16th harmonic, least damping) still reaches the predicted amplitude", () => {
  const s = settled({ frequency: 4, tension: 0.2, damping: 0.1, amplitude: 5 });
  assert.equal(harmonicNumber(s), 16);
  const peak = settle(s, 20);
  const x = antinodePositions("fixed", 16)[8];
  assert.ok(Math.abs(peak[at(x)] - envelope(s, x)) < 0.08 * envelope(s, x), `${peak[at(x)]} vs ${envelope(s, x)}`);
});
