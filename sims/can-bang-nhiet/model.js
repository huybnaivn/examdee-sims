// Heat balance between two bodies in an insulated container. No heat is lost to the surroundings
// and nothing melts or boils, so Q_tỏa = Q_thu and t = (m₁c₁t₁ + m₂c₂t₂)/(m₁c₁ + m₂c₂).

export const MATERIALS = { water: 4200, aluminium: 880, copper: 380, iron: 460, lead: 130, oil: 2000 }; // c, J/(kg·K)
// ponytail: one fixed time constant for every pair, so the animation always takes a few seconds.
// The real rate depends on contact area and conductivity; only the end point is physical.
export const TAU = 1.2; // s
export const EPS = 0.05; // °C, the two bodies count as equal below this difference

export const initialState = () => ({
  m1: 0.5, // kg
  t1: 100, // °C, initial
  mat1: "aluminium",
  m2: 1, // kg
  t2: 20, // °C, initial
  mat2: "water",
  time: 0, // s since the bodies were put in contact
  mixing: false, // heat is being exchanged
  done: false, // equilibrium reached
});

/** m·c of body 1 or 2, J/K. */
export const heatCapacity = (s, i) => s[`m${i}`] * MATERIALS[s[`mat${i}`]];

/** t = (m₁c₁t₁ + m₂c₂t₂)/(m₁c₁ + m₂c₂). */
export function equilibrium(s) {
  const c1 = heatCapacity(s, 1);
  const c2 = heatCapacity(s, 2);
  return (c1 * s.t1 + c2 * s.t2) / (c1 + c2);
}

/** Temperatures `time` seconds after contact: each closes in on the equilibrium exponentially. */
export function temperatures(s, time = s.time) {
  const teq = equilibrium(s);
  const f = Math.exp(-time / TAU);
  return { t1: teq + (s.t1 - teq) * f, t2: teq + (s.t2 - teq) * f };
}

/** Temperatures now: the initial ones before contact, exactly the equilibrium once it is reached. */
export function current(s) {
  if (s.done) return { t1: equilibrium(s), t2: equilibrium(s) };
  return s.mixing ? temperatures(s) : { t1: s.t1, t2: s.t2 };
}

/** Heat given off by the hotter body and taken in by the colder one so far, J (both ≥ 0). */
export function heat(s) {
  const now = current(s);
  const q1 = heatCapacity(s, 1) * (s.t1 - now.t1); // > 0 if body 1 cooled
  const q2 = heatCapacity(s, 2) * (s.t2 - now.t2);
  return { lost: Math.max(q1, q2, 0), gained: Math.max(-q1, -q2, 0), hot: s.t1 >= s.t2 ? 1 : 2 };
}

/** Heat exchanged by the time equilibrium is reached, Q = m₁c₁|t₁ − t|, J. */
export const totalHeat = s => heatCapacity(s, 1) * Math.abs(s.t1 - equilibrium(s));

/** Seconds the animation needs to bring the difference under EPS. */
export const duration = s => (Math.abs(s.t1 - s.t2) > EPS ? TAU * Math.log(Math.abs(s.t1 - s.t2) / EPS) : 0);

export function start(s) {
  s.time = 0;
  s.mixing = true;
  s.done = false;
  return s;
}

export function separate(s) {
  s.time = 0;
  s.mixing = false;
  s.done = false;
  return s;
}

export function step(s, dt) {
  if (!s.mixing) return s;
  s.time += dt;
  const now = temperatures(s);
  if (Math.abs(now.t1 - now.t2) < EPS) {
    s.mixing = false;
    s.done = true;
  }
  return s;
}
