import test from "node:test";
import assert from "node:assert/strict";
import { initialState, launch, step, theory, timeScale, sanitize, PRESETS, E, U } from "./model.js";

const near = (a, b, rel) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≉ ${b}`);
const at = over => launch({ ...initialState(), ...over });
// run in real seconds; dt is the kit's fixed step
const run = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds * 120); i++) step(s, 1 / 120);
  return s;
};

test("R = m·v/(|q|·B) and T = 2π·m/(|q|·B), from the formula and from the flight", () => {
  for (const particle of ["electron", "proton", "alpha"]) {
    for (const [speed, field] of [[2, 50], [0.5, 200], [5, 20]]) {
      const s = at({ particle, speed, field });
      const th = theory(s);
      const m = PRESETS[particle].mass * U;
      const q = Math.abs(PRESETS[particle].charge) * E;
      near(th.radius, (m * speed * 1e6) / (q * field * 1e-3), 1e-12);
      near(th.period, (2 * Math.PI * m) / (q * field * 1e-3), 1e-12);
      near(th.frequency, 1 / th.period, 1e-12);
      run(s, 4); // ≈ 3 s per revolution on screen
      assert.ok(s.measuredPeriod > 0, "one revolution measured");
      near(s.measuredPeriod, th.period, 1e-6);
      near(s.measuredRadius, th.radius, 1e-5);
    }
  }
  // textbook check: a proton at 2·10⁶ m/s in 50 mT, R ≈ 0,418 m
  near(theory(initialState()).radius, 0.4176, 1e-3);
});

test("the period does not depend on the speed; the radius is proportional to it", () => {
  const slow = run(at({ speed: 0.5 }), 4);
  const fast = run(at({ speed: 5 }), 4);
  near(slow.measuredPeriod, fast.measuredPeriod, 1e-6);
  near(fast.measuredRadius / slow.measuredRadius, 10, 1e-5);
});

test("rotation sense flips with the sign of the charge and with the field direction", () => {
  // positive charge, B into the screen: counter-clockwise (turns towards +y first)
  const sense = over => {
    const s = at(over);
    step(s, 0.05);
    return Math.sign(s.turned) * (s.y > 0 ? 1 : -1) > 0 ? Math.sign(s.turned) : NaN;
  };
  assert.equal(sense({ particle: "proton", fieldDir: "into" }), 1);
  assert.equal(sense({ particle: "electron", fieldDir: "into" }), -1);
  assert.equal(sense({ particle: "proton", fieldDir: "out" }), -1);
  assert.equal(sense({ particle: "electron", fieldDir: "out" }), 1);
  assert.equal(sense({ particle: "custom", charge: -2, mass: 4, fieldDir: "into" }), -1);
  assert.equal(theory(at({ particle: "alpha" })).sense, 1);
});

test("the speed stays constant over many turns, and the particle returns to the launch point", () => {
  const s = at({ particle: "alpha", speed: 3, field: 120 });
  const th = theory(s);
  run(s, 3 * 50); // 50 revolutions
  assert.ok(Math.abs(s.turned) > 2 * Math.PI * 49);
  near(Math.hypot(s.vx, s.vy), 3e6, 1e-9);
  // after a whole number of turns the particle is back near the origin
  const turns = Math.abs(s.turned) / (2 * Math.PI);
  const phase = (turns % 1) * 2 * Math.PI;
  const expected = 2 * th.radius * Math.abs(Math.sin(phase / 2)); // chord from the launch point
  assert.ok(Math.abs(Math.hypot(s.x, s.y) - expected) < 1e-6 * th.radius);
});

test("zero field or zero charge gives a straight line at constant velocity", () => {
  for (const over of [{ field: 0 }, { particle: "custom", charge: 0 }]) {
    const s = at(over);
    assert.equal(theory(s).circles, false);
    run(s, 2);
    assert.equal(s.y, 0);
    assert.equal(s.vy, 0);
    assert.equal(s.vx, 2e6);
    near(s.x, 2e6 * s.time, 1e-12);
    assert.equal(s.measuredPeriod, 0);
    assert.ok(Number.isFinite(timeScale(s)) && timeScale(s) > 0);
  }
});

test("a saved flight is rebuilt from the settings and the time, not trusted", () => {
  const base = initialState();
  const live = at({ particle: "electron", fieldDir: "out" });
  run(live, 4);
  // inconsistent position/velocity from the host are ignored
  const restored = sanitize({ ...live, x: 5, vx: -1, speed: 99 }, base);
  assert.equal(restored.speed, 5); // clamped to the slider range
  assert.ok(Math.abs(restored.x) < 0.01 && Math.abs(Math.hypot(restored.vx, restored.vy) - 5e6) < 1);
  const again = sanitize({ ...live }, base);
  near(again.x, live.x, 1e-6);
  near(again.measuredPeriod, live.measuredPeriod, 1e-9);
  assert.equal(sanitize({ ...live, particle: "neutron" }, base).particle, base.particle);
});

test("step reports the first revolution exactly once per launch (one result event)", () => {
  const s = at({});
  let reports = 0;
  for (let i = 0; i < 120 * 20; i++) if (step(s, 1 / 120)) reports++;
  assert.equal(reports, 1);
  launch(s);
  for (let i = 0; i < 120 * 4; i++) if (step(s, 1 / 120)) reports++;
  assert.equal(reports, 2);
});
