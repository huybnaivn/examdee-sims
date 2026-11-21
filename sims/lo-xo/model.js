// A mass hanging on a vertical spring. y is the stretch of the spring (m), positive downwards,
// y = 0 where the spring has its natural length. v is positive downwards.

export const AMPLITUDE_MAX = 0.2; // m, how far the mass may be pulled from equilibrium

/** Stretch at equilibrium, Δl₀ = m·g/k. */
export const equilibrium = s => (s.mass * s.gravity) / s.k;

/** Period of the undamped oscillation, T = 2π√(m/k). */
export const period = s => 2 * Math.PI * Math.sqrt(s.mass / s.k);

/** Hold the mass at displacement x from equilibrium (positive down) and let go from rest. */
export function release(s, x) {
  s.x0 = x;
  s.y = equilibrium(s) + x;
  s.v = 0;
  s.time = 0;
  s.measuredPeriod = 0;
  s.lastCross = -1;
  return s;
}

export const initialState = () =>
  release(
    {
      mass: 0.5, // kg
      k: 20, // N/m, spring constant
      damping: 0, // N·s/m, drag force = -damping·v
      gravity: 9.81, // m/s^2
      x0: 0, // m, displacement the mass was released from
      y: 0, // m, current stretch
      v: 0, // m/s
      time: 0, // s since release
      measuredPeriod: 0, // s, 0 until one full oscillation has been timed
      lastCross: -1, // time of the previous downward pass through equilibrium
      showEnergy: true,
    },
    0.15
  );

// m·a = m·g − k·y − b·v
const accel = (s, y, v) => s.gravity - (s.k * y + s.damping * v) / s.mass;

const SUBSTEPS = 4; // keeps RK4 energy drift negligible for the stiffest spring / lightest mass

/** Advance by dt seconds (RK4). Mutates and returns the state. */
export function step(s, dt) {
  const before = s.y - equilibrium(s);
  const h = dt / SUBSTEPS;
  for (let i = 0; i < SUBSTEPS; i++) {
    const { y, v } = s;
    const k1y = v;
    const k1v = accel(s, y, v);
    const k2y = v + (h / 2) * k1v;
    const k2v = accel(s, y + (h / 2) * k1y, k2y);
    const k3y = v + (h / 2) * k2v;
    const k3v = accel(s, y + (h / 2) * k2y, k3y);
    const k4y = v + h * k3v;
    const k4v = accel(s, y + h * k3y, k4y);
    s.y = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    s.v = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
  const after = s.y - equilibrium(s);
  if (before < 0 && after >= 0) {
    const cross = s.time + (dt * -before) / (after - before); // interpolate inside the step
    if (s.lastCross >= 0) s.measuredPeriod = cross - s.lastCross;
    s.lastCross = cross;
  }
  s.time += dt;
  return s;
}

/**
 * Kinetic, elastic and gravitational energy (J). Gravitational energy is measured from the
 * lowest point the mass can be pulled to, so it is never negative on screen.
 */
export function energy(s) {
  const kinetic = 0.5 * s.mass * s.v * s.v;
  const elastic = 0.5 * s.k * s.y * s.y;
  const gravitational = s.mass * s.gravity * (equilibrium(s) + AMPLITUDE_MAX - s.y);
  return { kinetic, elastic, gravitational, total: kinetic + elastic + gravitational };
}
