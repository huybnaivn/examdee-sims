// Lever on a central pivot with one weight on each side.
// Side 1 is left of the pivot, side 2 is right. The beam itself is uniform and pivoted at its
// centre, so its own weight has no moment.
// Angle is the beam tilt in radians, positive when the right end is down (clockwise).

export const G = 10; // m/s^2, the usual textbook value ("lấy g = 10 m/s²")
export const MAX_TILT = 0.2; // rad, where the beam meets its stop
export const BEAM_HALF = 2.1; // m, half-length of the beam
const TOLERANCE = 1e-6; // kg·m, absorbs floating-point crumbs from 0.05 m steps

export const initialState = () => ({
  m1: 4, // kg
  d1: 1, // m from the pivot
  m2: 2, // kg
  d2: 1.5, // m from the pivot
  angle: -MAX_TILT, // rad
  balanced: false, // true once the beam has settled level with M1 = M2
});

/** Moments about the pivot in N·m. `net` > 0 turns the beam clockwise (right end down). */
export function moments(s) {
  const left = s.m1 * G * s.d1;
  const right = s.m2 * G * s.d2;
  return { left, right, net: right - left };
}

/** Rule of moments: balance if and only if m1·d1 = m2·d2. */
export const isBalanced = s => Math.abs(s.m1 * s.d1 - s.m2 * s.d2) < TOLERANCE;

/** -1 tilts left, +1 tilts right, 0 stays level. */
export const tiltDirection = s => (isBalanced(s) ? 0 : Math.sign(moments(s).net));

// ponytail: the tilt eases toward its resting position instead of integrating rigid-body
// dynamics. An ideal balanced lever is in neutral equilibrium at any angle, so "returns to
// level" is a display convention either way. Swap in torque/inertia if the motion itself
// ever becomes the lesson.
export function step(s, dt) {
  const target = tiltDirection(s) * MAX_TILT;
  s.angle += (target - s.angle) * (1 - Math.exp(-6 * dt));
  s.balanced = isBalanced(s) && Math.abs(s.angle) < 0.005;
  return s;
}
