import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, grow, auxin, auxinShift, shootOutcomes, changed, advance, finish, norm, timeOf, tiltOf,
  seesLight, hasTip, WOBBLE, T_END, K_LIGHT, K_GRAVITY, V_SHOOT, V_ROOT, L_SHOOT, L_ROOT, TIPS,
} from "./model.js";

const make = extra => ({ ...initialState(), ...extra });
const end = extra => grow(make(extra), T_END);
const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ""} expected ${expected} ± ${tol}, got ${actual}`);
const length = points => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
const deg = rad => (rad * 180) / Math.PI;

test("the shoot bends towards one-sided light (positive phototropism)", () => {
  const right = end({ lightAngle: 90 });
  const left = end({ lightAngle: -90 });
  assert.ok(right.shootAngle > 30, `bends right: ${right.shootAngle}`);
  assert.ok(right.shoot.at(-1)[0] > 1, "the tip has moved to the lit side");
  assert.ok(left.shootAngle < -30, `bends left: ${left.shootAngle}`);
  // even light or light from straight above: the upright shoot stays upright
  near(end({ oneSided: false }).shootAngle, 0, 0.5);
  near(end({ lightAngle: 0 }).shootAngle, 0, 0.5);
});

test("the final shoot direction balances the pull of light and gravity", () => {
  // bending stops where K_LIGHT·sin(light − θ) = K_GRAVITY·sin θ
  for (const light of [30, 60, 90, 120, -45]) {
    const expected = deg(Math.atan2(K_LIGHT * Math.sin((light * Math.PI) / 180), K_GRAVITY + K_LIGHT * Math.cos((light * Math.PI) / 180)));
    near(end({ lightAngle: light }).shootAngle, expected, 0.5, `light ${light}:`);
  }
  near(end({ lightAngle: 90 }).shootAngle, 56.31, 0.5);
});

test("the root grows downwards whatever the pot's position (positive gravitropism)", () => {
  near(end({}).rootAngle, 0, 0.5);
  for (const tilt of [45, 90, 135]) {
    const g = end({ tilt, oneSided: false });
    near(g.rootAngle, 0, 3, `tilt ${tilt}: root`);
    assert.ok(g.root.at(-1)[1] < g.root[1][1], "the root tip ends lower than it started");
    near(g.shootAngle, 0, 3, `tilt ${tilt}: shoot turns up`);
  }
  // light does not steer the root in this model
  assert.deepEqual(end({ tilt: 90, lightAngle: -90 }).root, end({ tilt: 90, oneSided: false }).root);
});

test("upside down: shoot and root leave the unstable position and turn round", () => {
  const g = end({ tilt: 180, oneSided: false });
  assert.ok(Math.abs(g.shootAngle) < 45, `shoot has turned from 180 towards up: ${g.shootAngle}`);
  assert.ok(Math.abs(g.rootAngle) < 45, `root has turned from 180 towards down: ${g.rootAngle}`);
  assert.ok(g.root.every(p => p[1] >= 0 && Math.abs(p[0]) < 2.2), "the root stays inside the upturned pot");
});

test("removing the tip stops growth and bending of the shoot", () => {
  const cut = end({ tip: "removed" });
  near(cut.shootAngle, WOBBLE, 1e-9); // only the initial deviation
  near(length(cut.shoot), L_SHOOT * 0.75, 1e-9);
  near(end({ tip: "removed", tilt: 90 }).shootAngle, 90 + WOBBLE, 1e-9); // no gravitropism of the shoot either
  near(cut.rootAngle, 0, 0.5); // the root still grows down
  assert.equal(hasTip(make({ tip: "removed" })), false);
});

test("an opaque cap on the tip stops phototropism; a clear cap or a band below the tip does not", () => {
  near(end({ tip: "cap" }).shootAngle, 0, 0.5);
  assert.equal(seesLight(make({ tip: "cap" })), false);
  const intact = end({}).shootAngle;
  near(end({ tip: "clear" }).shootAngle, intact, 1e-9);
  near(end({ tip: "band" }).shootAngle, intact, 1e-9);
  // the capped shoot still grows and still answers gravity
  near(length(end({ tip: "cap" }).shoot), L_SHOOT + V_SHOOT * T_END, 1e-9);
  near(end({ tip: "cap", tilt: 90 }).shootAngle, 0, 3);
  // an unknown treatment counts as intact
  near(end({ tip: "glitter" }).shootAngle, intact, 1e-9);
});

test("a clinostat removes the gravity response (and evens out one-sided light)", () => {
  const s = make({ clinostat: true, tilt: 0 });
  assert.equal(tiltOf(s), 90); // the pot lies on its side on the clinostat
  const g = grow(s, T_END);
  near(g.shootAngle, 90 + WOBBLE, 1e-9); // straight along the axis: no bending at all
  near(g.rootAngle, -90 - WOBBLE, 1e-9);
  assert.equal(auxinShift(s, "shoot", 90), 0);
  assert.equal(auxinShift(s, "root", 270), 0);
  assert.deepEqual(auxin(s, "shoot", 90), { cw: 0.5, ccw: 0.5 });
  // the same pot lying still does respond
  const still = end({ tilt: 90 });
  assert.ok(Math.abs(norm(still.shootAngle - 90)) > 20);
  assert.ok(Math.abs(still.rootAngle) < 3);
});

test("auxin is higher on the shaded side, and on the lower side", () => {
  // upright shoot, light from the right: the left (counter-clockwise) flank is shaded
  const a = auxin(make({ lightAngle: 90 }), "shoot", 0);
  near(a.ccw, 0.65, 1e-12);
  near(a.cw, 0.35, 1e-12);
  assert.ok(a.ccw > a.cw);
  // light from the left: the right flank is shaded
  assert.ok(auxin(make({ lightAngle: -90 }), "shoot", 0).cw > 0.5);
  // even light, upright: equal
  near(auxin(make({ oneSided: false }), "shoot", 0).cw, 0.5, 1e-12);
  // horizontal shoot pointing right: the clockwise flank is the lower one
  near(auxin(make({ oneSided: false }), "shoot", 90).cw, 0.6, 1e-12);
  // horizontal root pointing left (270°): its counter-clockwise flank is the lower one
  near(auxin(make({ oneSided: false }), "root", 270).ccw, 0.6, 1e-12);
  // shares always add up to 1 and stay within 0..1
  for (let theta = -180; theta <= 180; theta += 15) {
    for (const lightAngle of [-120, -45, 0, 90]) {
      const x = auxin(make({ lightAngle }), "shoot", theta);
      near(x.cw + x.ccw, 1, 1e-12);
      assert.ok(x.cw >= 0.25 - 1e-12 && x.cw <= 0.75 + 1e-12);
    }
  }
});

test("organs grow at a constant speed", () => {
  near(length(grow(make({}), 0).shoot), L_SHOOT, 1e-9);
  near(length(grow(make({}), 30).shoot), L_SHOOT + V_SHOOT * 30, 1e-9);
  near(length(end({}).root), L_ROOT + V_ROOT * T_END, 1e-9);
  // the pot (rim half-width 2,2 cm at the bottom, 3,8 cm deep) contains the root of an upright or lying plant
  assert.ok(Math.abs(end({}).root.at(-1)[1]) < 3.8);
  assert.ok(Math.abs(end({ tilt: 90 }).root.at(-1)[1]) < 3);
});

test("time is clamped and a finished run restarts", () => {
  assert.equal(timeOf({ time: -5 }), 0);
  assert.equal(timeOf({ time: 1e9 }), T_END);
  assert.equal(timeOf({ time: NaN }), 0);
  assert.deepEqual(grow(make({}), 1e9), grow(make({}), T_END));
  assert.deepEqual(grow(make({}), -3), grow(make({}), 0));
  const s = make({});
  assert.equal(advance(s, 1), false); // was at the end: starts again
  assert.equal(s.time, 1);
  assert.equal(advance(s, 100), true);
  assert.equal(s.time, T_END);
});

test("outcome categories of the shoot", () => {
  assert.deepEqual(shootOutcomes(make({})), ["light"]);
  assert.deepEqual(shootOutcomes(make({ oneSided: false })), ["straight"]);
  assert.deepEqual(shootOutcomes(make({ tip: "cap" })), ["straight"]);
  assert.deepEqual(shootOutcomes(make({ tip: "clear" })), ["light"]);
  assert.deepEqual(shootOutcomes(make({ tip: "band" })), ["light"]);
  assert.deepEqual(shootOutcomes(make({ tip: "removed" })), ["none"]);
  assert.deepEqual(shootOutcomes(make({ tilt: 90, oneSided: false })), ["up"]);
  assert.deepEqual(shootOutcomes(make({ tilt: 90, tip: "cap" })), ["up"]);
  assert.deepEqual(shootOutcomes(make({ clinostat: true })), ["straight"]);
  // lying pot, light from above: towards the light is also upwards
  assert.deepEqual(shootOutcomes(make({ tilt: 90, lightAngle: 0 })), ["light", "up"]);
  // every experiment the controls allow has at least one outcome
  for (const tip of TIPS) {
    for (const clinostat of [false, true]) {
      for (const oneSided of [false, true]) {
        for (let tilt = 0; tilt <= 180; tilt += 15) {
          for (let lightAngle = -105; lightAngle <= 105; lightAngle += 15) {
            const s = make({ tip, clinostat, oneSided, tilt, lightAngle });
            assert.ok(shootOutcomes(s).length > 0, JSON.stringify(s));
          }
        }
      }
    }
  }
});

test("a prediction counts only for an experiment whose outcome has not been seen", () => {
  const s = make({});
  // the initial picture already shows this outcome: a "prediction" now is not judged
  s.predict = "light";
  advance(s, T_END);
  assert.deepEqual([finish(s).predicted, s.verdict], [false, ""]);
  // new conditions, correct prediction
  s.tilt = 90;
  s.oneSided = false;
  changed(s);
  assert.deepEqual([s.time, s.tested, s.verdict], [0, false, ""]);
  s.predict = "up";
  assert.equal(advance(s, T_END), true);
  const r = finish(s);
  assert.deepEqual([r.predicted, r.correct, s.verdict, s.tested], [true, true, "correct", true]);
  near(r.shootAngle, 0, 3);
  // running the same experiment again keeps the verdict and does not judge again
  advance(s, T_END);
  assert.deepEqual([finish(s).predicted, s.verdict], [false, "correct"]);
  // new conditions, wrong prediction
  s.tip = "removed";
  changed(s);
  s.predict = "up";
  advance(s, T_END);
  assert.deepEqual([finish(s).correct, s.verdict], [false, "wrong"]);
  // no prediction, no verdict
  changed(s);
  s.predict = "";
  advance(s, T_END);
  assert.deepEqual([finish(s).predicted, s.verdict], [false, ""]);
});

test("initial state shows a finished experiment with light from the right", () => {
  const s = initialState();
  assert.equal(s.time, T_END);
  assert.ok(grow(s, s.time).shootAngle > 50);
});
