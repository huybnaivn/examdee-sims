import test from "node:test";
import assert from "node:assert/strict";
import { initialState, velocities, crossingTime, drift, headingForNoDrift, landsOpposite, boat, step, launch, train, LOOP } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
const river = over => ({ ...initialState(), ...over });

test("vector addition v13 = v12 + v23", () => {
  for (const [vBoat, heading, vCurrent] of [[4, 0, 2], [5, 30, 3], [3, -40, 4], [6, 60, 0]]) {
    const { v12, v23, v13, speed } = velocities(river({ vBoat, heading, vCurrent }));
    near(v13.x, v12.x + v23.x);
    near(v13.y, v12.y + v23.y);
    near(Math.hypot(v12.x, v12.y), vBoat);
    near(v23.x, vCurrent);
    near(v23.y, 0);
    near(speed, Math.hypot(v13.x, v13.y));
  }
  // heading straight across: perpendicular vectors, Pythagoras
  near(velocities(river({ vBoat: 4, vCurrent: 3 })).speed, 5);
});

test("crossing time = width / perpendicular component, independent of the current", () => {
  near(crossingTime(river({ width: 100, vBoat: 4, heading: 0 })), 25);
  near(crossingTime(river({ width: 120, vBoat: 4, heading: 60 })), 120 / (4 * 0.5), 1e-9);
  near(crossingTime(river({ vCurrent: 0 })), crossingTime(river({ vCurrent: 5 })));
  // heading straight across is the fastest way over
  const straight = crossingTime(river({ heading: 0 }));
  for (const heading of [-45, -10, 10, 30, 60]) assert.ok(crossingTime(river({ heading })) > straight);
});

test("drift = current × time when heading straight across", () => {
  for (const [width, vBoat, vCurrent] of [[100, 4, 2], [60, 2, 5], [200, 6, 1.5]]) {
    const s = river({ width, vBoat, vCurrent, heading: 0 });
    near(drift(s), vCurrent * crossingTime(s));
    near(drift(s), (vCurrent * width) / vBoat);
  }
  near(drift(initialState()), 50);
});

test("zero drift needs sinθ = v_current / v_boat", () => {
  const s = river({ vBoat: 4, vCurrent: 2 });
  near(headingForNoDrift(s), 30, 1e-9);
  near(drift({ ...s, heading: headingForNoDrift(s) }), 0, 1e-9);
  assert.ok(landsOpposite({ ...s, heading: 30 }));
  assert.ok(!landsOpposite({ ...s, heading: 25 }));
  // then the boat moves straight across at √(v12² − v23²)
  const v = velocities({ ...s, heading: 30 });
  near(v.v13.x, 0, 1e-9);
  near(v.v13.y, Math.sqrt(16 - 4));
  // with the slider's 1° steps the best heading still lands within the tolerance
  for (const [vBoat, vCurrent] of [[5, 1], [3, 2.5], [6, 4.5], [2, 1.5]]) {
    const best = Math.round(headingForNoDrift(river({ vBoat, vCurrent })));
    assert.ok(landsOpposite(river({ vBoat, vCurrent, heading: best })), `${vBoat} ${vCurrent}`);
  }
});

test("landing opposite is impossible when the current is not slower than the boat", () => {
  assert.ok(Number.isNaN(headingForNoDrift(river({ vBoat: 3, vCurrent: 3 }))));
  assert.ok(Number.isNaN(headingForNoDrift(river({ vBoat: 2, vCurrent: 5 }))));
  for (let heading = -45; heading <= 60; heading++) {
    assert.ok(drift(river({ vBoat: 3, vCurrent: 4, heading })) > 0);
    assert.ok(!landsOpposite(river({ vBoat: 3, vCurrent: 4, heading })));
  }
});

test("stepping the crossing lands at the predicted time and place", () => {
  const s = river({ width: 80, vBoat: 3, heading: 20, vCurrent: 2.5 });
  launch(s);
  let landed = 0;
  for (let i = 0; i < 120 * 60; i++) landed += step(s, 1 / 120) ? 1 : 0;
  assert.equal(landed, 1);
  assert.equal(s.sailing, false);
  near(s.t, crossingTime(s));
  const b = boat(s);
  assert.ok(b.landed);
  near(b.y, 80);
  near(b.x, drift(s));
  // half-way the boat is on the straight line from start to landing point
  const half = boat({ ...s, t: crossingTime(s) / 2 });
  near(half.x, drift(s) / 2);
  near(half.y, 40);
});

test("forged time cannot put the boat outside the river", () => {
  assert.equal(boat(river({ t: -50 })).y, 0);
  assert.equal(boat(river({ t: 1e9 })).y, 100);
  assert.ok(train({ ...initialState(), clock: 1e9 }).t <= LOOP);
});

test("1D: relative speeds add in the same direction and subtract in opposite directions", () => {
  near(train(river({ vTrain: 8, vWalk: 1.5 })).v13, 9.5);
  near(train(river({ vTrain: 8, vWalk: -1.5 })).v13, 6.5);
  near(train(river({ vTrain: 0, vWalk: -2 })).v13, -2);
  near(train(river({ vTrain: 1, vWalk: -1 })).v13, 0); // walker stays above the same spot on the ground
  const r = train(river({ vTrain: 6, vWalk: -2, clock: 3 }));
  near(r.s13, r.s12 + r.s23);
  near(r.s13, 12);
});

test("train clock loops", () => {
  const s = river({ mode: "train", clock: LOOP - 0.004 });
  step(s, 1 / 120);
  assert.ok(s.clock >= 0 && s.clock < 0.01);
});
