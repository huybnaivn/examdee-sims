import test from "node:test";
import assert from "node:assert/strict";
import { PARTICLES, LENGTH, DURATION, initialState, fieldStrength, acceleration, deflection, exitTan, speedFromRest, entrySpeed, flight, clock, finished, position, grazing, step } from "./model.js";

const { electron: e, proton: p } = PARTICLES;
const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-300), `${a} ≠ ${b}`);
const S = more => ({ ...initialState(), time: 0, ...more });

test("E = U/d", () => {
  near(fieldStrength(100, 0.04), 2500);
  near(flight(S({ voltage: 100, gap: 4 })).E, 2500);
  near(flight(S({ voltage: 100, gap: 8 })).E, 1250); // twice the gap, half the field
});

test("a = |q|E/m", () => {
  near(acceleration(e.q, e.m, 2500), (1.602e-19 * 2500) / 9.109e-31);
  near(acceleration(e.q, e.m, 2500), 4.397e14, 1e-3);
  const f = flight(S({ voltage: 100, gap: 4, particle: "proton" }));
  near(f.a, (1.602e-19 * 2500) / 1.673e-27);
  near(f.force, 1.602e-19 * 2500); // same force on both particles
  near(flight(S({ voltage: 100, gap: 4 })).force, f.force);
});

test("y = |q|EL²/(2mv₀²) and the path is a parabola", () => {
  const s = S({ voltage: 60, gap: 4, speedE: 10 });
  const f = flight(s);
  const want = (1.602e-19 * 1500 * 0.1 ** 2) / (2 * 9.109e-31 * 1e7 ** 2);
  near(deflection(e.q, e.m, 1500, 0.1, 1e7), want);
  near(f.y, want);
  near(f.y, 0.0132, 2e-3); // 1,32 cm
  assert.equal(f.hit, false);
  near(f.y, 0.5 * f.a * (f.L / f.v0) ** 2); // ½at² with t = L/v₀
  const end = position(f, f.tEnd);
  near(end.x, f.L);
  near(end.y, f.y); // the electron goes up, towards the positive plate
  for (const k of [0.25, 0.5, 0.75]) near(position(f, k * f.tEnd).y, f.y * k * k); // y ∝ x²
  near(flight(S({ voltage: 60, gap: 4, speedE: 20 })).y, f.y / 4); // twice the speed, a quarter of the deflection
});

test("tan θ = |q|EL/(mv₀²)", () => {
  const f = flight(S({ voltage: 60, gap: 4, speedE: 10 }));
  near(exitTan(e.q, e.m, 1500, 0.1, 1e7), (1.602e-19 * 1500 * 0.1) / (9.109e-31 * 1e14));
  near(f.tan, (2 * f.y) / f.L); // the exit line passes through the middle of the plates
  const end = position(f, f.tEnd);
  near(end.vy / end.vx, f.tan);
  near(f.angle, (Math.atan(f.tan) * 180) / Math.PI);
  near(f.vEnd, Math.hypot(end.vx, end.vy));
});

test("from rest: v = √(2|q|U/m)", () => {
  near(speedFromRest(e.q, e.m, 100), Math.sqrt((2 * 1.602e-19 * 100) / 9.109e-31));
  near(speedFromRest(e.q, e.m, 100), 5.93e6, 1e-3);
  for (const gap of [2, 4, 10]) {
    const f = flight(S({ mode: "rest", voltage: 100, gap }));
    near(f.vEnd, speedFromRest(e.q, e.m, 100)); // does not depend on d
    near(f.a * f.tEnd, f.vEnd); // v = at after crossing d = ½at²
    near(0.5 * f.a * f.tEnd ** 2, f.d);
    near(0.5 * e.m * f.vEnd ** 2, 1.602e-19 * 100); // work of the field qU becomes kinetic energy
    assert.equal(position(f, 0).y, -f.d / 2); // electron starts on the negative (lower) plate
    near(position(f, f.tEnd).y, f.d / 2);
  }
  const fp = flight(S({ mode: "rest", voltage: 100, particle: "proton" }));
  near(fp.vEnd / speedFromRest(e.q, e.m, 100), Math.sqrt(e.m / p.m));
  assert.equal(position(fp, 0).y, fp.d / 2); // proton starts on the positive (upper) plate
});

test("hits a plate exactly when the deflection would exceed d/2", () => {
  for (let voltage = 0; voltage <= 200; voltage += 5) {
    for (const gap of [2, 4, 7, 10]) {
      for (const speedE of [5, 10, 30]) {
        const f = flight(S({ voltage, gap, speedE }));
        const y = deflection(e.q, e.m, f.E, f.L, f.v0);
        assert.equal(f.hit, y > f.d / 2);
        if (f.hit) {
          assert.ok(f.x < f.L);
          near(f.x, f.v0 * Math.sqrt(f.d / f.a)); // d/2 = ½at²
          near(Math.abs(position(f, f.tEnd).y), f.d / 2);
          near(f.y, f.d / 2);
        } else near(f.x, f.L);
      }
    }
  }
  assert.equal(flight(S({ voltage: 100, gap: 4 })).hit, true);
  assert.equal(flight(S({ voltage: 60, gap: 4 })).hit, false);
});

test("electron and proton are pushed opposite ways", () => {
  const fe = flight(S({}));
  const fp = flight(S({ particle: "proton" }));
  assert.ok(position(fe, fe.tEnd).y > 0); // towards the positive plate (top)
  assert.ok(position(fp, fp.tEnd).y < 0);
  near(entrySpeed(S({ particle: "proton", speedP: 2.5 })), 2.5e5);
  near(entrySpeed(S({ speedE: 10 })), 1e7);
  // same speed: the proton's deflection is smaller by the mass ratio
  near(deflection(p.q, p.m, 1500, 0.1, 1e7) / deflection(e.q, e.m, 1500, 0.1, 1e7), e.m / p.m);
});

test("grazing exit: leaves without touching, with at least 90 % of d/2", () => {
  assert.equal(grazing(flight(S({ voltage: 60, gap: 4 }))), false); // 1,32 cm of 2 cm
  assert.equal(grazing(flight(S({ voltage: 88, gap: 4 }))), true); // 1,93 cm
  assert.equal(grazing(flight(S({ voltage: 100, gap: 4 }))), false); // hits
  assert.equal(grazing(flight(S({ mode: "rest", voltage: 88 }))), false);
});

test("the clock runs from firing to the end and cannot be forged past it", () => {
  const s = S({});
  const f = flight(s);
  assert.equal(finished(s), false);
  let n = 0;
  while (!finished(s) && n++ < 1000) step(s, 1 / 120);
  assert.equal(n, DURATION * 120);
  near(clock(s), f.tEnd);
  const hit = S({ voltage: 150 });
  n = 0;
  while (!finished(hit) && n++ < 1000) step(hit, 1 / 120);
  assert.ok(n < DURATION * 120); // an impact ends the flight early
  for (const time of [1e9, -5, NaN]) {
    const t = clock(S({ time }));
    assert.ok(t >= 0 && t <= f.tEnd);
  }
  assert.equal(finished(initialState()), true); // the first picture is a finished flight
  assert.equal(LENGTH, 10);
});

test("U = 0: straight through, and a particle at rest stays at rest", () => {
  const f = flight(S({ voltage: 0 }));
  assert.equal(f.y, 0);
  assert.equal(f.tan, 0);
  assert.equal(f.hit, false);
  const r = S({ mode: "rest", voltage: 0, time: 1 });
  assert.equal(finished(r), false);
  assert.equal(clock(r), 0);
  assert.equal(flight(r).vEnd, 0);
});
