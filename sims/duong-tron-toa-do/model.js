// Circle (C): (x − a)² + (y − b)² = R², i.e. x² + y² − 2ax − 2by + c = 0 with c = a² + b² − R²,
// and its position relative to a line Δ: Ax + By + C = 0.

export const R_MIN = 0.5;
export const R_MAX = 6;
const EPS = 1e-9;

export const initialState = () => ({
  mode: "circle", // "circle": centre and radius, "expanded": from x² + y² − 2ax − 2by + c = 0, "line": with a line Δ
  a: 1, // centre I(a; b)
  b: 2,
  R: 3, // radius (the input in "circle" and "line" modes)
  c: -4, // constant term (the input in "expanded" mode)
  phi: 0.6, // angle (rad) of the point M on the circle that sets the radius
  A: 3, // Δ: Ax + By + C = 0
  B: 4,
  C: -6,
});

/** c of the expanded form for centre (a; b) and radius R. */
export const expandedC = (a, b, R) => a * a + b * b - R * R;

/**
 * x² + y² − 2ax − 2by + c = 0 is a circle only when a² + b² − c > 0. Returns { r2, R } where
 * r2 = a² + b² − c and R = √r2 (null when r2 ≤ 0: one point if r2 = 0, no point if r2 < 0).
 */
export function fromExpanded(a, b, c) {
  const r2 = a * a + b * b - c;
  return { r2, R: r2 > EPS ? Math.sqrt(r2) : null };
}

/** The circle shown: in "expanded" mode it comes from c, otherwise c comes from R. R is null if not a circle. */
export function circle(s) {
  if (s.mode === "expanded") return { a: s.a, b: s.b, c: s.c, ...fromExpanded(s.a, s.b, s.c) };
  const R = Math.min(R_MAX, Math.max(R_MIN, s.R));
  return { a: s.a, b: s.b, c: expandedC(s.a, s.b, R), r2: R * R, R };
}

/** Distance from (x; y) to Ax + By + C = 0, or null when A = B = 0 (not a line). */
export function distance(A, B, C, x, y) {
  const n = Math.hypot(A, B);
  return n > 0 ? Math.abs(A * x + B * y + C) / n : null;
}

/**
 * Position of Δ relative to the circle: d = d(I, Δ); "cut" (d < R, two points), "tangent"
 * (d = R, one point H), "apart" (d > R). H is the foot of the perpendicular from I to Δ.
 * Returns null when Δ is not a line or there is no circle.
 */
export function relative(cir, A, B, C) {
  const d = distance(A, B, C, cir.a, cir.b);
  if (d === null || cir.R === null) return null;
  const n2 = A * A + B * B;
  const k = (A * cir.a + B * cir.b + C) / n2;
  const H = { x: cir.a - k * A, y: cir.b - k * B };
  const R = cir.R;
  if (Math.abs(d - R) <= EPS * Math.max(1, R)) return { d, H, kind: "tangent", points: [H] };
  if (d > R) return { d, H, kind: "apart", points: [] };
  const t = Math.sqrt(R * R - d * d) / Math.sqrt(n2); // along the direction (−B; A)
  return { d, H, kind: "cut", points: [{ x: H.x - t * B, y: H.y + t * A }, { x: H.x + t * B, y: H.y - t * A }] };
}

/** C that makes Ax + By + C = 0 tangent to the circle: the one nearer to `C0`. */
export function tangentC(cir, A, B, C0) {
  const n = Math.hypot(A, B);
  const base = -(A * cir.a + B * cir.b);
  const c1 = base + cir.R * n;
  const c2 = base - cir.R * n;
  return Math.abs(c1 - C0) <= Math.abs(c2 - C0) ? c1 : c2;
}
