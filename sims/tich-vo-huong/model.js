// Dot product of two plane vectors a = (a1; a2), b = (b1; b2) drawn from the origin.

export const LIMIT = 5; // each coordinate lies in [−LIMIT; LIMIT]
const EPS = 1e-9;

export const initialState = () => ({
  ax: 4,
  ay: 1,
  bx: 2,
  by: 3,
  showProjection: true,
});

export const dotV = (u, v) => u[0] * v[0] + u[1] * v[1];
export const len = u => Math.hypot(u[0], u[1]);
export const vecA = s => [s.ax, s.ay];
export const vecB = s => [s.bx, s.by];

/** a·b by coordinates: a1b1 + a2b2. */
export const dot = s => dotV(vecA(s), vecB(s));

/** Angle between a and b in degrees, NaN when either is the zero vector. */
export function angle(s) {
  const la = len(vecA(s));
  const lb = len(vecB(s));
  if (la < EPS || lb < EPS) return NaN;
  return (Math.acos(Math.max(-1, Math.min(1, dot(s) / (la * lb)))) * 180) / Math.PI;
}

/** a·b from the definition |a|·|b|·cos θ; 0 when a vector is zero (θ undefined). */
export function dotPolar(s) {
  const t = angle(s);
  return Number.isNaN(t) ? 0 : len(vecA(s)) * len(vecB(s)) * Math.cos((t * Math.PI) / 180);
}

/**
 * Projection of b on the line of a: signed length (a·b)/|a| and the vector ((a·b)/|a|²)·a.
 * Undefined (null) when a is the zero vector.
 */
export function projection(s) {
  const a = vecA(s);
  const la = len(a);
  if (la < EPS) return null;
  const k = dot(s) / (la * la);
  return { signed: dot(s) / la, length: Math.abs(dot(s)) / la, vector: [k * a[0], k * a[1]] };
}

/** "zero" if a vector is 0, else "acute" (a·b > 0), "right" (= 0) or "obtuse" (< 0). */
export function kind(s) {
  if (len(vecA(s)) < EPS || len(vecB(s)) < EPS) return "zero";
  const d = dot(s);
  return Math.abs(d) < EPS ? "right" : d > 0 ? "acute" : "obtuse";
}

/** Coordinates are snapped to 0.5 and kept in range; also guards forged state. */
export const snap = v => Math.max(-LIMIT, Math.min(LIMIT, Math.round(v * 2) / 2));
