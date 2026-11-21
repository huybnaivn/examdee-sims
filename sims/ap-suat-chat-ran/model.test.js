import test from "node:test";
import assert from "node:assert/strict";
import { G, FACES, SUPPORTS, initialState, weight, cm2ToM2, pressure, dentDepth, solve, options, maxPressureKey } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);
const make = over => ({ ...initialState(), ...over });

test("p = F/S with units: N, m², N/m² = Pa", () => {
  assert.equal(G, 10);
  near(weight(2), 20);
  near(cm2ToM2(200), 0.02);
  near(cm2ToM2(1), 1e-4);
  near(pressure(20, 0.02), 1000); // 20 N on 200 cm² = 1000 Pa
  near(pressure(1, 1), 1); // 1 N/m² = 1 Pa
  const r = solve(make({ brickMass: 2, face: "large" }));
  near(r.force, 20);
  near(r.areaCm2, 200);
  near(r.area, 0.02);
  near(r.pressure, 1000);
  const feet = solve(make({ object: "person", personMass: 60, support: "feet" }));
  near(feet.pressure, 600 / 0.03); // 20 000 Pa
});

test("same weight on a smaller face gives a larger pressure", () => {
  const s = make({ brickMass: 3 });
  const [large, medium, small] = ["large", "medium", "small"].map(k => solve(s, k));
  near(large.force, small.force);
  assert.ok(large.pressure < medium.pressure && medium.pressure < small.pressure);
  const p = make({ object: "person" });
  assert.ok(solve(p, "skis").pressure < solve(p, "feet").pressure);
  assert.ok(solve(p, "feet").pressure < solve(p, "nail").pressure);
});

test("ratio of pressures is the inverse ratio of areas", () => {
  for (const object of ["brick", "person"]) {
    const s = make({ object, brickMass: 4.5, personMass: 72 });
    const all = options(s).map(o => solve(s, o.key));
    for (const a of all) for (const b of all) near(a.pressure / b.pressure, b.area / a.area);
  }
  near(solve(make(), "small").pressure / solve(make(), "large").pressure, 4); // 200 cm² / 50 cm²
});

test("dent depth grows with pressure and stays bounded", () => {
  assert.equal(dentDepth(0), 0);
  assert.ok(dentDepth(5e8) <= 6 && dentDepth(5e8) >= dentDepth(2e5));
  let prev = -1;
  for (let p = 0; p <= 2e5; p += 500) {
    const d = dentDepth(p);
    assert.ok(d > prev && d < 6 + 1e-9);
    prev = d;
  }
  const s = make();
  const depths = ["large", "medium", "small"].map(k => solve(s, k).depth);
  assert.ok(depths[0] < depths[1] && depths[1] < depths[2]);
});

test("largest pressure is the smallest contact face; forged state stays sane", () => {
  assert.equal(maxPressureKey(make()), "small");
  assert.equal(maxPressureKey(make({ object: "person" })), "nail");
  assert.equal(Object.keys(FACES).length, 3);
  assert.equal(Object.keys(SUPPORTS).length, 3);
  const forged = solve(make({ brickMass: -50 }));
  assert.ok(forged.force > 0 && Number.isFinite(forged.pressure));
  assert.ok(solve(make({ brickMass: 1e9 })).mass <= 5);
});
