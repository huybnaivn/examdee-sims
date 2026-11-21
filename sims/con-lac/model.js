// Simple pendulum. Angle is measured from the vertical, in radians, positive to the right.

export const initialState = () => ({
  length: 1, // m
  mass: 1, // kg
  gravity: 9.81, // m/s^2
  damping: 0, // 1/s
  angle: 0.5, // rad
  omega: 0, // rad/s
  time: 0, // s
  measuredPeriod: 0, // s, 0 until one full swing has been timed
  lastCross: -1, // time of the previous left-to-right pass through the vertical
  showEnergy: true,
  showVectors: false,
});

const accel = (s, angle, omega) => -(s.gravity / s.length) * Math.sin(angle) - s.damping * omega;

/** Advance by dt seconds (RK4). Mutates and returns the state. */
export function step(s, dt) {
  const { angle: a, omega: w } = s;
  const k1a = w;
  const k1w = accel(s, a, w);
  const k2a = w + (dt / 2) * k1w;
  const k2w = accel(s, a + (dt / 2) * k1a, k2a);
  const k3a = w + (dt / 2) * k2w;
  const k3w = accel(s, a + (dt / 2) * k2a, k3a);
  const k4a = w + dt * k3w;
  const k4w = accel(s, a + dt * k3a, k4a);
  s.angle = a + (dt / 6) * (k1a + 2 * k2a + 2 * k3a + k4a);
  s.omega = w + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
  s.time += dt;
  if (a < 0 && s.angle >= 0) {
    if (s.lastCross >= 0) s.measuredPeriod = s.time - s.lastCross;
    s.lastCross = s.time;
  }
  return s;
}

/** Small-angle period, T = 2π√(l/g). */
export const smallAnglePeriod = s => 2 * Math.PI * Math.sqrt(s.length / s.gravity);

export function energy(s) {
  const speed = s.length * s.omega;
  const kinetic = 0.5 * s.mass * speed * speed;
  const potential = s.mass * s.gravity * s.length * (1 - Math.cos(s.angle));
  return { kinetic, potential, total: kinetic + potential };
}

/** Put the bob at `angle` and let go from rest. */
export function release(s, angle) {
  s.angle = angle;
  s.omega = 0;
  s.time = 0;
  s.measuredPeriod = 0;
  s.lastCross = -1;
  return s;
}
