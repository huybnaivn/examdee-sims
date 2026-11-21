import test from "node:test";
import assert from "node:assert/strict";
import { initialState, x1, x2, x, resultant, classify, deltaDeg, PERIOD } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const make = (a1, a2, phi1Deg, phi2Deg) => ({ ...initialState(), a1, a2, phi1Deg, phi2Deg });
const rad = d => (d * Math.PI) / 180;
const cases = [make(4, 3, 0, 60), make(2, 5, -45, 135), make(3, 3, 30, 150), make(1, 6, 165, -120), make(5, 2, 90, 180), make(2, 2, -180, 75)];

test("A² = A₁² + A₂² + 2A₁A₂cos(Δφ)", () => {
  for (const s of cases) {
    const d = rad(s.phi2Deg - s.phi1Deg);
    near(resultant(s).amplitude ** 2, s.a1 ** 2 + s.a2 ** 2 + 2 * s.a1 * s.a2 * Math.cos(d));
  }
});

test("tan φ = (A₁sin φ₁ + A₂sin φ₂)/(A₁cos φ₁ + A₂cos φ₂), in the right quadrant", () => {
  for (const s of cases) {
    const num = s.a1 * Math.sin(rad(s.phi1Deg)) + s.a2 * Math.sin(rad(s.phi2Deg));
    const den = s.a1 * Math.cos(rad(s.phi1Deg)) + s.a2 * Math.cos(rad(s.phi2Deg));
    const { amplitude, phase } = resultant(s);
    if (Math.abs(den) > 1e-9) near(Math.tan(phase), num / den, 1e-7);
    // the quadrant: A·cos φ and A·sin φ must reproduce both sums, sign included
    near(amplitude * Math.cos(phase), den);
    near(amplitude * Math.sin(phase), num);
  }
  // both components in the 2nd quadrant: φ must be there too, not in the 4th
  const phi = resultant(make(3, 3, 120, 150)).phase;
  assert.ok(phi > Math.PI / 2 && phi < Math.PI);
  near(phi, rad(135));
});

test("in phase gives A₁ + A₂, antiphase gives |A₁ − A₂|, quadrature gives √(A₁² + A₂²)", () => {
  const same = make(4, 3, 45, 45);
  assert.equal(classify(same), "cung-pha");
  near(resultant(same).amplitude, 7);
  near(resultant(same).phase, rad(45));

  const opposite = make(4, 3, 30, -150);
  assert.equal(classify(opposite), "nguoc-pha");
  near(resultant(opposite).amplitude, 1);
  near(resultant(opposite).phase, rad(30)); // follows the larger one

  const smallerFirst = make(2, 5, 0, 180);
  near(resultant(smallerFirst).amplitude, 3);
  near(resultant(smallerFirst).phase, Math.PI);

  const square = make(4, 3, 0, -90);
  assert.equal(classify(square), "vuong-pha");
  near(resultant(square).amplitude, 5);

  assert.equal(classify(make(4, 3, 0, 60)), "");
  assert.equal(classify(make(4, 3, -180, 180)), "cung-pha"); // 360° apart
  assert.equal(deltaDeg(make(1, 1, 150, -150)), 60);
});

test("equal amplitudes in antiphase cancel", () => {
  const s = make(3, 3, 60, -120);
  assert.equal(resultant(s).amplitude, 0);
  assert.ok(Number.isNaN(resultant(s).phase));
  for (const t of [0, 0.3, 1.7]) near(x1(s, t) + x2(s, t), 0);
  assert.equal(x(s, 0.3), 0);
});

test("the sampled sum x₁ + x₂ equals the resultant curve", () => {
  for (const s of cases) {
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 2 * PERIOD;
      near(x1(s, t) + x2(s, t), x(s, t));
    }
  }
});
