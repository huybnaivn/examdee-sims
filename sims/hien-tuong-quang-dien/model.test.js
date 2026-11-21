import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, step, HC, EFFICIENCY, TOLERANCE, METALS, photonEnergy, workFunction, threshold, canEmit, emitted,
  kineticMax, stoppingVoltage, saturationCurrent, current, nearThreshold, hasFound, markFound,
} from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const at = over => ({ ...initialState(), ...over });
const metals = Object.keys(METALS);

test("hc and the photon energy ε = hc/λ", () => {
  close(HC, (6.62607015e-34 * 299792458) / 1.602176634e-19 / 1e-9, 1e-6);
  close(photonEnergy(400), 3.0996, 1e-4);
  close(photonEnergy(200), 2 * photonEnergy(400));
});

test("emission if and only if hf > A", () => {
  for (const metal of metals) {
    for (let wavelength = 200; wavelength <= 800; wavelength++) {
      const s = at({ metal, wavelength });
      assert.equal(canEmit(s), photonEnergy(wavelength) > METALS[metal].A);
      assert.equal(emitted(s), canEmit(s));
      assert.equal(canEmit(s), wavelength < threshold(s));
    }
  }
});

test("threshold λ0 = hc/A matches the textbook table", () => {
  const table = { Na: 500, K: 550, Cs: 660, Zn: 350, Cu: 300 }; // nm
  for (const metal of metals) {
    close(threshold(at({ metal })), HC / METALS[metal].A);
    assert.ok(Math.abs(threshold(at({ metal })) - table[metal]) < 2, metal);
  }
});

test("Einstein: W_đmax = hf − A, and 0 without emission", () => {
  close(kineticMax(at({ metal: "Na", wavelength: 400 })), HC / 400 - 2.48);
  close(kineticMax(at({ metal: "Cs", wavelength: 250 })), HC / 250 - 1.88);
  assert.equal(kineticMax(at({ metal: "Cu", wavelength: 400 })), 0);
  for (const metal of metals) {
    const s = at({ metal, wavelength: 220 });
    close(photonEnergy(220), workFunction(s) + kineticMax(s));
  }
});

test("stopping voltage: e·U_h = W_đmax, and the current is zero from −U_h down", () => {
  const s = at({ metal: "K", wavelength: 300 });
  close(stoppingVoltage(s), kineticMax(s));
  const uh = stoppingVoltage(s);
  assert.equal(current(s, -uh), 0);
  assert.equal(current(s, -uh - 1), 0);
  assert.ok(current(s, -uh + 0.01) > 0);
});

test("the I–U curve rises from −U_h and saturates", () => {
  const s = at({ metal: "Na", wavelength: 300, power: 2 });
  const sat = saturationCurrent(s);
  close(sat, (EFFICIENCY * 2 * 1000) / photonEnergy(300)); // I_bh = H·e·P/(hf), µA
  close(current(s, -stoppingVoltage(s) / 2), sat / 2);
  for (const u of [0, 0.5, 5]) assert.equal(current(s, u), sat);
  let prev = 0;
  for (let u = -5; u <= 5; u += 0.05) {
    const i = current(s, u);
    assert.ok(i >= prev - 1e-12 && i <= sat);
    prev = i;
  }
});

test("intensity changes the saturation current but not W_đmax or U_h", () => {
  const weak = at({ power: 1 });
  const strong = at({ power: 4 });
  close(saturationCurrent(strong), 4 * saturationCurrent(weak));
  assert.equal(kineticMax(strong), kineticMax(weak));
  assert.equal(stoppingVoltage(strong), stoppingVoltage(weak));
  assert.equal(threshold(strong), threshold(weak));
  assert.equal(current(strong, -stoppingVoltage(strong)), 0);
});

test("below the threshold frequency the current is zero at any intensity and voltage", () => {
  for (const metal of metals) {
    const wavelength = Math.ceil(threshold(at({ metal }))) + 1;
    for (const power of [0.1, 1, 5, 1000]) {
      for (const voltage of [-5, 0, 5]) {
        const s = at({ metal, wavelength, power, voltage });
        assert.equal(current(s), 0);
        assert.equal(saturationCurrent(s), 0);
        assert.equal(emitted(s), false);
      }
    }
  }
});

test("no light, no electrons", () => {
  const s = at({ power: 0 });
  assert.equal(emitted(s), false);
  assert.equal(current(s), 0);
  assert.equal(step(s, 1)._el.length, 0);
});

test("finding the threshold: within the tolerance, once per metal, forged list ignored", () => {
  const s = at({ metal: "Na", wavelength: 498 });
  assert.ok(nearThreshold(s));
  assert.ok(!nearThreshold(at({ metal: "Na", wavelength: Math.round(threshold(s)) + TOLERANCE + 2 })));
  assert.equal(hasFound(s), false);
  assert.equal(markFound(s), true);
  assert.equal(markFound(s), false);
  assert.equal(s.found, "Na");
  s.metal = "Cs";
  assert.equal(hasFound(s), false);
  assert.equal(markFound(s), true);
  assert.equal(s.found, "Na,Cs");
  assert.equal(hasFound(at({ found: "x,<b>,Zn", metal: "Na" })), false);
});

test("animated electrons obey the field: all return when U_AK < −U_h, all arrive when U_AK ≥ 0", () => {
  const back = at({ voltage: -2 }); // U_h ≈ 0,62 V
  let maxX = 0;
  for (let i = 0; i < 1200; i++) for (const e of step(back, 1 / 120)._el) maxX = Math.max(maxX, e.x);
  assert.ok(maxX > 0 && maxX <= kineticMax(back) / 2 + 0.02, `turning point ${maxX}`);
  const on = at({ voltage: 1 });
  for (let i = 0; i < 600; i++) step(on, 1 / 120);
  assert.ok(on._el.length > 0 && on._el.every(e => e.v > 0));
});
