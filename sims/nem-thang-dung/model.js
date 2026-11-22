// Vertical throw from a height y0 with initial velocity v0 (positive = upwards), y measured up from the ground.
// Without air:  v = v0 − g·t,  y = y0 + v0·t − ½·g·t².
// With air the resistance is taken proportional to the velocity, a = −g − k·v, which also has a closed form:
//   v = (v0 + g/k)·e^(−kt) − g/k,  y = y0 + (v0 + g/k)·(1 − e^(−kt))/k − g·t/k.
// So the whole flight is a function of the elapsed time and the state stores only the settings and `time`. SI units.

export const TOLERANCE = 0.25; // m, how close the top of the flight must come to the target height

export const initialState = () => {
  const s = {
    height: 5, // y0, m
    speed: 15, // v0, m/s, positive upwards
    gravity: 9.8, // m/s²
    air: false,
    drag: 0.3, // k, 1/s, used only when air is on
    target: 20, // m, height the learner tries to reach exactly
    showVectors: true,
    time: 0, // s since the throw
  };
  s.time = landTime(s); // start on a finished throw: the whole flight is on screen
  return s;
};

const k = s => (s.air ? Math.max(0, s.drag) : 0);
const g = s => Math.max(0.1, s.gravity);

/** Velocity (m/s, positive upwards) t seconds after the throw, ignoring the ground. */
export function velocity(s, t) {
  const c = k(s);
  if (!c) return s.speed - g(s) * t;
  return (s.speed + g(s) / c) * Math.exp(-c * t) - g(s) / c;
}

/** Height above the ground (m) t seconds after the throw, ignoring the ground. */
export function position(s, t) {
  const c = k(s);
  const y0 = Math.max(0, s.height);
  if (!c) return y0 + s.speed * t - 0.5 * g(s) * t * t;
  return y0 + ((s.speed + g(s) / c) * (1 - Math.exp(-c * t))) / c - (g(s) * t) / c;
}

/** Time to the highest point: v0/g without air; 0 when thrown downwards. */
export function topTime(s) {
  if (s.speed <= 0) return 0;
  const c = k(s);
  return c ? Math.log(1 + (c * s.speed) / g(s)) / c : s.speed / g(s);
}

/** Greatest height above the ground: y0 + v0²/(2g) without air. */
export const maxHeight = s => position(s, topTime(s));

/** Time of reaching the ground: the positive root of y0 + v0·t − ½·g·t² = 0 without air. */
export function landTime(s) {
  const y0 = Math.max(0, s.height);
  if (!k(s)) return (s.speed + Math.sqrt(s.speed * s.speed + 2 * g(s) * y0)) / g(s);
  if (y0 === 0 && s.speed <= 0) return 0;
  // After the top the height only decreases: bracket the root, then bisect.
  let lo = topTime(s);
  let hi = lo + 1;
  while (position(s, hi) > 0) hi = lo + 2 * (hi - lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (position(s, mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Speed (m/s, ≥ 0) at the moment of reaching the ground. */
export const impactSpeed = s => Math.abs(velocity(s, landTime(s)));

/** Where the object is at time t of the flight (it stays on the ground after landing). */
export function at(s, t) {
  const time = Math.min(Math.max(0, t), landTime(s));
  const landed = t >= landTime(s);
  return { time, y: landed ? 0 : Math.max(0, position(s, time)), v: velocity(s, time), landed };
}

/** True when the highest point of this throw is within TOLERANCE of the target height. */
export const hitsTarget = s => s.speed > 0 && Math.abs(maxHeight(s) - s.target) <= TOLERANCE;
