import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, solve, compare, contact, place, depthIndex, challengeMet, maxBrickPressure,
  weight, cm2ToM2, pressure, nextOf, FACE_ORDER, GROUNDS, TANK,
} from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const withState = patch => ({ ...initialState(), ...patch });

test("p = F/S with F = 10·m and the textbook units", () => {
  near(weight(2), 20);
  near(cm2ToM2(200), 0.02);
  near(pressure(20, 0.02), 1000); // 1 Pa = 1 N/m²
  const r = solve(withState({ slotA: "brick" }), "A");
  near(r.force, 20);
  near(r.pressure, 1000);
});

test("the same brick presses harder on a smaller face, in inverse ratio to the area", () => {
  const p = face => solve(withState({ slotA: "brick", brickFace: face }), "A").pressure;
  near(p("medium") / p("large"), 2);
  near(p("small") / p("large"), 4);
});

test("stacking bricks multiplies the force and the pressure, not the area", () => {
  const one = solve(withState({ slotA: "brick", brickCount: 1 }), "A");
  const three = solve(withState({ slotA: "brick", brickCount: 3 }), "A");
  near(three.force, 3 * one.force);
  near(three.areaCm2, one.areaCm2);
  near(three.pressure, 3 * one.pressure);
});

test("a child on heel tips presses 25 times harder than a 4-tonne elephant", () => {
  const c = compare(initialState());
  near(c.a.pressure, 500 / 0.0002); // 2,5 MPa
  near(c.b.pressure, 40000 / 0.4); // 100 kPa
  near(c.ratio, 25);
  assert.equal(c.deeper, "A");
});

test("the tank and the 4-tonne elephant press equally although one is ten times heavier", () => {
  const c = compare(withState({ slotA: "tank", slotB: "elephant" }));
  near(c.a.pressure, weight(TANK.mass) / cm2ToM2(TANK.area));
  assert.equal(c.deeper, "equal");
  assert.ok(c.a.force / c.b.force >= 2);
});

test("skis spread the weight: the child sinks less on skis than in trainers", () => {
  const p = shoes => solve(withState({ kidShoes: shoes }), "A").pressure;
  assert.ok(p("skis") < p("feet") && p("feet") < p("stilts") && p("stilts") < p("heels"));
});

test("the dent grows with pressure, never passes the deepest one, and concrete does not dent", () => {
  let last = -1;
  for (let e = 2; e <= 8; e += 0.25) {
    const d = depthIndex(10 ** e, "sand");
    assert.ok(d >= last && d >= 0 && d <= 1);
    last = d;
  }
  assert.ok(depthIndex(1e5, "snow") > depthIndex(1e5, "sand"));
  for (const p of [1e3, 1e5, 1e7]) assert.equal(depthIndex(p, "concrete"), 0);
  assert.equal(depthIndex(0, "sand"), 0);
  assert.equal(depthIndex(NaN, "sand"), 0);
  assert.ok("sand" in GROUNDS);
});

test("an object stands on one side only, and unknown objects are ignored", () => {
  const s = initialState(); // kid left, elephant right
  place(s, "B", "kid");
  assert.equal(s.slotA, "none");
  assert.equal(s.slotB, "kid");
  place(s, "A", "dragon");
  assert.equal(s.slotA, "none");
  assert.equal(compare(s), null);
  assert.equal(solve(s, "A"), null);
});

test("challenges are met only by the right set-up", () => {
  assert.ok(challengeMet(initialState(), "kid-beats-elephant"));
  assert.ok(!challengeMet(withState({ kidShoes: "skis" }), "kid-beats-elephant"));
  assert.ok(challengeMet(withState({ slotA: "tank", slotB: "elephant" }), "equal-different"));
  assert.ok(!challengeMet(initialState(), "equal-different"));
  const best = withState({ slotA: "brick", brickFace: "small", brickCount: 3, brickMass: 5 });
  near(solve(best, "A").pressure, maxBrickPressure());
  near(maxBrickPressure(), 150 / 0.005);
  assert.ok(challengeMet(best, "brick-max"));
  assert.ok(!challengeMet({ ...best, brickFace: "large" }, "brick-max"));
  assert.ok(!challengeMet(initialState(), "none"));
});

test("forged settings are kept inside the allowed ranges", () => {
  const c = contact(withState({ brickMass: 1e9, brickCount: -4 }), "brick");
  near(c.mass, 5 * 1);
  near(contact(withState({ kidMass: NaN }), "kid").mass, 20);
  near(contact(withState({ elephantMass: 1 }), "elephant").mass, 3000);
  near(contact(withState({ brickFace: "nope" }), "brick").areaCm2, 200);
  near(contact(withState({ kidShoes: "nope" }), "kid").areaCm2, 300);
});

test("tapping cycles through the brick faces and back", () => {
  assert.equal(nextOf(FACE_ORDER, "large"), "medium");
  assert.equal(nextOf(FACE_ORDER, "small"), "large");
});
