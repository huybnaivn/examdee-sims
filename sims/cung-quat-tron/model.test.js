import test from "node:test";
import assert from "node:assert/strict";
import { initialState, toRadians, arcLength, sectorArea, ringArea, measure, target, nextChallenge, sameArea, dragAngle, TARGETS, R_MIN, R_MAX, R_STEP } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

test("arc length l = πRn/180", () => {
  near(arcLength(5, 60), (5 * Math.PI) / 3);
  near(arcLength(2, 90), Math.PI);
  assert.equal(arcLength(7, 0), 0);
  near(arcLength(3, 80) + arcLength(3, 40), arcLength(3, 120)); // proportional to the arc
});

test("sector area S = πR²n/360", () => {
  near(sectorArea(6, 60), 6 * Math.PI);
  near(sectorArea(2, 90), Math.PI);
  near(sectorArea(4, 45), 2 * Math.PI);
  assert.equal(sectorArea(7, 0), 0);
});

test("a full turn gives the circumference 2πR and the disc area πR²", () => {
  for (const R of [1, 2.5, 10]) {
    near(arcLength(R, 360), 2 * Math.PI * R);
    near(sectorArea(R, 360), Math.PI * R * R);
    const m = measure({ ...initialState(), R, angle: 360 });
    near(m.arc, m.circumference);
    near(m.sector, m.disc);
  }
  near(arcLength(4, 180), Math.PI * 4); // semicircle
  near(sectorArea(4, 180), 8 * Math.PI);
});

test("S = l·R/2 for every radius and angle", () => {
  for (let R = R_MIN; R <= R_MAX; R += R_STEP) {
    for (let n = 0; n <= 360; n += 7) near(sectorArea(R, n), (arcLength(R, n) * R) / 2);
  }
});

test("ring area S = π(R² − r²) = big disc − small disc", () => {
  near(ringArea(5, 3), 16 * Math.PI);
  near(ringArea(5, 2), sectorArea(5, 360) - sectorArea(2, 360));
  const m = measure({ ...initialState(), mode: "ring", R: 5, r: 2 });
  near(m.ring, 21 * Math.PI);
});

test("degrees to radians, and l = R·α with α in radians", () => {
  near(toRadians(180), Math.PI);
  near(toRadians(90), Math.PI / 2);
  near(toRadians(60), Math.PI / 3);
  near(toRadians(360), 2 * Math.PI);
  near(arcLength(3, 75), 3 * toRadians(75));
});

test("the initial picture: R = 5 cm, 60°", () => {
  const m = measure(initialState());
  near(m.arc, 5.235987755982989);
  near(m.sector, 13.089969389957473);
  assert.equal(m.target, null);
  assert.equal(m.hit, false);
});

test("forged values are clamped; the hole stays inside the disc", () => {
  const m = measure({ R: 1e9, r: 1e9, angle: -50 });
  assert.equal(m.R, R_MAX);
  assert.equal(m.r, R_MAX - R_STEP);
  assert.equal(m.n, 0);
  assert.ok(measure({ R: 1, r: 9, angle: 10 }).ring > 0);
  assert.equal(measure({ R: NaN, r: NaN, angle: NaN }).R, R_MIN);
  assert.equal(target({ challenge: -3 }), null);
  assert.equal(target({ challenge: NaN }), null);
});

test("every challenge area can be made with the sliders, and is detected", () => {
  TARGETS.forEach((k, i) => {
    let found = null;
    for (let R = R_MIN; R <= R_MAX && !found; R += R_STEP) {
      for (let n = 1; n <= 360; n++) if (Math.abs(R * R * n - 360 * k) < 1e-9) found = { R, angle: n };
    }
    assert.ok(found, `${k}π cm² is not reachable`);
    const m = measure({ ...initialState(), ...found, challenge: i + 1 });
    near(m.target, k * Math.PI);
    assert.ok(m.hit);
    assert.ok(!measure({ ...initialState(), ...found, angle: found.angle - 3, challenge: i + 1 }).hit);
  });
  assert.equal(target({ challenge: TARGETS.length + 1 }), TARGETS[0] * Math.PI); // the list repeats
});

test("a new challenge never asks for the area already on screen", () => {
  assert.equal(nextChallenge(initialState()), 1);
  const s = { ...initialState(), R: 3, angle: 120 }; // already 3π, the first target
  assert.equal(nextChallenge(s), 2);
  assert.equal(nextChallenge({ ...initialState(), challenge: 4 }), 5);
  assert.ok(sameArea(9.4248, 9.4211) && !sameArea(9.42, 9.43));
});

test("dragging B: follows the pointer and stops at 0° and 360° instead of jumping", () => {
  assert.equal(dragAngle(100, 133.4), 133);
  assert.equal(dragAngle(100, -90), 270);
  assert.equal(dragAngle(350, 5), 360);
  assert.equal(dragAngle(360, 20), 360);
  assert.equal(dragAngle(10, 355), 0);
  assert.equal(dragAngle(0, 300), 0);
  assert.equal(dragAngle(0, 30), 30);
  assert.equal(dragAngle(360, 300), 300);
});
