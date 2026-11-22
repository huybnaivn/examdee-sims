// A charged particle between two parallel plates (uniform field, vacuum, gravity neglected).
// The upper plate is the positive one, so E points down: electrons are pushed up, protons down.
// SI units inside; the state keeps the textbook-sized numbers (V, cm, 10⁶ m/s).

export const PARTICLES = {
  electron: { q: -1.602e-19, m: 9.109e-31 }, // C, kg
  proton: { q: 1.602e-19, m: 1.673e-27 },
};
export const LENGTH = 10; // cm, length of the plates along the entry direction
export const DURATION = 2; // s on screen for crossing the plates (or the gap, when released from rest)
export const GRAZE = 0.9; // "just past the plate edge": leaves with a deflection of at least 90 % of d/2

export const initialState = () => ({
  particle: "electron", // "electron" | "proton"
  mode: "across", // "across": enters midway, v₀ ⊥ E; "rest": released at rest from the plate that repels it
  voltage: 60, // V, between the plates
  gap: 4, // cm, plate separation d
  speedE: 10, // 10⁶ m/s, entry speed of the electron
  speedP: 2.5, // 10⁵ m/s, entry speed of the proton
  time: DURATION, // s on screen since firing; starts on a finished flight so the first picture shows the path
});

/** E = U/d (V/m). */
export const fieldStrength = (U, d) => U / d;
/** a = |q|E/m (m/s²). */
export const acceleration = (q, m, E) => (Math.abs(q) * E) / m;
/** Deflection on leaving plates of length L: y = |q|EL²/(2mv₀²) (m). */
export const deflection = (q, m, E, L, v0) => (Math.abs(q) * E * L * L) / (2 * m * v0 * v0);
/** tan θ of the exit direction: |q|EL/(mv₀²). */
export const exitTan = (q, m, E, L, v0) => (Math.abs(q) * E * L) / (m * v0 * v0);
/** Speed after falling through a voltage U from rest: v = √(2|q|U/m) (m/s). */
export const speedFromRest = (q, m, U) => Math.sqrt((2 * Math.abs(q) * U) / m);

/** Entry speed in m/s for the chosen particle. */
export const entrySpeed = s => (s.particle === "proton" ? s.speedP * 1e5 : s.speedE * 1e6);

/**
 * Everything about the flight that the current settings decide.
 * across: { v0, hit, y (deflection at the end, ≤ d/2), x (where it ends), tan, angle (°), tEnd, vEnd }
 * rest:   { rest: true, tEnd (∞ when U = 0), vEnd }
 * tRef is the physical time shown as DURATION seconds on screen.
 */
export function flight(s) {
  const p = PARTICLES[s.particle] ?? PARTICLES.electron;
  const U = Math.max(0, s.voltage);
  const d = Math.max(0.1, s.gap) / 100;
  const L = LENGTH / 100;
  const E = fieldStrength(U, d);
  const a = acceleration(p.q, p.m, E);
  const base = { p, U, d, L, E, a, force: Math.abs(p.q) * E, sign: p.q < 0 ? 1 : -1 };
  if (s.mode === "rest") {
    const tEnd = a > 0 ? Math.sqrt((2 * d) / a) : Infinity;
    return { ...base, rest: true, tEnd, tRef: tEnd, vEnd: speedFromRest(p.q, p.m, U) };
  }
  const v0 = Math.max(1, entrySpeed(s));
  const full = deflection(p.q, p.m, E, L, v0);
  const hit = full > d / 2; // it meets a plate before the end when the deflection would exceed d/2
  const tExit = L / v0;
  const tEnd = hit ? Math.sqrt(d / a) : tExit;
  const tan = exitTan(p.q, p.m, E, L, v0);
  return {
    ...base, rest: false, v0, hit, tEnd, tRef: tExit,
    y: hit ? d / 2 : full,
    x: hit ? v0 * tEnd : L,
    tan, angle: (Math.atan(tan) * 180) / Math.PI,
    vEnd: Math.hypot(v0, a * tEnd),
  };
}

/** Physical time (s) of the picture; a forged `time` cannot leave the flight. */
export function clock(s, f = flight(s)) {
  if (!Number.isFinite(f.tRef)) return 0;
  const t = (Math.max(0, Number.isFinite(s.time) ? s.time : 0) / DURATION) * f.tRef;
  return Math.min(t, f.tEnd);
}

export const finished = (s, f = flight(s)) => Number.isFinite(f.tEnd) && clock(s, f) >= f.tEnd * (1 - 1e-9);

/** Position (m; x along the plates from their entry edge, y up from the mid-line) and velocity (m/s) at time t. */
export function position(f, t) {
  const y = 0.5 * f.a * t * t;
  if (f.rest) return { x: f.L / 2, y: f.sign * (y - f.d / 2), vx: 0, vy: f.sign * f.a * t };
  return { x: f.v0 * t, y: f.sign * y, vx: f.v0, vy: f.sign * f.a * t };
}

/** Leaves without touching, close to the end of the plate. */
export const grazing = f => !f.rest && !f.hit && f.y >= GRAZE * (f.d / 2);

export function step(s, dt) {
  s.time = Math.min(DURATION, Math.max(0, s.time) + dt);
  return s;
}
