import test from "node:test";
import assert from "node:assert/strict";
import {
  C, H, E, F_MIN, F_MAX, REGIONS, initialState, frequency, wavelength, energyJ, energyEV, setLogF,
  fromWavelength, fromEnergy, regionIndex, visibleColor, compareObject, sci, lengthText, energyText,
} from "./model.js";

const at = logF => {
  const s = initialState();
  setLogF(s, logF);
  return s;
};
const rel = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.abs(b), `${a} vs ${b}`);

test("c = λf and ε = hf, in J and eV", () => {
  for (let lf = F_MIN; lf <= F_MAX; lf += 0.37) {
    const s = at(lf);
    rel(wavelength(s) * frequency(s), C);
    rel(energyJ(s), H * frequency(s));
    rel(energyEV(s) * E, energyJ(s));
  }
  // textbook example: λ = 0,5 µm → f = 6·10¹⁴ Hz, ε ≈ 3,98·10⁻¹⁹ J ≈ 2,48 eV
  const s = initialState();
  fromWavelength(s, Math.log10(0.5e-6));
  rel(frequency(s), 6e14);
  rel(energyJ(s), 3.9756e-19, 1e-9);
  rel(energyEV(s), 2.48475, 1e-9);
});

test("round trips between frequency, wavelength and energy", () => {
  for (const lf of [3, 7.2, 14.75, 18, 23]) {
    const s = at(lf);
    const back = initialState();
    fromWavelength(back, s.logL);
    rel(back.logF, lf, 1e-12);
    fromEnergy(back, s.logE);
    rel(back.logF, lf, 1e-12);
    rel(10 ** s.logL, wavelength(s));
    rel(10 ** s.logE, energyEV(s));
  }
});

test("axis is clamped to 10³–10²³ Hz", () => {
  assert.equal(at(-5).logF, F_MIN);
  assert.equal(at(99).logF, F_MAX);
  assert.equal(at(NaN).logF, F_MIN);
});

test("region boundaries follow the table", () => {
  const cases = [
    [3e5, 0], [1, 0], [0.999, 1], [1e-3, 1], [9.99e-4, 2], [7.61e-7, 2], [7.6e-7, 3], [5e-7, 3], [3.8e-7, 3],
    [3.79e-7, 4], [1e-8, 4], [9.9e-9, 5], [1e-11, 5], [9.9e-12, 6], [3e-15, 6],
  ];
  for (const [lambda, i] of cases) assert.equal(regionIndex(lambda), i, `λ = ${lambda}`);
  // every λ on the axis falls in exactly one region, in order of rising frequency
  let prev = 0;
  for (let lf = F_MIN; lf <= F_MAX; lf += 0.01) {
    const i = regionIndex(wavelength(at(lf)));
    assert.ok(i >= prev && i < REGIONS.length);
    prev = i;
  }
  assert.equal(prev, REGIONS.length - 1);
});

test("visible colour only for 380–760 nm, roughly right hue", () => {
  assert.equal(visibleColor(379), null);
  assert.equal(visibleColor(761), null);
  for (let nm = 380; nm <= 760; nm += 5) assert.ok(visibleColor(nm).every(v => v >= 0 && v <= 255));
  const [r1, g1, b1] = visibleColor(700);
  assert.ok(r1 > g1 && r1 > b1, "700 nm is red");
  const [r2, g2, b2] = visibleColor(530);
  assert.ok(g2 > r2 && g2 > b2, "530 nm is green");
  const [r3, g3, b3] = visibleColor(460);
  assert.ok(b3 > r3 && b3 > g3, "460 nm is blue");
});

test("extremes print short, finite text and have a size comparison", () => {
  for (const lf of [F_MIN, F_MAX, 14.75]) {
    const s = at(lf);
    for (const t of [sci(frequency(s)), lengthText(wavelength(s)), sci(energyJ(s)), energyText(energyEV(s))]) {
      assert.ok(t.length <= 14 && !/NaN|Infinity|e[+-]/.test(t), t);
    }
    const o = compareObject(wavelength(s));
    assert.ok(Math.abs(Math.log10(o.size / wavelength(s))) < 1.5, o.name);
  }
  assert.equal(sci(6e14), "6·10¹⁴");
  assert.equal(sci(3.9756e-19), "3,98·10⁻¹⁹");
  assert.equal(sci(9.996e5), "1·10⁶");
  assert.equal(lengthText(5e-7), "500 nm");
  assert.equal(lengthText(3e5), "300 km");
  assert.equal(lengthText(3e-15), "3 fm");
  assert.equal(energyText(2.48475), "2,48 eV");
});
