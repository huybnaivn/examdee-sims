import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, torque, forces, sideForce, peakTorque, steadyOmega, SIDE, AREA, FRICTION } from "./model.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1e-12, Math.abs(b)), `${a} ≠ ${b}`);
const run = (s, seconds, dt = 1 / 120) => {
  const revs = [];
  for (let k = 0; k < Math.round(seconds / dt); k++) {
    const r = step(s, dt);
    if (r) revs.push(r);
  }
  return revs;
};

test("F = N·B·I·l on each side; the two forces are equal and opposite, perpendicular to B", () => {
  for (const [current, field, turns] of [[2, 0.2, 50], [5, 0.5, 200], [0.5, 0.05, 10]]) {
    const s = { ...initialState(), current, field, turns };
    near(sideForce(s), turns * field * current * SIDE);
    const [f1, f2] = forces(s);
    near(Math.abs(f1.fy), sideForce(s));
    assert.equal(f1.fx, 0); // B is along x, so the force is along y
    assert.equal(f1.fy, -f2.fy);
    assert.notEqual(f1.out, f2.out); // current goes out on one side and back in on the other
  }
});

test("left-hand rule: current out of the screen with B to the right gives an upward force", () => {
  const s = { ...initialState(), commutator: false, theta: Math.PI / 2 }; // side 1 on the left
  const [f1] = forces(s);
  assert.ok(f1.out && f1.fy > 0);
  const flipped = forces({ ...s, fieldDir: -1 })[0];
  assert.ok(flipped.fy < 0);
});

test("torque M = N·B·I·S·sin θ: largest when the coil plane is along B, zero when it is perpendicular", () => {
  const s = { ...initialState(), commutator: false };
  near(peakTorque(s), s.turns * s.field * s.current * AREA);
  for (const theta of [0.3, 1, 2, 2.8, 4, 5.5]) near(torque({ ...s, theta }), -peakTorque(s) * Math.sin(theta));
  near(Math.abs(torque({ ...s, theta: Math.PI / 2 })), peakTorque(s));
  assert.ok(Math.abs(torque({ ...s, theta: 0 })) < 1e-15);
  // doubling I, B or N doubles the torque
  for (const key of ["current", "field", "turns"]) near(torque({ ...s, theta: 1, [key]: s[key] * 2 }), 2 * torque({ ...s, theta: 1 }));
});

test("with the commutator the torque never changes sign: M = N·B·I·S·|sin θ|", () => {
  const s = initialState();
  for (let theta = 0.05; theta < 2 * Math.PI; theta += 0.1) {
    const M = torque({ ...s, theta });
    assert.ok(M <= 0);
    near(-M, peakTorque(s) * Math.abs(Math.sin(theta)));
  }
});

test("without the commutator the coil swings about θ = 0 and stops there", () => {
  const s = { ...initialState(), commutator: false, theta: 2 };
  let crossings = 0;
  let prev = s.theta;
  for (let k = 0; k < 120 * 30; k++) {
    step(s, 1 / 120);
    const wrapped = Math.atan2(Math.sin(s.theta), Math.cos(s.theta));
    if (Math.sign(wrapped) !== Math.sign(Math.atan2(Math.sin(prev), Math.cos(prev)))) crossings++;
    prev = s.theta;
  }
  assert.ok(crossings >= 2, "it oscillates first");
  assert.ok(Math.abs(Math.sin(s.theta)) < 1e-3 && Math.cos(s.theta) > 0, `stops at θ = 0, got ${s.theta}`);
  assert.ok(Math.abs(s.omega) < 1e-3);
  assert.equal(s.lastPeriod, 0); // never completes a revolution
});

test("with the commutator the coil keeps turning one way; the steady speed balances friction", () => {
  const s = initialState();
  const revs = run(s, 40);
  assert.ok(revs.length > 10);
  assert.ok(revs.every(r => r.direction === -1)); // clockwise for the default polarity
  const last = revs.at(-1);
  // over one steady revolution the driving torque balances the friction: M_tb = b·2π/T
  near(-last.torque, (FRICTION * 2 * Math.PI) / last.period, 0.01);
  // and the mean speed is close to (2/π)·NBIS / b
  near((2 * Math.PI) / last.period, steadyOmega(s), 0.03);
});

test("reversing the current or the field reverses the rotation; reversing both does not", () => {
  const dir = patch => run({ ...initialState(), ...patch }, 20).at(-1).direction;
  assert.equal(dir({}), -1);
  assert.equal(dir({ currentDir: -1 }), 1);
  assert.equal(dir({ fieldDir: -1 }), 1);
  assert.equal(dir({ currentDir: -1, fieldDir: -1 }), -1);
});

test("a coil left at the dead point does not start by itself", () => {
  const s = { ...initialState(), theta: 0 };
  run(s, 5);
  assert.equal(s.theta, 0);
});
