import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, VIOLET, RED, TOLERANCE, measuring, isWhite, activeWavelength, gratingPeriod, aperture, orderAngle, maxOrder,
  slitMinimumAngle, slitIntensity, screenPosition, smallAnglePosition, centralWidth, angleOf, wavelengthFrom, answerOk, newSource,
} from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const deg = rad => (rad * 180) / Math.PI;

test("grating period from lines per mm", () => {
  near(gratingPeriod(500), 2000); // 1/500 mm = 2 μm
  near(gratingPeriod(250), 4000);
  near(aperture(initialState()), 4000);
  near(aperture({ ...initialState(), mode: "slit", slitWidth: 2.5 }), 2500);
});

test("grating equation d·sinθ = k·λ", () => {
  const d = gratingPeriod(500);
  near(deg(orderAngle(1, 500, d)), deg(Math.asin(0.25)));
  near(deg(orderAngle(2, 500, d)), 30);
  near(deg(orderAngle(4, 500, d)), 90);
  assert.equal(orderAngle(0, 500, d), 0);
  near(orderAngle(-2, 500, d), -orderAngle(2, 500, d));
  assert.equal(orderAngle(5, 500, d), null); // sinθ would exceed 1
  for (const k of [1, 2, 3]) near(d * Math.sin(orderAngle(k, 600, d)), k * 600, 1e-6);
});

test("maximum order is ⌊d/λ⌋", () => {
  assert.equal(maxOrder(500, 2000), 4);
  assert.equal(maxOrder(550, 4000), 7);
  assert.equal(maxOrder(760, 1e6 / 600), 2);
  assert.equal(maxOrder(700, 600), 0); // period shorter than the wavelength: only the central maximum
  for (const [lam, d] of [[380, 10000], [655, 3333.3], [760, 1666.7]]) {
    const k = maxOrder(lam, d);
    assert.notEqual(orderAngle(k, lam, d), null);
    assert.equal(orderAngle(k + 1, lam, d), null);
  }
});

test("single slit: first minimum at a·sinθ = λ, no minimum for k = 0", () => {
  near(deg(slitMinimumAngle(1, 500, 1000)), 30);
  near(Math.sin(slitMinimumAngle(2, 600, 4000)), 0.3);
  assert.equal(slitMinimumAngle(0, 500, 1000), null);
  assert.equal(slitMinimumAngle(1, 700, 500), null);
  // the intensity really vanishes there, and is greatest at the centre
  near(slitIntensity(Math.sin(slitMinimumAngle(1, 550, 4000)), 550, 4000), 0, 1e-12);
  near(slitIntensity(Math.sin(slitMinimumAngle(3, 550, 4000)), 550, 4000), 0, 1e-12);
  assert.equal(slitIntensity(0, 550, 4000), 1);
  // first secondary maximum is about 4,7 % of the central one
  near(slitIntensity((1.4303 * 550) / 4000, 550, 4000), 0.0472, 5e-4);
});

test("red deviates more than violet in every order", () => {
  for (const lines of [100, 250, 600]) {
    const d = gratingPeriod(lines);
    for (let k = 1; k <= maxOrder(RED, d); k++) {
      assert.ok(orderAngle(k, RED, d) > orderAngle(k, VIOLET, d));
      assert.ok(screenPosition(orderAngle(k, RED, d)) > screenPosition(orderAngle(k, VIOLET, d)));
    }
    assert.equal(orderAngle(0, RED, d), orderAngle(0, VIOLET, d)); // the central maximum stays white
  }
});

test("a narrower slit gives a wider central maximum", () => {
  assert.ok(centralWidth(550, 2000) > centralWidth(550, 4000));
  assert.ok(centralWidth(550, 4000) > centralWidth(550, 8000));
  near(centralWidth(550, 4000), 2 * Math.tan(Math.asin(0.1375)));
  // for small angles the width is 2λL/a: halving the slit doubles it
  near(centralWidth(500, 50000) / centralWidth(500, 100000), 2, 1e-4);
  near(centralWidth(500, 100000, 2), (2 * 500 * 2) / 100000, 1e-6);
  assert.ok(centralWidth(760, 4000) > centralWidth(380, 4000)); // and it widens with the wavelength
  assert.equal(centralWidth(700, 600), Infinity);
});

test("screen positions: x = L·tanθ, about k·λ·L/d for small angles", () => {
  near(screenPosition(Math.PI / 4, 1), 1);
  near(screenPosition(orderAngle(1, 550, 4000)), Math.tan(Math.asin(0.1375)));
  near(smallAnglePosition(1, 500, 100000, 2), 0.01);
  for (const k of [1, 2, 3]) {
    const exact = screenPosition(orderAngle(k, 500, 100000), 2);
    near(exact / smallAnglePosition(k, 500, 100000, 2), 1, 2e-4); // equally spaced when θ is small
  }
  // at large angles the approximation falls short
  assert.ok(screenPosition(orderAngle(3, 550, 4000)) > 1.09 * smallAnglePosition(3, 550, 4000));
});

test("measuring: angle of the cursor gives back the wavelength", () => {
  const d = gratingPeriod(300);
  for (const lam of [405, 532, 635]) {
    for (const k of [1, 2]) near(wavelengthFrom(angleOf(screenPosition(orderAngle(k, lam, d))), d, k), lam, 1e-6);
    near(wavelengthFrom(-orderAngle(1, lam, d), d), lam, 1e-6);
  }
  const s = { ...initialState(), task: "measure", unknown: 635 };
  assert.equal(answerOk({ ...s, answer: 635 }), true);
  assert.equal(answerOk({ ...s, answer: 635 + TOLERANCE }), true);
  assert.equal(answerOk({ ...s, answer: 620 }), false);
});

test("the hidden source replaces the slider wavelength only while measuring", () => {
  const s = { ...initialState(), wavelength: 450, unknown: 600, source: "white" };
  assert.equal(activeWavelength(s), 450);
  assert.equal(isWhite(s), true);
  const m = { ...s, task: "measure" };
  assert.equal(measuring(m), true);
  assert.equal(activeWavelength(m), 600);
  assert.equal(isWhite(m), false);
  assert.equal(activeWavelength({ ...m, unknown: -5 }), VIOLET); // forged values stay visible light
  assert.equal(activeWavelength({ ...m, unknown: 1e9 }), RED);
  assert.equal(activeWavelength({ ...m, unknown: "x" }), VIOLET);
});

test("new sources are multiples of 5 nm between 400 and 700 nm", () => {
  for (const r of [0, 0.3, 0.5, 0.99999]) {
    const s = newSource({ ...initialState(), feedback: "wrong" }, () => r);
    assert.ok(s.unknown >= 400 && s.unknown <= 700 && s.unknown % 5 === 0);
    assert.equal(s.feedback, "");
  }
});
