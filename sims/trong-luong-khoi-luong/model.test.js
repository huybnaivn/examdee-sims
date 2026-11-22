import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, PLACES, OBJECTS, TEXTBOOK_G, gravity, weight, weightFromMass, massFromWeight,
  balanceReading, balanceWorks, fullScale, springConstant, extension, reading, isGoodGuess, cleanGuess, FULL_EXTENSION,
} from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test("P = m·g on every body, with the real g values", () => {
  const want = { earth: 9.81, moon: 1.62, mars: 3.71, jupiter: 24.79 };
  for (const [place, g] of Object.entries(want)) {
    assert.equal(gravity(place), g);
    for (const object of Object.keys(OBJECTS)) {
      const r = reading({ ...initialState(), place, object, approx: false });
      near(r.weight, OBJECTS[object].mass * g);
    }
  }
  near(reading({ ...initialState(), place: "moon", object: "astronaut" }).weight, 121.5);
});

test("the textbook rounding g = 10 N/kg applies on Earth only", () => {
  assert.equal(gravity("earth", true), 10);
  assert.equal(gravity("moon", true), 1.62);
  assert.equal(reading({ ...initialState(), place: "earth", approx: true }).weight, 750);
  near(reading({ ...initialState(), place: "earth", approx: false }).weight, 735.75);
});

test("kg ↔ N with 10 N/kg, as the textbook converts", () => {
  assert.equal(TEXTBOOK_G, 10);
  assert.equal(weightFromMass(1), 10);
  assert.equal(weightFromMass(0.1), 1); // a 100 g mass weighs 1 N
  assert.equal(massFromWeight(750), 75);
  for (const m of [0.05, 2, 48]) near(massFromWeight(weightFromMass(m)), m);
});

test("the balance reads the mass whatever g is", () => {
  for (const object of Object.keys(OBJECTS)) {
    for (const place of ["earth", "moon", "mars", "jupiter"]) {
      const r = reading({ ...initialState(), place, object });
      near(r.balance, OBJECTS[object].mass, 1e-9);
    }
  }
  near(balanceReading(3, 0.01), 3);
  near(balanceReading(3, 1000), 3);
});

test("in orbit the spring scale reads zero and the balance cannot compare", () => {
  for (const object of Object.keys(OBJECTS)) {
    const r = reading({ ...initialState(), place: "orbit", object });
    assert.equal(r.weight, 0);
    assert.equal(r.extension, 0);
    assert.equal(r.mass, OBJECTS[object].mass); // the mass is still there
    assert.ok(Number.isNaN(r.balance));
  }
  assert.equal(balanceWorks(PLACES.orbit.g), false);
});

test("the spring stretch is proportional to the weight and stays on the scale", () => {
  const k = springConstant(75);
  near(extension(200, k) / extension(100, k), 2);
  near(extension(750, k) / extension(121.5, k), 750 / 121.5);
  for (const object of Object.keys(OBJECTS)) {
    const moon = reading({ ...initialState(), place: "moon", object });
    const mars = reading({ ...initialState(), place: "mars", object });
    near(mars.extension / moon.extension, 3.71 / 1.62);
    const jupiter = reading({ ...initialState(), place: "jupiter", object });
    assert.ok(jupiter.weight <= fullScale(OBJECTS[object].mass));
    assert.ok(jupiter.extension <= FULL_EXTENSION);
  }
});

test("a prediction is accepted within 2 %, and a forged guess is clamped", () => {
  assert.ok(isGoodGuess(121.5, 121.5));
  assert.ok(isGoodGuess(120, 121.5));
  assert.ok(!isGoodGuess(750, 121.5));
  assert.ok(isGoodGuess(0, 0));
  assert.ok(!isGoodGuess(5, 0));
  assert.equal(cleanGuess(-4), 0);
  assert.equal(cleanGuess(1e12), 100000);
  assert.equal(cleanGuess(NaN), 0);
});
