// Harmonic oscillation x = A·cos(ωt + φ) as the projection of uniform circular motion.
// Units: cm, s, rad. The initial phase is stored in degrees so the slider lands on exact fractions of π.

export const initialState = () => ({
  amplitude: 5, // cm
  omega: 2, // rad/s
  phaseDeg: 60, // initial phase φ, degrees
  time: 0, // s
  showX: true,
  showV: true,
  showA: true,
});

/** Phase ωt + φ in radians (also the angle of the reference point M on the circle). */
export const phase = (s, t = s.time) => s.omega * t + (s.phaseDeg * Math.PI) / 180;
export const position = (s, t = s.time) => s.amplitude * Math.cos(phase(s, t));
export const velocity = (s, t = s.time) => -s.amplitude * s.omega * Math.sin(phase(s, t));
export const acceleration = (s, t = s.time) => -s.omega * s.omega * position(s, t);

export const period = s => (2 * Math.PI) / s.omega;
export const vMax = s => s.amplitude * s.omega;
export const aMax = s => s.amplitude * s.omega * s.omega;

/** Advance time. Returns true on the step in which the first full period completes. */
export function step(s, dt) {
  const before = s.time;
  s.time += dt;
  const T = period(s);
  return before < T && s.time >= T;
}

/** An angle in degrees written as a fraction of π, e.g. 60 → "π/3", −90 → "−π/2". */
export function piFrac(deg) {
  const n = Math.round(deg / 15);
  if (Math.abs(deg - n * 15) > 1e-9) return `${(deg / 180).toFixed(2).replace(".", ",").replace("-", "−")}π`;
  if (n === 0) return "0";
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(Math.abs(n), 12);
  const num = Math.abs(n) / g;
  const den = 12 / g;
  return `${n < 0 ? "−" : ""}${num === 1 ? "" : num}π${den === 1 ? "" : "/" + den}`;
}
