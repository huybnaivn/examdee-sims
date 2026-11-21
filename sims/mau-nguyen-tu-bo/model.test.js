import test from "node:test";
import assert from "node:assert/strict";
import { initialState, energy, radius, photonEnergy, wavelength, series, region, direction, transition, R0, N_MAX } from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("E_n = −13,6/n² eV", () => {
  close(energy(1), -13.6);
  close(energy(2), -3.4);
  close(energy(3), -1.5111, 1e-4);
  for (let n = 1; n <= N_MAX; n++) close(energy(n), -13.6 / n ** 2);
  for (let n = 2; n <= N_MAX; n++) assert.ok(energy(n) > energy(n - 1));
});

test("r_n = n²·r₀", () => {
  close(radius(1), 5.3e-11, 1e-20);
  close(radius(2), 4 * R0, 1e-20);
  for (let n = 1; n <= N_MAX; n++) close(radius(n) / R0, n * n);
});

test("photon energy = |E_m − E_n|, the same for emission and absorption", () => {
  for (let m = 1; m <= N_MAX; m++)
    for (let n = 1; n <= N_MAX; n++) {
      close(photonEnergy(m, n), Math.abs(energy(m) - energy(n)));
      close(photonEnergy(m, n), photonEnergy(n, m));
    }
  close(photonEnergy(2, 1), 10.2);
  close(photonEnergy(1, 1), 0);
});

test("λ = hc/ΔE: the four visible Balmer lines are near 656, 486, 434, 410 nm", () => {
  const expected = { 3: 656, 4: 486, 5: 434, 6: 410 };
  for (const [m, nm] of Object.entries(expected)) {
    close(wavelength(Number(m), 2), nm, 1);
    assert.equal(region(wavelength(Number(m), 2)), "visible");
  }
  close(wavelength(2, 1), 121.6, 0.2); // Lyman α
  close(wavelength(4, 3), 1875, 2); // Paschen α
  for (let m = 1; m <= N_MAX; m++)
    for (let n = 1; n < m; n++) close(wavelength(m, n) * photonEnergy(m, n), 1239.842);
});

test("series classification by the lower level, and its spectral region", () => {
  for (let m = 2; m <= N_MAX; m++) {
    assert.equal(series(m, 1), "Lai-man");
    assert.equal(region(wavelength(m, 1)), "uv");
  }
  for (let m = 3; m <= N_MAX; m++) assert.equal(series(m, 2), "Ban-me");
  for (let m = 4; m <= N_MAX; m++) {
    assert.equal(series(m, 3), "Pa-sen");
    assert.equal(region(wavelength(m, 3)), "ir");
  }
  assert.equal(series(1, 3), "Lai-man"); // absorption belongs to the same series
  assert.equal(series(6, 4), null);
  assert.equal(series(6, 5), null);
});

test("emission when going down, absorption when going up", () => {
  assert.equal(direction(3, 2), 1);
  assert.equal(direction(2, 3), -1);
  assert.equal(direction(4, 4), 0);
  assert.equal(transition(5, 2).direction, 1);
  assert.equal(transition(1, 6).direction, -1);
});

test("transition(): initial state is Hα; no photon for equal levels; forged levels are clamped", () => {
  const s = initialState();
  const t = transition(s.from, s.to);
  assert.deepEqual([t.from, t.to, t.series, t.region], [3, 2, "Ban-me", "visible"]);
  close(t.energy, 1.8889, 1e-4);
  close(t.wavelength, 656.4, 0.2);
  assert.equal(transition(2, 2).wavelength, null);
  assert.deepEqual([transition(99, -4).from, transition(99, -4).to], [6, 1]);
});
