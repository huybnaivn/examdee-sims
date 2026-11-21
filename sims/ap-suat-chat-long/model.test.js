import test from "node:test";
import assert from "node:assert/strict";
import {
  P0, TANK_DEPTH, BRANCHES, BRANCH_H, PIPE, MIN_VOLUME, MAX_VOLUME, initialState, specificWeight, gaugePressure, pressure,
  branchVolume, vesselVolume, vesselLevel, readingDepth,
} from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);
const make = over => ({ ...initialState(), ...over });

test("p = ρ·g·h = d·h", () => {
  near(gaugePressure(make({ density: 1000, gravity: 10, depth: 1.2 })), 12000);
  near(gaugePressure(make({ density: 800, gravity: 9.81, depth: 0.5 })), 800 * 9.81 * 0.5);
  near(gaugePressure(make({ density: 13600, gravity: 9.81, depth: 0.76 })), 101396.16); // a 76 cm mercury column ≈ 1 atm
  for (const density of [500, 1000, 2000]) {
    for (const gravity of [1.62, 9.81, 10, 24.79]) {
      const s = make({ density, gravity, depth: 1.35 });
      near(specificWeight(s), density * gravity);
      near(gaugePressure(s), specificWeight(s) * 1.35);
    }
  }
  assert.equal(gaugePressure(make({ depth: 0 })), 0); // nothing at the free surface
});

test("pressure is linear in depth", () => {
  const s = make({ density: 1030, gravity: 9.81 });
  const slope = gaugePressure(s, 1) - gaugePressure(s, 0);
  for (let h = 0; h <= TANK_DEPTH; h += 0.05) {
    near(gaugePressure(s, h), slope * h);
    near(gaugePressure(s, h + 0.1) - gaugePressure(s, h), slope * 0.1, 1e-6); // equal steps, equal rises
  }
  near(gaugePressure(s, 2 * 0.7), 2 * gaugePressure(s, 0.7));
});

test("pressure does not depend on the horizontal position", () => {
  for (const atmosphere of [false, true]) {
    const left = make({ probeX: 0, atmosphere });
    for (let x = 0; x <= 1; x += 0.05) {
      assert.equal(pressure({ ...left, probeX: x }), pressure(left));
      assert.equal(gaugePressure({ ...left, probeX: x }), gaugePressure(left));
    }
  }
});

test("doubling the density doubles the liquid pressure; so does doubling g", () => {
  const s = make({ density: 700, depth: 1.5 });
  near(gaugePressure({ ...s, density: 1400 }), 2 * gaugePressure(s));
  near(gaugePressure({ ...s, gravity: 2 * s.gravity }), 2 * gaugePressure(s));
});

test("the atmosphere adds p₀ at every depth", () => {
  for (let h = 0; h <= TANK_DEPTH; h += 0.25) {
    const s = make({ depth: h });
    assert.equal(pressure(s), gaugePressure(s));
    near(pressure({ ...s, atmosphere: true }) - gaugePressure(s), P0);
  }
  assert.equal(pressure(make({ depth: 0, atmosphere: true })), P0);
  near(pressure(make({ depth: 1.2, atmosphere: true })), 113325);
});

test("communicating vessels: one level holds the whole volume, whatever the shapes", () => {
  for (let volume = MIN_VOLUME; volume <= MAX_VOLUME; volume += 0.5) {
    const h = vesselLevel(volume);
    assert.ok(h > 0 && h < BRANCH_H);
    near(vesselVolume(h), volume, 1e-9);
    // the branches hold very different amounts at that common level
    const parts = BRANCHES.map(b => branchVolume(b, h));
    near(parts.reduce((a, b) => a + b, 0) + (PIPE.x1 - PIPE.x0) * PIPE.h, volume, 1e-9);
    assert.ok(parts[0] > 3 * parts[1]);
  }
  assert.ok(vesselLevel(20) > vesselLevel(10)); // more liquid, higher level
  near(branchVolume({ w0: 0.6, k: 0.4 }, 5), 0.6 * 5 + (0.4 * 25) / 2); // trapezium area
});

test("communicating vessels: the pressure at the bottom follows the common level", () => {
  const s = make({ mode: "vessels", volume: 16 });
  near(readingDepth(s), (vesselLevel(16) + PIPE.h) / 10);
  near(pressure(s, readingDepth(s)), s.density * s.gravity * readingDepth(s));
  assert.equal(readingDepth(make({ depth: 0.4 })), 0.4);
});
