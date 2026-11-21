// Sum of two harmonic oscillations of the same direction and frequency:
//   x₁ = A₁cos(ωt + φ₁), x₂ = A₂cos(ωt + φ₂), x = x₁ + x₂ = A·cos(ωt + φ).
// Units: cm, s, rad. Phases are stored in degrees so the sliders land on exact fractions of π.

export const OMEGA = Math.PI; // rad/s, shared by both oscillations (T = 2 s)
export const PERIOD = (2 * Math.PI) / OMEGA;

export const initialState = () => ({
  a1: 4, // cm
  a2: 3, // cm
  phi1Deg: 0,
  phi2Deg: 60,
  time: 0, // s
  showParts: true, // draw x₁ and x₂ on the graph
});

const rad = deg => (deg * Math.PI) / 180;

export const x1 = (s, t = s.time) => s.a1 * Math.cos(OMEGA * t + rad(s.phi1Deg));
export const x2 = (s, t = s.time) => s.a2 * Math.cos(OMEGA * t + rad(s.phi2Deg));

/** Resultant amplitude (cm) and initial phase (rad, in (−π, π]); phase is NaN when the two cancel. */
export function resultant(s) {
  const X = s.a1 * Math.cos(rad(s.phi1Deg)) + s.a2 * Math.cos(rad(s.phi2Deg));
  const Y = s.a1 * Math.sin(rad(s.phi1Deg)) + s.a2 * Math.sin(rad(s.phi2Deg));
  const amplitude = Math.hypot(X, Y);
  return amplitude < 1e-9 ? { amplitude: 0, phase: NaN } : { amplitude, phase: Math.atan2(Y, X) };
}

export const x = (s, t = s.time) => {
  const r = resultant(s);
  return r.amplitude ? r.amplitude * Math.cos(OMEGA * t + r.phase) : 0;
};

/** Δφ = φ₂ − φ₁ in degrees, wrapped to (−180, 180]. */
export const deltaDeg = s => {
  const d = (((s.phi2Deg - s.phi1Deg) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
};

/** "cung-pha", "nguoc-pha", "vuong-pha" or "" for a general phase difference. */
export function classify(s) {
  const d = Math.abs(deltaDeg(s));
  if (d < 1e-6) return "cung-pha";
  if (Math.abs(d - 180) < 1e-6) return "nguoc-pha";
  if (Math.abs(d - 90) < 1e-6) return "vuong-pha";
  return "";
}

export function step(s, dt) {
  s.time += dt;
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
