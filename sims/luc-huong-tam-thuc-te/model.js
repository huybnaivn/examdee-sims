// Centripetal force in three everyday situations. SI units, g = 9.8 m/s².
//
// flat   – a car on a level curve: static friction is the centripetal force, m·v²/R ≤ μ·m·g.
// banked – a car on a curve banked at angle α: normal force and weight (plus friction, if any).
// bucket – a bucket of water swung in a vertical circle on a light rigid arm: at the top the
//          water stays in only if v²/R ≥ g. The speed along the circle follows energy conservation.
//
// Documented simplification for a skidding car: it is drawn on a circle of radius
// R·(v/v_limit)², the curve the largest available sideways force can still bend it into.
// For the flat road that is exactly v²/(μ·g) (taking kinetic friction equal to the static maximum).

export const G = 9.8;
export const CAR_MASS = 1000; // kg
export const WATER_MASS = 1; // kg
export const GOAL_BAND = 0.03; // "found the maximum safe speed": within 3 % below the limit

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const rad = deg => (deg * Math.PI) / 180;

export const initialState = () => ({
  scene: "flat", // "flat" | "banked" | "bucket"
  speed: 12, // m/s, the car
  radius: 50, // m, radius of the curve
  mu: 0.6, // coefficient of static friction between tyres and road
  bank: 20, // degrees, banking angle
  vTop: 4, // m/s, speed of the bucket at the top
  rope: 1, // m, radius of the vertical circle
  dist: 40, // m, distance the car has gone along its path in this lap
  phi: 0.9, // rad, bucket position measured from the top, in the direction of motion
});

/** Centripetal acceleration a = v²/R. */
export const centripetalAccel = (v, R) => (v * v) / R;

/** Flat curve: v_max = √(μ·g·R). */
export const maxFlatSpeed = (mu, R) => Math.sqrt(mu * G * R);

/** Banked curve, speed that needs no friction: v0 = √(g·R·tanα). */
export const idealBankSpeed = (R, bankDeg) => Math.sqrt(G * R * Math.tan(rad(bankDeg)));

/**
 * Banked curve at speed v: normal force N and the static friction f that circular motion needs.
 * f > 0 points down the slope (towards the inside of the curve), f < 0 up the slope.
 */
export function bankForces(v, R, bankDeg, m = CAR_MASS) {
  const a = rad(bankDeg);
  const ac = centripetalAccel(v, R);
  return { normal: m * (G * Math.cos(a) + ac * Math.sin(a)), friction: m * (ac * Math.cos(a) - G * Math.sin(a)) };
}

/** Banked curve with friction: the range of speeds that hold. max is Infinity when μ·tanα ≥ 1. */
export function bankLimits(mu, R, bankDeg) {
  const t = Math.tan(rad(bankDeg));
  return {
    min: t > mu ? Math.sqrt((G * R * (t - mu)) / (1 + mu * t)) : 0,
    max: mu * t < 1 - 1e-9 ? Math.sqrt((G * R * (t + mu)) / (1 - mu * t)) : Infinity,
  };
}

/** Vertical circle: least speed at the top, v_min = √(g·R). */
export const minTopSpeed = R => Math.sqrt(G * R);

/** Speed of the bucket at angle phi from the top (energy conservation). */
export const bucketSpeed = (vTop, R, phi) => Math.sqrt(vTop * vTop + 2 * G * R * (1 - Math.cos(phi)));

/** Force of the bucket's bottom on the water, towards the centre; negative means the water leaves. */
export const bucketNormal = (vTop, R, phi, m = WATER_MASS) => m * (centripetalAccel(bucketSpeed(vTop, R, phi), R) - G * Math.cos(phi));

/**
 * Everything the view shows.
 * holds: the motion stays on its circle (car grips / water stays in).
 * slip: +1 the car slides outwards, −1 inwards, 0 it holds.
 * limit: the speed limit that matters (v_max for the cars, v_min for the bucket).
 */
export function analyse(s) {
  if (s.scene === "bucket") {
    const limit = minTopSpeed(s.rope);
    const accel = centripetalAccel(s.vTop, s.rope);
    return { speed: s.vTop, radius: s.rope, accel, needed: WATER_MASS * accel, limit, holds: s.vTop >= limit, slip: 0, normalTop: bucketNormal(s.vTop, s.rope, 0) };
  }
  const accel = centripetalAccel(s.speed, s.radius);
  const needed = CAR_MASS * accel;
  if (s.scene === "banked") {
    const { min, max } = bankLimits(s.mu, s.radius, s.bank);
    const forces = bankForces(s.speed, s.radius, s.bank);
    const slip = s.speed > max ? 1 : s.speed < min ? -1 : 0;
    return { speed: s.speed, radius: s.radius, accel, needed, limit: max, min, ideal: idealBankSpeed(s.radius, s.bank), holds: slip === 0, slip, ...forces };
  }
  const limit = maxFlatSpeed(s.mu, s.radius);
  const holds = s.speed <= limit;
  return { speed: s.speed, radius: s.radius, accel, needed, available: s.mu * CAR_MASS * G, limit, holds, slip: holds ? 0 : 1 };
}

/** The learner has set the largest speed that still holds (within GOAL_BAND below the limit). */
export function atMaxSafeSpeed(s) {
  if (s.scene === "bucket") return false;
  const a = analyse(s);
  return a.holds && Number.isFinite(a.limit) && a.speed >= (1 - GOAL_BAND) * a.limit;
}

/** Radius of the circle the car actually follows (see the note at the top). */
export function pathRadius(s) {
  const a = analyse(s);
  if (a.slip === 0) return s.radius;
  const ref = a.slip > 0 ? a.limit : a.min;
  return ref > 0 ? s.radius * (s.speed / ref) ** 2 : Infinity;
}

/** Length of one animation lap: the whole circle when it holds, half the skid circle otherwise. */
export function lapLength(s) {
  const rc = pathRadius(s);
  if (rc === s.radius) return 2 * Math.PI * s.radius;
  return Math.min(Math.PI * rc, 4 * s.radius);
}

/**
 * Top view, curve centre at the origin, the car enters at (0, −R) heading in +x.
 * Returns position (m), heading (rad, from +x, counter-clockwise) and distance from the centre.
 */
export function carPosition(s) {
  const rc = pathRadius(s);
  const d = clamp(s.dist, 0, lapLength(s));
  if (!Number.isFinite(rc)) return { x: d, y: -s.radius, heading: 0, r: Math.hypot(d, s.radius) };
  const a = d / rc;
  const x = rc * Math.sin(a);
  const y = -s.radius + rc * (1 - Math.cos(a));
  return { x, y, heading: a, r: Math.hypot(x, y) };
}

export function step(s, dt) {
  if (s.scene === "bucket") {
    const phi = clamp(s.phi, 0, 2 * Math.PI);
    s.phi = (phi + (bucketSpeed(s.vTop, s.rope, phi) / s.rope) * dt) % (2 * Math.PI);
  } else {
    const lap = lapLength(s);
    s.dist = (clamp(s.dist, 0, lap) + s.speed * dt) % lap;
  }
  return s;
}
