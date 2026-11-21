import test from "node:test";
import assert from "node:assert/strict";
import { SOLUTIONS, KW, CAPACITY, initialState, chemistry, classify, solutionById } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const mix = (solution, solutionVolume, waterVolume) => chemistry({ solution, solutionVolume, waterVolume });

test("undiluted solutions show their listed pH, and pH = −log10[H3O+]", () => {
  for (const sol of SOLUTIONS) {
    assert.ok(sol.pH >= 0 && sol.pH <= 14, sol.id);
    for (const water of [0, 50, 900]) {
      const c = mix(sol.id, 100, water);
      near(c.pH, -Math.log10(c.h), 1e-12);
      if (water === 0) near(c.pH, sol.pH, 1e-6);
    }
  }
  assert.equal(solutionById(initialState().solution).id, initialState().solution);
});

test("[H3O+]·[OH−] = 10⁻¹⁴ at every dilution", () => {
  for (const sol of SOLUTIONS) {
    for (const water of [0, 10, 300, 1400]) {
      const c = mix(sol.id, 100, water);
      near((c.h * c.oh) / KW, 1, 1e-9);
    }
  }
});

test("diluting an acid tenfold raises pH by 1, but never past 7", () => {
  for (const id of ["stomach", "lemon", "vinegar", "orange"]) {
    const before = mix(id, 100, 0);
    const after = mix(id, 100, 900);
    near(after.dilution, 10);
    near(after.pH - before.pH, 1, 1e-3);
  }
  for (const sol of SOLUTIONS.filter(x => x.pH < 7)) {
    let last = mix(sol.id, 100, 0).pH;
    for (const water of [100, 900, 9900, 1e7, 1e12]) {
      const pH = mix(sol.id, 100, water).pH;
      assert.ok(pH >= last && pH <= 7, `${sol.id} + ${water} mL: ${pH}`);
      last = pH;
    }
    near(last, 7, 1e-3); // endlessly diluted acid is just water
  }
});

test("diluting a base lowers pH toward 7, by 1 per tenfold when strong, never below 7", () => {
  near(mix("bleach", 100, 0).pH - mix("bleach", 100, 900).pH, 1, 1e-3);
  for (const sol of SOLUTIONS.filter(x => x.pH > 7)) {
    let last = mix(sol.id, 100, 0).pH;
    for (const water of [100, 900, 9900, 1e7, 1e12]) {
      const pH = mix(sol.id, 100, water).pH;
      assert.ok(pH <= last && pH >= 7, `${sol.id} + ${water} mL: ${pH}`);
      last = pH;
    }
    near(last, 7, 1e-3);
  }
});

test("pure water is 7 and neutral; adding more solution undoes dilution", () => {
  near(mix("lemon", 0, 500).pH, 7, 1e-9);
  near(mix("drain", 0, 500).pH, 7, 1e-9);
  near(mix("water", 100, 300).pH, 7, 1e-6);
  assert.equal(chemistry({ solution: "lemon", solutionVolume: 0, waterVolume: 0 }), null);
  assert.ok(mix("lemon", 500, 500).pH < mix("lemon", 100, 500).pH);
  assert.ok(mix("soap", 500, 500).pH > mix("soap", 100, 500).pH);
  assert.equal(classify(mix("lemon", 100, 0).pH), "acid");
  assert.equal(classify(mix("lemon", 0, 100).pH), "neutral");
  assert.equal(classify(mix("soap", 100, 0).pH), "base");
  assert.equal(classify(7), "neutral");
  assert.ok(CAPACITY >= 1500);
});
