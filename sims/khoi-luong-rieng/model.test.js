import test from "node:test";
import assert from "node:assert/strict";
import { MATERIALS, OBJECTS, IDS, CYLINDER, initialState, kgPerM3, gPerCm3, density, massOf, readings, measure, identify, stageOf, measuredIds, bitOf, isCorrect } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);

test("D = m/V", () => {
  near(density(78, 10), 7.8);
  near(density(54, 20), 2.7);
  const r = measure("C", "cylinder");
  near(r.mass, 54);
  near(r.volume, 20);
  near(r.density, r.mass / r.volume);
});

test("volume from the rise in liquid level, and from the overflow", () => {
  for (const id of IDS) {
    const c = readings(id, "cylinder");
    assert.equal(c.before, CYLINDER.start);
    assert.equal(c.after - c.before, OBJECTS[id].volume);
    assert.ok(c.after <= CYLINDER.capacity);
    const o = readings(id, "overflow");
    assert.equal(o.volume, OBJECTS[id].volume); // spilled water = object volume
    near(measure(id, "cylinder").density, measure(id, "overflow").density);
  }
});

test("unit conversion: 1 g/cm³ = 1000 kg/m³ and back", () => {
  near(kgPerM3(1), 1000);
  near(kgPerM3(7.8), 7800);
  near(gPerCm3(2700), 2.7);
  for (const x of [0.8, 1, 2.6, 13.6]) near(gPerCm3(kgPerM3(x)), x);
  // 1 g/cm³ = 0,001 kg / 0,000001 m³
  near(0.001 / 1e-6, 1000);
});

test("every object is identified as its own material", () => {
  for (const id of IDS) {
    const r = measure(id, "cylinder");
    assert.equal(identify(r.densityKg), OBJECTS[id].material, id);
    assert.ok(Math.abs(r.densityKg - MATERIALS[OBJECTS[id].material].density) / MATERIALS[OBJECTS[id].material].density < 0.01);
  }
  assert.equal(identify(1000), null); // water is not in the list of solids
  assert.equal(identify(2650, 0.05), "nhom"); // nearest wins inside the tolerance (2700 vs 2600 tie-ish)
});

test("same material, different size: same D", () => {
  const pairs = [["A", "B"], ["C", "D"], ["E", "F"], ["H", "I"]];
  for (const [a, b] of pairs) {
    assert.notEqual(OBJECTS[a].volume, OBJECTS[b].volume);
    assert.notEqual(massOf(a), massOf(b));
    near(measure(a, "cylinder").density, measure(b, "overflow").density);
  }
  // same mass, different material: A (sắt) and F (đá) both weigh 78 g
  assert.equal(massOf("A"), massOf("F"));
  assert.ok(measure("A", "cylinder").density > measure("F", "cylinder").density);
});

test("state helpers clamp forged values", () => {
  assert.equal(stageOf({ stage: 7 }), 2);
  assert.equal(stageOf({ stage: -3 }), 0);
  assert.equal(stageOf({ stage: 1.5 }), 0);
  assert.deepEqual(measuredIds({ measured: bitOf("A") | bitOf("I") }), ["A", "I"]);
  assert.deepEqual(measuredIds({ measured: -1 }).length, IDS.length);
  assert.deepEqual(measuredIds({ measured: 0.5 }), []);
  assert.ok(isCorrect(initialState()));
});
