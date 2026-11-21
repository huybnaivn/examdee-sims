// Two carts on a straight frictionless track, positive direction to the right.
// Cart 1 starts on the left of cart 2. The whole run is a closed form of the elapsed time,
// so the state only stores the settings and `time`. SI units.

export const CART = 1; // m, length of each cart
export const X1 = -2; // m, initial centre of cart 1
export const X2 = 2; // m, initial centre of cart 2
const GAP = X2 - X1 - CART; // m between the facing ends at t = 0
const AFTER = 2; // s shown after the collision
const NO_HIT = 3; // s shown when the carts never meet

export const initialState = () => {
  const s = {
    m1: 2, // kg
    v1: 2, // m/s
    m2: 1,
    v2: -1,
    restitution: 0.5, // e: 1 elastic … 0 perfectly inelastic
    time: 0, // s since the start of the run
  };
  s.time = endTime(s); // start on a finished run: before and after are both on screen
  return s;
};

/**
 * Velocities after a head-on collision with coefficient of restitution e:
 * momentum is conserved and the separation speed is e times the approach speed.
 */
export function collide(m1, v1, m2, v2, e) {
  const total = m1 * v1 + m2 * v2;
  return {
    v1: (total - m2 * e * (v1 - v2)) / (m1 + m2),
    v2: (total + m1 * e * (v1 - v2)) / (m1 + m2),
  };
}

/** Momentum (kg·m/s) and kinetic energy (J) of each cart and in total. */
export function quantities(m1, v1, m2, v2) {
  const p1 = m1 * v1;
  const p2 = m2 * v2;
  const k1 = 0.5 * m1 * v1 * v1;
  const k2 = 0.5 * m2 * v2 * v2;
  return { v1, v2, p1, p2, p: p1 + p2, k1, k2, k: k1 + k2 };
}

/** When the carts touch; Infinity if cart 1 is not catching up with cart 2. */
export const collisionTime = s => (s.v1 > s.v2 ? GAP / (s.v1 - s.v2) : Infinity);

export const endTime = s => (collisionTime(s) < Infinity ? collisionTime(s) + AFTER : NO_HIT);

export const before = s => quantities(s.m1, s.v1, s.m2, s.v2);

/** Quantities after the collision, or null if the carts never collide. */
export function after(s) {
  if (collisionTime(s) === Infinity) return null;
  const v = collide(s.m1, s.v1, s.m2, s.v2, s.restitution);
  return quantities(s.m1, v.v1, s.m2, v.v2);
}

/** Cart centres and velocities at time t. */
export function at(s, t) {
  const tc = collisionTime(s);
  if (t <= tc) return { x1: X1 + s.v1 * t, x2: X2 + s.v2 * t, v1: s.v1, v2: s.v2, collided: false };
  const v = collide(s.m1, s.v1, s.m2, s.v2, s.restitution);
  return {
    x1: X1 + s.v1 * tc + v.v1 * (t - tc),
    x2: X2 + s.v2 * tc + v.v2 * (t - tc),
    v1: v.v1,
    v2: v.v2,
    collided: true,
  };
}

/** Stretch of track [min, max] the carts cover during the whole run (for scaling the view). */
export function extent(s) {
  const tc = collisionTime(s);
  const times = tc < Infinity ? [0, tc, endTime(s)] : [0, endTime(s)];
  const xs = times.flatMap(t => [at(s, t).x1 - CART / 2, at(s, t).x2 + CART / 2]);
  return { min: Math.min(...xs), max: Math.max(...xs) };
}
