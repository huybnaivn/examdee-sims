// A small ball (point mass, sliding without rolling) on the parabolic track y = K·x².
// State: x is the horizontal position (m), v the signed speed along the track (m/s, positive
// toward +x), heat the energy turned into thermal energy by friction (J).
//
// Along the track:  dv/dt = -g·sinθ - μ·(N/m)·sign(v),  dx/dt = v·cosθ
// with tanθ = y' = 2Kx and the normal force N = m·(g·cosθ + v²·κ), κ = y''·cos³θ.

export const K = 0.25; // 1/m
export const height = x => K * x * x;

/** Put the ball at the release height on the given side (-1 left, +1 right), at rest. */
export function release(s, side = -1) {
  s.x = side * Math.sqrt(s.releaseHeight / K);
  s.v = 0;
  s.heat = 0;
  s.time = 0;
  return s;
}

export function initialState() {
  // At rest at the release height: "Đặt lại" must not land mid-descent.
  return release({
    releaseHeight: 3, // m
    mass: 1, // kg
    gravity: 9.81, // m/s^2
    friction: false,
    mu: 0.1, // kinetic friction coefficient, used only when friction is on
    x: 0,
    v: 0,
    heat: 0,
    time: 0, // s since release
    showVectors: true,
  });
}

// Time derivatives of [x, v, heat]. `dir` is the direction of motion, fixed over one step.
function derivs(s, x, v, dir, mu) {
  const p = 2 * K * x;
  const cos = 1 / Math.sqrt(1 + p * p);
  const n = (s.gravity + v * v * cos * cos * 2 * K) * cos; // N / m
  return [v * cos, -s.gravity * p * cos - mu * n * dir, s.mass * mu * n * v * dir];
}

function rk4(s, h, dir, mu) {
  const { x, v } = s;
  const k1 = derivs(s, x, v, dir, mu);
  const k2 = derivs(s, x + (h / 2) * k1[0], v + (h / 2) * k1[1], dir, mu);
  const k3 = derivs(s, x + (h / 2) * k2[0], v + (h / 2) * k2[1], dir, mu);
  const k4 = derivs(s, x + h * k3[0], v + h * k3[1], dir, mu);
  const d = i => (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return [x + d(0), v + d(1), s.heat + d(2)];
}

/** Advance by dt seconds. Mutates and returns the state. */
export function step(s, dt) {
  s.time += dt;
  const mu = s.friction ? s.mu : 0;
  let dir = Math.sign(s.v);
  if (dir === 0) {
    const slope = 2 * K * s.x;
    if (Math.abs(slope) <= mu) return s; // held by friction, or resting at the bottom
    dir = -Math.sign(slope);
  }
  let next = rk4(s, dt, dir, mu);
  // Friction cannot reverse the motion: if v changed sign, the ball stopped inside this step.
  const stopped = mu > 0 && next[1] * dir < 0;
  if (stopped) next = rk4(s, (dt * s.v) / (s.v - next[1]), dir, mu);
  [s.x, s.v, s.heat] = next;
  if (stopped) s.v = 0;
  return s;
}

export function energy(s) {
  const kinetic = 0.5 * s.mass * s.v * s.v;
  const potential = s.mass * s.gravity * height(s.x); // reference level: bottom of the track
  const mechanical = kinetic + potential;
  return { kinetic, potential, mechanical, thermal: s.heat, total: mechanical + s.heat };
}

/** Speed at the bottom after a frictionless descent from the release height: √(2·g·h). */
export const bottomSpeed = s => Math.sqrt(2 * s.gravity * s.releaseHeight);
