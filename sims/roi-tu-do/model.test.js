import test from "node:test";
import assert from "node:assert/strict";
import { initialState, OBJECTS, RHO, gravity, terminalSpeed, fallTime, motion, endTime, strobe } from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const make = over => ({ ...initialState(), ...over });

test("vacuum: t = √(2h/g) and v = g·t for every object, whatever its mass", () => {
  for (const place of ["earth", "moon", "custom"]) {
    for (const height of [1, 5, 20]) {
      const s = make({ medium: "vacuum", place, height });
      const g = gravity(s);
      for (const name of Object.keys(OBJECTS)) {
        const T = fallTime(s, name);
        near(T, Math.sqrt((2 * height) / g));
        near(motion(s, name, T).v, g * T);
        near(motion(s, name, T / 2).v, (g * T) / 2);
        near(motion(s, name, T / 2).h, height - (g * (T / 2) ** 2) / 2);
      }
    }
  }
});

test("gravity: Earth 9,81, Moon 1,62, custom value; the Moon drop takes longer", () => {
  assert.equal(gravity(make({ place: "earth" })), 9.81);
  assert.equal(gravity(make({ place: "moon" })), 1.62);
  assert.equal(gravity(make({ place: "custom", gCustom: 3.7 })), 3.7);
  const earth = fallTime(make({ medium: "vacuum", place: "earth" }), "steel");
  const moon = fallTime(make({ medium: "vacuum", place: "moon" }), "steel");
  near(moon / earth, Math.sqrt(9.81 / 1.62));
});

test("air: a light, wide object reaches the terminal speed √(2mg/(ρ·C·A))", () => {
  const s = make({ medium: "air", height: 20 });
  for (const name of ["feather", "paper"]) {
    const o = OBJECTS[name];
    const vt = Math.sqrt((2 * o.mass * 9.81) / (RHO * o.drag * o.area));
    near(terminalSpeed(s, name), vt);
    const end = motion(s, name, fallTime(s, name));
    near(end.v, vt, 1e-6);
    assert.ok(end.v <= vt);
  }
});

test("air: the feather and the paper fall slower than the steel ball", () => {
  const s = make({ medium: "air", height: 5 });
  const steel = fallTime(s, "steel");
  assert.ok(fallTime(s, "feather") > 3 * steel);
  assert.ok(fallTime(s, "paper") > 3 * steel);
  assert.ok(fallTime(s, "ball") > steel);
  // the dense steel ball is barely affected over a few metres
  near(steel, Math.sqrt(10 / 9.81), 0.01);
  assert.ok(steel > Math.sqrt(10 / 9.81));
  assert.equal(endTime(make({ medium: "air", height: 5, object1: "steel", object2: "feather", two: true })), fallTime(s, "feather"));
  assert.equal(endTime(make({ medium: "air", height: 5, object1: "steel", two: false })), steel);
});

test("air: the closed form obeys m·dv/dt = m·g − ½·ρ·C·A·v² and dy/dt = v", () => {
  const s = make({ medium: "air", height: 20 });
  const d = 1e-5;
  for (const name of Object.keys(OBJECTS)) {
    const o = OBJECTS[name];
    const T = fallTime(s, name);
    near(motion(s, name, T).fallen, 20, 1e-9);
    for (const t of [0.1 * T, 0.5 * T, 0.9 * T]) {
      const a = motion(s, name, t - d);
      const b = motion(s, name, t + d);
      const v = motion(s, name, t).v;
      near((b.v - a.v) / (2 * d), 9.81 - (RHO * o.drag * o.area * v * v) / (2 * o.mass), 1e-5);
      near((b.fallen - a.fallen) / (2 * d), v, 1e-5);
    }
  }
});

test("vacuum: distances in successive equal intervals follow 1 : 3 : 5 : 7", () => {
  const s = make({ medium: "vacuum", height: 20, interval: 0.2 });
  for (const name of ["steel", "feather"]) {
    const marks = strobe(s, name);
    assert.ok(marks.length >= 6);
    const gaps = marks.slice(1).map((y, i) => y - marks[i]);
    gaps.slice(0, 5).forEach((gap, i) => near(gap / gaps[0], 2 * i + 1));
    near(gaps[0], (9.81 * 0.2 ** 2) / 2);
  }
  // in air the feather soon covers equal distances in equal intervals instead
  const air = strobe(make({ medium: "air", height: 20, interval: 0.5 }), "feather");
  near((air[9] - air[8]) / (air[8] - air[7]), 1, 1e-3);
});

test("strobe marks stop at the current time and at the ground", () => {
  const s = make({ medium: "vacuum", height: 2, interval: 0.1 });
  assert.equal(strobe(s, "steel", 0).length, 1);
  assert.equal(strobe(s, "steel", 0.35).length, 4);
  assert.equal(strobe(s, "steel").length, 7); // lands at 0,639 s
  assert.ok(strobe(s, "steel").every(y => y <= 2));
});

test("after landing the object stays on the ground; the initial state is a finished drop", () => {
  const s = initialState();
  for (const name of [s.object1, s.object2]) {
    const m = motion(s, name, s.time);
    assert.equal(m.h, 0);
    assert.equal(m.landed, true);
  }
  assert.equal(motion(s, "steel", 0).h, s.height);
  assert.equal(motion(s, "steel", 0).v, 0);
});
