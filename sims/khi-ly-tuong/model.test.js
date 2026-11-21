import test from "node:test";
import assert from "node:assert/strict";
import { K, HEIGHT, LIMITS, initialState, pressure, boxWidth, setMode, applyChange, syncParticles, meanKinetic, step } from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} is not within ${rel} of ${b}`);
const run = (s, seconds, dt = 1 / 120) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) step(s, dt);
  return s;
};

test("p·V = N·k·T in the sim's units", () => {
  for (const [n, temperature, volume] of [[100, 300, 6], [10, 100, 2], [200, 600, 10], [37, 450, 3.3]]) {
    const s = { ...initialState(), n, temperature, volume };
    near(pressure(s) * s.volume, n * K * temperature);
    near(boxWidth(s) * HEIGHT, volume); // V is the area of the drawn box
  }
  near(initialState().lockedPressure, pressure(initialState()));
});

test("isothermal: halving V doubles p", () => {
  const s = setMode({ ...initialState(), volume: 8 }, "T");
  const before = pressure(s);
  s.volume = 4;
  applyChange(s, "volume");
  assert.equal(s.temperature, 300);
  near(pressure(s), 2 * before);
});

test("isochoric: doubling T doubles p", () => {
  const s = setMode(initialState(), "V");
  const before = pressure(s);
  s.temperature = 600;
  applyChange(s, "temperature");
  assert.equal(s.volume, 6);
  near(pressure(s), 2 * before);
});

test("isobaric: V follows T (and T follows V) at constant p, within the slider ranges", () => {
  const s = setMode({ ...initialState(), volume: 4, temperature: 200 }, "P");
  const before = pressure(s);
  s.temperature = 400;
  applyChange(s, "temperature");
  near(s.volume, 8);
  near(pressure(s), before);
  s.volume = 5;
  applyChange(s, "volume");
  near(s.temperature, 250);
  near(pressure(s), before);
  s.volume = 2; // would need T = 100 K: still allowed
  applyChange(s, "volume");
  near(pressure(s), before);
  s.temperature = 600; // would need V = 12 > max: V stops at 10 and T is pulled back to match
  applyChange(s, "temperature");
  assert.equal(s.volume, LIMITS.volume[1]);
  near(s.temperature, 500);
  near(pressure(s), before);
});

test("mean kinetic energy is proportional to T (k·T per particle in 2-D)", () => {
  const s = initialState();
  for (const temperature of [100, 300, 600]) {
    s.temperature = temperature;
    syncParticles(s);
    assert.equal(s._p.length, s.n);
    near(meanKinetic(s), K * temperature);
  }
  s.n = 40; // changing the number of particles keeps the temperature
  syncParticles(s);
  assert.equal(s._p.length, 40);
  near(meanKinetic(s), K * 600);
});

test("wall collisions are elastic and particles stay inside the box", () => {
  const s = { ...initialState(), temperature: 600, volume: 2 };
  syncParticles(s);
  const before = meanKinetic(s);
  run(s, 30);
  near(meanKinetic(s), before, 1e-12);
  for (const q of s._p) assert.ok(q.x >= 0 && q.x <= boxWidth(s) && q.y >= 0 && q.y <= HEIGHT);
  s.volume = 2; // piston pushed in from a wider box
  const wide = { ...initialState(), volume: 10 };
  run(wide, 1);
  wide.volume = 2;
  run(wide, 1);
  for (const q of wide._p) assert.ok(q.x >= 0 && q.x <= 1);
});

test("pressure measured from wall collisions agrees with the gas law", () => {
  for (const [n, temperature, volume] of [[200, 300, 6], [200, 600, 3], [150, 150, 10]]) {
    const s = run({ ...initialState(), n, temperature, volume }, 40);
    near(s.measuredPressure, pressure(s), 0.1);
  }
});
