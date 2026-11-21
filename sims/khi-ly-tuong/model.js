// Ideal gas as point particles in a 2-D box with a piston on the right.
//
// Scaled units ("đv"): the box is HEIGHT long units tall and volume / HEIGHT wide, so the volume V
// is the box area. Every particle has mass 1. Temperature is in kelvin and K is the Boltzmann
// constant in these units, so p = N·K·T / V. Pressure is force per unit wall length.
// In two dimensions a particle has two degrees of freedom, so its mean kinetic energy is K·T
// (not 3/2·K·T) and kinetic theory gives p·V = N·<½v²> = N·K·T.

export const K = 0.01;
export const HEIGHT = 2;
export const LIMITS = { n: [10, 200], temperature: [100, 600], volume: [2, 10] };
const TAU = 2; // s, averaging time of the collision pressure gauge

export const initialState = () => ({
  n: 100, // particles
  temperature: 300, // K
  volume: 6, // đv
  mode: "T", // which quantity is held constant: "T", "V" or "P"
  lockedPressure: 50, // đv, the pressure kept in mode "P"
  measuredPressure: 0, // đv, from wall collisions; 0 until the gas has run
});

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/** Equation of state. */
export const pressure = s => (s.n * K * s.temperature) / s.volume;
export const boxWidth = s => s.volume / HEIGHT;

export function setMode(s, mode) {
  s.mode = mode;
  s.lockedPressure = pressure(s);
  return s;
}

/** Call after the learner changed `key` ("n", "temperature" or "volume"). In the isobaric mode the
 *  other of V and T follows so that the pressure stays put (within the slider ranges). */
export function applyChange(s, key) {
  if (s.mode !== "P") return s;
  const p = s.lockedPressure > 0 ? s.lockedPressure : pressure(s);
  if (key === "volume") s.temperature = clamp((p * s.volume) / (s.n * K), LIMITS.temperature);
  s.volume = clamp((s.n * K * s.temperature) / p, LIMITS.volume);
  s.temperature = clamp((p * s.volume) / (s.n * K), LIMITS.temperature);
  s.lockedPressure = pressure(s); // differs from p only when both V and T hit their limits
  return s;
}

// Seeded so that tests and thumbnails are reproducible.
const mulberry32 = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Make the transient particle list s._p agree with n, temperature and volume. */
export function syncParticles(s) {
  const p = (s._p ??= []);
  const rand = (s._rand ??= mulberry32(7));
  const w = boxWidth(s);
  const resized = p.length !== s.n;
  p.length = Math.min(p.length, s.n);
  while (p.length < s.n) {
    // Maxwell–Boltzmann: each velocity component is normal with variance K·T / m
    const speed = Math.sqrt(-2 * K * s.temperature * Math.log(1 - rand()));
    const angle = 2 * Math.PI * rand();
    p.push({ x: rand() * w, y: rand() * HEIGHT, vx: speed * Math.cos(angle), vy: speed * Math.sin(angle) });
  }
  for (const q of p) if (q.x > w) q.x = w; // the piston pushed them in
  if (resized || s._T !== s.temperature) {
    // Thermostat: rescale so that <vx²> = <vy²> = K·T exactly, hence mean kinetic energy = K·T.
    // Per axis, because these particles never collide with each other: a random excess along one
    // axis would otherwise stay forever and bias the pressure on that pair of walls.
    const fx = Math.sqrt((K * s.temperature * p.length) / p.reduce((sum, q) => sum + q.vx * q.vx, 0));
    const fy = Math.sqrt((K * s.temperature * p.length) / p.reduce((sum, q) => sum + q.vy * q.vy, 0));
    for (const q of p) {
      q.vx *= fx;
      q.vy *= fy;
    }
    s._T = s.temperature;
  }
  return p;
}

/** Mean kinetic energy per particle, ½·m·v² with m = 1. */
export const meanKinetic = s => s._p.reduce((sum, q) => sum + (q.vx * q.vx + q.vy * q.vy) / 2, 0) / s._p.length;

/** Advance by dt seconds: free flight, elastic reflection off the walls, pressure gauge update. */
export function step(s, dt) {
  const p = syncParticles(s);
  if (s._weight === undefined) {
    // First step after a (re)start: let the gas run for 3 s so the gauge opens on a real average
    // instead of the noise of its first few collisions.
    s._weight = 0;
    for (let i = 0; i < 360; i++) step(s, 1 / 120);
  }
  const w = boxWidth(s);
  let impulse = 0; // momentum handed to the walls, Σ 2·m·|v⊥|
  for (const q of p) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.x < 0 || q.x > w) {
      q.x = q.x < 0 ? -q.x : 2 * w - q.x;
      q.vx = -q.vx;
      impulse += 2 * Math.abs(q.vx);
    }
    if (q.y < 0 || q.y > HEIGHT) {
      q.y = q.y < 0 ? -q.y : 2 * HEIGHT - q.y;
      q.vy = -q.vy;
      impulse += 2 * Math.abs(q.vy);
    }
  }
  // force per wall length, as a running average over about TAU seconds (bias-corrected at the start)
  const instant = impulse / (dt * 2 * (w + HEIGHT));
  const a = dt / TAU;
  s._avg = (s._avg ?? 0) + (instant - (s._avg ?? 0)) * a;
  s._weight = (s._weight ?? 0) + (1 - (s._weight ?? 0)) * a;
  s.measuredPressure = s._avg / s._weight;
  return s;
}
