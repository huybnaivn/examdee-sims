import test from "node:test";
import assert from "node:assert/strict";
import { NA, VM, SUBSTANCES, initialState, parseFormula, molarMass, molFrom, fromMol, convert, sci, align, dotScale, substanceById } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("formula parser handles brackets and rejects bad input", () => {
  assert.deepEqual(parseFormula("Ca(OH)2"), { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(parseFormula("Al2(SO4)3"), { Al: 2, S: 3, O: 12 });
  assert.deepEqual(parseFormula("C12H22O11"), { C: 12, H: 22, O: 11 });
  for (const bad of ["", "h2o", "Ca(OH", "H2O)", "()", "H2 O"]) assert.throws(() => parseFormula(bad), bad);
});

test("molar mass from school atomic masses, brackets included", () => {
  const want = { H2O: 18, CO2: 44, NaCl: 58.5, O2: 32, Fe: 56, C12H22O11: 342, N2: 28, H2: 2, CH4: 16, "Ca(OH)2": 74 };
  for (const s of SUBSTANCES) assert.equal(molarMass(s.id), want[s.id], s.id);
  assert.equal(molarMass("Mg(NO3)2"), 148);
  assert.throws(() => molarMass("Xe"));
});

test("m = n·M, N = n·N_A, V = n·24,79 for gases", () => {
  assert.equal(NA, 6.022e23);
  assert.equal(VM, 24.79);
  for (const sub of SUBSTANCES) {
    for (const n of [0, 0.25, 1, 3.7]) {
      const q = fromMol(sub, n);
      near(q.mass, n * molarMass(sub.id));
      near(q.particles, n * NA);
      if (sub.gas) near(q.volume, n * 24.79);
      else assert.equal(q.volume, null);
    }
  }
  const co2 = convert(initialState()); // 11 g CO2
  near(co2.mol, 0.25);
  near(co2.particles, 1.5055e23);
  near(co2.volume, 6.1975);
});

test("every quantity converts back to the same amount (round trips)", () => {
  for (const sub of SUBSTANCES) {
    for (const n of [0.01, 0.5, 2, 13.3]) {
      const q = fromMol(sub, n);
      near(molFrom(sub, "mass", q.mass), n);
      near(molFrom(sub, "mol", q.mol), n);
      near(molFrom(sub, "particles", q.particles), n);
      if (sub.gas) near(molFrom(sub, "volume", q.volume), n);
    }
  }
  // through the state, with particles in units of 10²³
  const s = { ...initialState(), substance: "O2", given: "particles", particles: 6.022 };
  near(convert(s).mol, 1);
  near(convert(s).mass, 32);
  near(convert(s).volume, 24.79);
  near(convert({ ...s, given: "volume", volume: 49.58 }).mass, 64);
});

test("a substance that is not a gas refuses a gas volume", () => {
  for (const sub of SUBSTANCES.filter(x => !x.gas)) {
    assert.equal(molFrom(sub, "volume", 10), null);
    const c = convert({ ...initialState(), substance: sub.id, given: "volume", volume: 10 });
    assert.equal(c.error, "not-gas");
    assert.equal(c.mol, undefined);
  }
  assert.deepEqual(SUBSTANCES.filter(x => x.gas).map(x => x.id).sort(), ["CH4", "CO2", "H2", "N2", "O2"]);
  assert.equal(molFrom(substanceById("H2O"), "mass", -1), null);
  assert.equal(substanceById("forged").id, SUBSTANCES[0].id);
});

test("initial state is self-consistent and align keeps the sliders in step", () => {
  const s = initialState();
  const before = { ...s };
  align(s);
  assert.deepEqual(s, before);
  const t = align({ ...initialState(), substance: "H2", given: "mol", mol: 2 });
  assert.equal(t.mass, 4);
  assert.equal(t.particles, 12.04);
  assert.equal(t.volume, 49.6);
  near(convert({ ...t, given: "mass" }).mol, 2);
  const big = align({ ...initialState(), substance: "H2", given: "mass", mass: 500 }); // 250 mol
  assert.equal(big.mol, 20); // clamped to the slider range
  const refused = { ...initialState(), substance: "Fe", given: "volume" };
  assert.deepEqual(align({ ...refused }), refused);
});

test("scientific notation and the dot scale of the particle picture", () => {
  assert.deepEqual(sci(6.022e23), [6.022, 23]);
  assert.deepEqual(sci(9.99999e22), [1, 23]);
  assert.deepEqual(sci(1.5055e23), [1.506, 23]);
  assert.deepEqual(sci(0), [0, 0]);
  for (const N of [1, 7, 59, 61, 1.5055e23, 6.022e24, 3.3e22]) {
    const { unit, count } = dotScale(N);
    assert.ok(count >= 6 && count <= 60, `${N}: ${count}`);
    const k = unit / 10 ** Math.floor(Math.log10(unit) + 1e-9);
    assert.ok([1, 2, 5].some(x => Math.abs(x - k) < 1e-9), `${unit}`);
    near(count, Math.round(N / unit));
  }
  assert.deepEqual(dotScale(0), { unit: 0, count: 0 });
});
