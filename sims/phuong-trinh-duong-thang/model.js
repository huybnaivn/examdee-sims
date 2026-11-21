// Lines in the coordinate plane. A line is { a, b, c } for ax + by + c = 0, with a point P0 on it,
// a direction vector u and a normal vector n = (a; b).

export const LIMIT = 6; // points lie in [−LIMIT; LIMIT]
export const VLIMIT = 5; // vector coordinates lie in [−VLIMIT; VLIMIT]
const EPS = 1e-9;

export const initialState = () => ({
  mode: "two-points", // how d₁ is given: "two-points", "point-direction", "point-normal"
  x1: -3, y1: -1, // point A on d₁
  x2: 3, y2: 2, // point B on d₁ (two-points)
  ux: 2, uy: 1, // direction vector u of d₁ (point-direction)
  nx: 1, ny: -2, // normal vector n of d₁ (point-normal)
  showSecond: true,
  x3: -2, y3: 4, // d₂ through C and D
  x4: 2, y4: -2,
  showDistance: false,
  mx: 3, my: 4, // point M for the distance to d₁
});

const gcd = (p, q) => (q ? gcd(q, p % q) : Math.abs(p));

/**
 * Scale (a, b, c) to the simplest form: integers without a common factor when the inputs are
 * multiples of 0.25, and the first non-zero of a, b positive.
 */
export function normalize(a, b, c) {
  let v = [a, b, c].map(x => x * 4);
  if (v.every(x => Math.abs(x - Math.round(x)) < 1e-7)) {
    v = v.map(Math.round);
    const g = v.reduce((p, q) => gcd(p, q), 0) || 1;
    v = v.map(x => x / g);
  } else v = [a, b, c];
  const sign = Math.abs(v[0]) > EPS ? Math.sign(v[0]) : Math.sign(v[1]);
  return v.map(x => (x * sign) || 0); // "|| 0" turns −0 into 0
}

/**
 * Line through P0 with normal n (u = (−n₂; n₁)), or with a given direction u. null when n is zero.
 * u and n are kept as given (for the parametric form); a, b, c are simplified.
 */
export function fromPointNormal(p, n, u = [-n[1], n[0]]) {
  if (Math.hypot(n[0], n[1]) < EPS) return null;
  const [a, b, c] = normalize(n[0], n[1], -(n[0] * p[0] + n[1] * p[1]));
  return { a, b, c, p, n, u };
}
export const fromPointDirection = (p, u) => fromPointNormal(p, [u[1], -u[0]], u);
export const fromTwoPoints = (p, q) => fromPointDirection(p, [q[0] - p[0], q[1] - p[1]]);

/** d₁ from the state, by the chosen mode. */
export function line1(s) {
  const A = [s.x1, s.y1];
  if (s.mode === "point-direction") return fromPointDirection(A, [s.ux, s.uy]);
  if (s.mode === "point-normal") return fromPointNormal(A, [s.nx, s.ny]);
  return fromTwoPoints(A, [s.x2, s.y2]);
}
export const line2 = s => fromTwoPoints([s.x3, s.y3], [s.x4, s.y4]);

/** Slope form y = kx + m, or null for a vertical line (b = 0: no slope). */
export const slopeForm = l => (Math.abs(l.b) < EPS ? null : { k: -l.a / l.b, m: -l.c / l.b });

/** Point at parameter t of x = x0 + u1·t, y = y0 + u2·t. */
export const at = (l, t) => [l.p[0] + l.u[0] * t, l.p[1] + l.u[1] * t];

/** Value of ax + by + c at a point (0 on the line). */
export const value = (l, q) => l.a * q[0] + l.b * q[1] + l.c;

/** Distance from M to the line: |ax₀ + by₀ + c| / √(a² + b²). */
export const distance = (l, q) => Math.abs(value(l, q)) / Math.hypot(l.a, l.b);

/** Foot of the perpendicular from q to the line. */
export function foot(l, q) {
  const k = value(l, q) / (l.a * l.a + l.b * l.b);
  return [q[0] - k * l.a, q[1] - k * l.b];
}

/** Angle between two lines from their normals: cos φ = |a₁a₂ + b₁b₂| / (|n₁|·|n₂|), in degrees, 0 to 90. */
export function angleBetween(l1, l2) {
  const cos = Math.abs(l1.a * l2.a + l1.b * l2.b) / (Math.hypot(l1.a, l1.b) * Math.hypot(l2.a, l2.b));
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
}

/**
 * Relative position by Cramer's rule on a₁x + b₁y = −c₁, a₂x + b₂y = −c₂.
 * { kind: "intersect", point, perpendicular } | { kind: "parallel" } | { kind: "coincident" }
 */
export function relation(l1, l2) {
  const D = l1.a * l2.b - l2.a * l1.b;
  const Dx = -l1.c * l2.b + l2.c * l1.b;
  const Dy = -l1.a * l2.c + l2.a * l1.c;
  const scale = Math.hypot(l1.a, l1.b) * Math.hypot(l2.a, l2.b);
  if (Math.abs(D) < EPS * scale) {
    return Math.abs(Dx) < EPS * scale && Math.abs(Dy) < EPS * scale ? { kind: "coincident", D, Dx, Dy } : { kind: "parallel", D, Dx, Dy };
  }
  return { kind: "intersect", D, Dx, Dy, point: [Dx / D, Dy / D], perpendicular: Math.abs(l1.a * l2.a + l1.b * l2.b) < EPS * scale };
}

// ---------- text (decimal comma, Vietnamese minus) ----------
export function num(n, digits = 2) {
  if (Math.abs(n) < 0.5 * 10 ** -digits) n = 0;
  return n.toLocaleString("vi-VN", { maximumFractionDigits: digits }).replace("-", "−");
}
// "+ 3x", "− x", "" for 0; the first term carries no "+".
function term(coef, name, first) {
  if (Math.abs(coef) < EPS) return "";
  const abs = Math.abs(coef);
  const body = name && Math.abs(abs - 1) < EPS ? name : `${num(abs)}${name}`;
  if (first) return (coef < 0 ? "−" : "") + body;
  return ` ${coef < 0 ? "−" : "+"} ${body}`;
}
function sum(parts) {
  let out = "";
  for (const [coef, name] of parts) out += term(coef, name, out === "");
  return out || "0";
}

/** "3x − 2y + 1 = 0" */
export const generalText = l => `${sum([[l.a, "x"], [l.b, "y"], [l.c, ""]])} = 0`;
/** ["x = 1 + 2t", "y = 2 − t"] */
export const parametricText = l => [`x = ${sum([[l.p[0], ""], [l.u[0], "t"]])}`, `y = ${sum([[l.p[1], ""], [l.u[1], "t"]])}`];
/** "y = 1,5x + 0,5", or "x = 2" for a vertical line. */
export function slopeText(l) {
  const f = slopeForm(l);
  return f ? `y = ${sum([[f.k, "x"], [f.m, ""]])}` : `x = ${num(-l.c / l.a)}`;
}
