import test from "node:test";
import assert from "node:assert/strict";
import {
  SURFACES, ROUGHNESS, G, RAMP, initialState, normal, maxStatic, moving, frictionFor, startTime, endTime,
  pullAt, positionAt, phase, step, rankingRight, tidy,
} from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const block = (o = {}) => ({ ...initialState(), ...o });

test("below the limit, static friction equals the pull and the block stays put", () => {
  for (const surface of ROUGHNESS) {
    const s = block({ surface });
    const limit = maxStatic(s);
    near(limit, SURFACES[surface].muS * s.mass * G);
    for (const F of [0, 0.3 * limit, 0.99 * limit, limit]) {
      const f = frictionFor(s, F);
      assert.equal(f.slides, false);
      near(f.force, F);
    }
    const over = frictionFor(s, limit * 1.01);
    assert.equal(over.slides, true);
    near(over.force, moving(s));
    // the scale reading rises at RAMP while static and the block has not moved
    const t = startTime(s) * 0.5;
    near(pullAt(s, t), RAMP * t);
    assert.equal(positionAt(s, t), 0);
  }
});

test("sliding friction is μt·N and does not depend on the contact area", () => {
  for (const surface of ROUGHNESS) {
    const wide = block({ surface, support: "wide" });
    const narrow = block({ surface, support: "narrow" });
    near(moving(wide), SURFACES[surface].muK * normal(wide));
    near(moving(wide), moving(narrow));
    near(maxStatic(wide), maxStatic(narrow));
    assert.ok(moving(wide) < maxStatic(wide)); // the scale drops once the block slides
    // after the peak the reading settles to the sliding value
    near(pullAt(wide, startTime(wide)), maxStatic(wide));
    near(pullAt(wide, endTime(wide)), moving(wide), 1e-6);
  }
});

test("rolling friction is much smaller than sliding friction", () => {
  for (const surface of ROUGHNESS) {
    const roll = block({ surface, support: "rollers" });
    const slide = block({ surface });
    assert.ok(moving(roll) * 10 <= moving(slide), surface);
    assert.equal(frictionFor(roll, moving(roll) * 1.01).kind, "rolling");
  }
});

test("rougher surfaces give more friction; ranking check", () => {
  for (let k = 1; k < ROUGHNESS.length; k++) {
    const a = block({ surface: ROUGHNESS[k - 1] });
    const b = block({ surface: ROUGHNESS[k] });
    assert.ok(moving(b) > moving(a));
    assert.ok(maxStatic(b) > maxStatic(a));
  }
  assert.equal(rankingRight(block({ rank1: "kinh", rank2: "go", rank3: "tham", rank4: "giay" })), true);
  assert.equal(rankingRight(block({ rank1: "go", rank2: "kinh", rank3: "tham", rank4: "giay" })), false);
  assert.equal(rankingRight(initialState()), false);
});

test("friction is proportional to the weight: twice the mass, twice the friction", () => {
  for (const support of ["wide", "narrow", "rollers"]) {
    const light = block({ mass: 0.3, support });
    const heavy = block({ mass: 0.6, support });
    near(normal(light), 3);
    near(moving(heavy), 2 * moving(light));
    near(maxStatic(heavy), 2 * maxStatic(light));
  }
});

test("a run: static, then moving at steady speed, then done", () => {
  // the initial picture is a finished run on wood, with its measurement recorded
  assert.equal(phase(initialState()), "done");
  near(initialState().fGo, moving(initialState()));
  const s = block({ time: 0 });
  assert.equal(phase(s), "static");
  while (phase(s) === "static") step(s, 1 / 120);
  assert.ok(Math.abs(s.time - startTime(s)) < 1 / 100);
  for (let i = 0; i < 6000 && phase(s) !== "done"; i++) step(s, 1 / 120);
  assert.equal(phase(s), "done");
  near(s.time, endTime(s));
  near(positionAt(s, s.time), 0.4);
  const forged = tidy(block({ time: 1e9, fGo: -4, surface: "x", verdict: "maybe" }));
  assert.deepEqual([forged.surface, forged.time, forged.fGo, forged.verdict], ["go", endTime(forged), 0, ""]);
});
