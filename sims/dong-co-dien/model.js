// DC motor: a rectangular coil of N turns on an axle in a uniform field B, fed by a battery through
// a commutator (or, with the commutator off, through fixed connections that never reverse the current).
// Seen along the axle. SI units.
//
// θ is the angle from B to the coil's normal n = (cos θ, sin θ); B points +x (N pole left, S pole right).
// The two active sides (length l, along the axle) sit at ±(a/2)·(−sin θ, cos θ).
// Side 1 carries current k·I out of the screen (k = ±1), side 2 the same current into the screen.
// Force on each side: F = N·B·I·l (perpendicular to B and to the side). Torque about the axle:
//   M = −k·N·B·I·S·sin θ,  S = l·a.
// Without a commutator k is fixed, so M pulls the normal back to B: the coil swings about θ = 0 and stops there.
// The commutator reverses the current in the coil each time the coil passes θ = 0 or π (coil plane ⟂ B),
// k = c·sign(sin θ), so M = −c·N·B·I·S·|sin θ| never changes sign and the coil keeps turning one way.

export const SIDE = 0.05; // l, m: length of each active side
export const WIDTH = 0.04; // a, m: distance between the two sides
export const AREA = SIDE * WIDTH; // S, m²
export const INERTIA = 5e-3; // J, kg·m²: rotor with a flywheel, chosen so the motion is easy to follow
export const FRICTION = 4e-3; // b, N·m·s: viscous friction torque −b·ω

export const initialState = () => ({
  current: 2, // A, magnitude
  currentDir: 1, // +1 or −1: polarity of the battery
  field: 0.2, // T, magnitude
  fieldDir: 1, // +1: N pole on the left; −1: magnets swapped
  turns: 50,
  commutator: true,
  theta: 1.2, // rad
  omega: 0, // rad/s, positive counter-clockwise
  time: 0, // s
  revStart: 0, // s, time when the current revolution began
  revAngle: 0, // rad turned since revStart
  revImpulse: 0, // N·m·s, ∫M dt since revStart
  lastPeriod: 0, // s, 0 until a full revolution has been completed
  lastTorque: 0, // N·m, average torque over that revolution
});

const sgn = x => (x < 0 ? -1 : 1);
const unit = x => (x === -1 ? -1 : 1); // forged directions fall back to +1

/** Sign of the current in side 1 (out of the screen = +1). */
export function sideCurrent(s, theta = s.theta) {
  const c = unit(s.currentDir);
  return s.commutator ? c * sgn(Math.sin(theta)) : c;
}

/** Force on one side, N = N·B·I·l. */
export const sideForce = s => s.turns * s.field * s.current * SIDE;

/** Peak torque N·B·I·S. */
export const peakTorque = s => s.turns * s.field * s.current * AREA;

/** Electromagnetic torque at angle θ (N·m, positive counter-clockwise). */
export function torque(s, theta = s.theta) {
  return -sideCurrent(s, theta) * unit(s.fieldDir) * peakTorque(s) * Math.sin(theta);
}

/**
 * Force vectors on the two sides, in screen-independent x/y (y up), and their positions (unit: a/2).
 * F = k·F₀·(ẑ × B̂) for side 1 and the opposite for side 2; ẑ × x̂ = ŷ.
 */
export function forces(s) {
  const k = sideCurrent(s) * unit(s.fieldDir);
  const F = sideForce(s);
  const p1 = { x: -Math.sin(s.theta), y: Math.cos(s.theta) };
  return [
    { pos: p1, fx: 0, fy: k * F, out: sideCurrent(s) > 0 },
    { pos: { x: -p1.x, y: -p1.y }, fx: 0, fy: -k * F, out: sideCurrent(s) < 0 },
  ];
}

const accel = (s, theta, omega) => (torque(s, theta) - FRICTION * omega) / INERTIA;

/** Semi-implicit Euler step; dt is small (1/120 s). Returns the revolution just completed, or null. */
export function step(s, dt) {
  // keys without a control: keep forged values in range
  s.revAngle = Math.max(-2 * Math.PI, Math.min(2 * Math.PI, s.revAngle));
  s.revStart = Math.min(s.revStart, s.time);
  const M = torque(s);
  s.omega += accel(s, s.theta, s.omega) * dt;
  s.omega = Math.max(-200, Math.min(200, s.omega));
  const dTheta = s.omega * dt;
  s.theta = (((s.theta + dTheta) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  s.time += dt;
  s.revAngle += dTheta;
  s.revImpulse += M * dt;
  if (Math.abs(s.revAngle) >= 2 * Math.PI) {
    const period = s.time - s.revStart;
    const rev = { period, torque: s.revImpulse / period, direction: sgn(s.revAngle) };
    s.lastPeriod = period;
    s.lastTorque = rev.torque;
    s.revStart = s.time;
    s.revAngle -= sgn(s.revAngle) * 2 * Math.PI;
    s.revImpulse = 0;
    return rev;
  }
  return null;
}

/** Forget the revolution being timed (after a parameter change). */
export function restartTiming(s) {
  s.revStart = s.time;
  s.revAngle = 0;
  s.revImpulse = 0;
  s.lastPeriod = 0;
  s.lastTorque = 0;
}

/** Steady speed with the commutator: the average driving torque (2/π)·NBIS equals the friction b·ω. */
export const steadyOmega = s => ((2 / Math.PI) * peakTorque(s)) / FRICTION;
