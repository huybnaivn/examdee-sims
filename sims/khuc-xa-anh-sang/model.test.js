import test from "node:test";
import assert from "node:assert/strict";
import { MEDIA, mediumOf, initialState, reflectionAngle, refractionAngle, criticalAngle, reflectance } from "./model.js";

const sin = d => Math.sin((d * Math.PI) / 180);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("n1·sin i = n2·sin r", () => {
  for (const [n1, n2] of [[1, 1.33], [1, 1.5], [1.33, 1], [1.5, 1.33], [1, 2.42], [2.42, 1]]) {
    for (let i = 0; i <= 89; i += 0.5) {
      const r = refractionAngle(n1, n2, i);
      if (r !== null) close(n1 * sin(i), n2 * sin(r));
    }
  }
  close(refractionAngle(1, 1.33, 45), 32.1176, 1e-3); // textbook value for air -> water
});

test("angle of reflection equals angle of incidence", () => {
  for (let i = 0; i <= 89; i += 1) assert.equal(reflectionAngle(i), i);
});

test("critical angle is asin(n2/n1), with no refracted ray beyond it", () => {
  close(criticalAngle(1.33, 1), 48.7535, 1e-3);
  close(criticalAngle(1.5, 1), 41.8103, 1e-3);
  close(sin(criticalAngle(2.42, 1.33)), 1.33 / 2.42);
  for (const [n1, n2] of [[1.33, 1], [1.5, 1], [2.42, 1], [1.5, 1.33]]) {
    const c = criticalAngle(n1, n2);
    close(refractionAngle(n1, n2, c), 90, 1e-5);
    assert.notEqual(refractionAngle(n1, n2, c - 0.01), null);
    assert.equal(refractionAngle(n1, n2, c + 0.01), null);
    assert.equal(refractionAngle(n1, n2, 89), null);
    assert.equal(reflectance(n1, n2, c + 0.01), 1);
  }
  // going into a denser (or equal) medium there is never total internal reflection
  assert.equal(criticalAngle(1, 1.33), null);
  assert.equal(criticalAngle(1.5, 1.5), null);
  for (let i = 0; i <= 89; i += 1) assert.notEqual(refractionAngle(1, 1.33, i), null);
});

test("no bending and no reflection when n1 = n2", () => {
  for (const n of [1, 1.33, 2.42]) {
    for (let i = 0; i <= 89; i += 1) {
      close(refractionAngle(n, n, i), i, 1e-9);
      close(reflectance(n, n, i), 0, 1e-12);
    }
  }
});

test("reflected fraction: ((n1-n2)/(n1+n2))² at normal incidence, within 0..1 elsewhere", () => {
  close(reflectance(1, 1.5, 0), 0.04);
  close(reflectance(1.5, 1, 0), 0.04);
  for (let i = 0; i <= 89; i += 1) {
    const R = reflectance(1, 1.33, i);
    assert.ok(R >= 0 && R <= 1);
  }
});

test("presets", () => {
  const s = initialState();
  assert.equal(mediumOf(s.n1), s.medium1);
  assert.equal(mediumOf(s.n2), s.medium2);
  assert.equal(mediumOf(1.7), "custom");
  for (const m of MEDIA) assert.equal(mediumOf(m.n), m.value);
});
