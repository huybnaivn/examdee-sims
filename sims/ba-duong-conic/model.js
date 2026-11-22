// The three conics in canonical position (grade 10). Pure maths, no DOM.
//   ellipse   x²/a² + y²/b² = 1 (a > b > 0), foci (±c; 0), c² = a² − b², MF₁ + MF₂ = 2a
//   hyperbola x²/a² − y²/b² = 1,             foci (±c; 0), c² = a² + b², |MF₁ − MF₂| = 2a
//   parabola  y² = 2px (p > 0), focus (p/2; 0), directrix x = −p/2, MF = d(M, Δ)

export const CURVES = ["ellipse", "hyperbola", "parabola"]; // index = code used in events
export const STEP = 0.5; // grid of a, b and p
export const X_MAX = 9; // the pencil point stays inside |x| ≤ X_MAX (parabola: x ≤ X_MAX + 4)
export const Y_MAX = 6;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const initialState = () => ({
  curve: "ellipse",
  a: 5,
  b: 3,
  p: 2,
  angle: 50, // ellipse: parameter of the pencil point M = (a cos t; b sin t), degrees
  my: 3, // hyperbola and parabola: y-coordinate of M
  left: false, // hyperbola: M on the left branch
  challenge: false,
  tx: 3, // challenge: the point the curve must pass through
  ty: 2,
});

/** Keep the state consistent after `key` changed: an ellipse needs a > b, and M stays in view. */
export function normalize(s, key) {
  if (s.curve === "ellipse") {
    // in a challenge a is given, so b gives way; otherwise the slider being moved wins
    if (key === "b" && !s.challenge) s.a = Math.max(s.a, s.b + STEP);
    else s.b = Math.min(s.b, s.a - STEP);
  }
  s.my = clamp(s.my, -yLimit(s), yLimit(s));
  return s;
}

/** The parameters actually used, safe against a forged state. */
export function shape(s) {
  if (s.curve === "parabola") {
    const p = clamp(s.p, 0.5, 4);
    return { p, c: p / 2, e: 1 };
  }
  const a = clamp(s.a, 1.5, 6);
  const b = s.curve === "ellipse" ? clamp(s.b, 1, a - STEP) : clamp(s.b, 1, 5);
  const c = Math.sqrt(s.curve === "ellipse" ? a * a - b * b : a * a + b * b);
  return { a, b, c, e: c / a };
}

/** Largest |y| of M that keeps it in the drawn window (hyperbola and parabola). */
export function yLimit(s) {
  const g = shape(s);
  if (s.curve === "hyperbola") return Math.min(Y_MAX, g.b * Math.sqrt((X_MAX / g.a) ** 2 - 1));
  if (s.curve === "parabola") return Math.min(Y_MAX, Math.sqrt(2 * g.p * (X_MAX + 4)));
  return Y_MAX;
}

/** The pencil point M on the current curve. */
export function pointM(s) {
  const g = shape(s);
  if (s.curve === "ellipse") {
    const t = (s.angle * Math.PI) / 180;
    return { x: g.a * Math.cos(t), y: g.b * Math.sin(t) };
  }
  const y = clamp(s.my, -yLimit(s), yLimit(s));
  if (s.curve === "hyperbola") return { x: (s.left ? -1 : 1) * g.a * Math.sqrt(1 + (y * y) / (g.b * g.b)), y };
  return { x: (y * y) / (2 * g.p), y };
}

/**
 * Distances that define the curve at point (x; y).
 * Ellipse and hyperbola: d1 = MF₁ (left focus), d2 = MF₂. Parabola: d1 = MF, d2 = d(M, Δ).
 */
export function distances(s, m = pointM(s)) {
  const g = shape(s);
  if (s.curve === "parabola") return { d1: Math.hypot(m.x - g.c, m.y), d2: Math.abs(m.x + g.c) };
  return { d1: Math.hypot(m.x + g.c, m.y), d2: Math.hypot(m.x - g.c, m.y) };
}

/** Left side minus right side of the canonical equation at (x; y); 0 on the curve. */
export function residual(s, x, y) {
  const g = shape(s);
  if (s.curve === "ellipse") return (x * x) / (g.a * g.a) + (y * y) / (g.b * g.b) - 1;
  if (s.curve === "hyperbola") return (x * x) / (g.a * g.a) - (y * y) / (g.b * g.b) - 1;
  return y * y - 2 * g.p * x;
}

/** Where a pointer at (x; y) puts the pencil point: the state keys to change. */
export function project(s, x, y) {
  const g = shape(s);
  if (s.curve === "ellipse") {
    const deg = (Math.atan2(y / g.b, x / g.a) * 180) / Math.PI;
    return { angle: Math.round(deg < 0 ? deg + 360 : deg) % 360 };
  }
  const my = Math.round(clamp(y, -yLimit(s), yLimit(s)) * 10) / 10;
  return s.curve === "hyperbola" ? { my, left: x < 0 } : { my };
}

/** The challenge point, safe against a forged state. */
export const target = s => ({ x: clamp(s.tx, -13, 13), y: clamp(s.ty, -Y_MAX, Y_MAX) });

/** True when the current curve passes through the challenge point. */
export function throughTarget(s) {
  const t = target(s);
  return Math.abs(residual(s, t.x, t.y)) < 1e-9;
}

/**
 * A challenge for `curve`: a point with short decimal coordinates that lies on exactly one curve
 * of the family when a is kept fixed (ellipse, hyperbola) and b, or p, moves on its 0.5 grid.
 * Returns the state keys to set (b or p start away from the answer) and the answer.
 */
export function newChallenge(curve, rand = Math.random) {
  const pick = list => list[Math.floor(rand() * list.length)];
  const sign = () => (rand() < 0.5 ? -1 : 1);
  const start = answer => (answer === 1 ? 2 : 1);
  if (curve === "parabola") {
    // (2p; ±2p) and (p/2; ±p) lie on y² = 2px; keep the point inside the window
    const [p, kx, ky] = pick([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].flatMap(p => [[p, 2, 2], [p, 0.5, 1]]).filter(([p, , ky]) => ky * p <= Y_MAX));
    return { set: { p: start(p), tx: kx * p, ty: sign() * ky * p }, answer: p };
  }
  if (curve === "hyperbola") {
    // x = a/cos t, y = b·tan t with (1/cos t; tan t) = (5/4; 3/4) or (5/3; 4/3)
    const [a, b, kx, ky] = pick([
      ...[2, 4].flatMap(a => [1, 2, 3, 4].map(b => [a, b, 1.25, 0.75])),
      [3, 1.5, 5 / 3, 4 / 3],
      [3, 3, 5 / 3, 4 / 3],
    ]);
    return { set: { a, b: start(b), tx: sign() * Math.round(kx * a * 100) / 100, ty: sign() * Math.round(ky * b * 100) / 100 }, answer: b };
  }
  // ellipse: (cos t; sin t) = (0.6; 0.8) or (0.8; 0.6)
  const a = pick([3, 3.5, 4, 4.5, 5, 5.5, 6]);
  const b = 1 + STEP * Math.floor(rand() * ((a - STEP - 1) / STEP + 1));
  const [kx, ky] = pick([[0.6, 0.8], [0.8, 0.6]]);
  return { set: { a, b: start(b), tx: sign() * Math.round(kx * a * 100) / 100, ty: sign() * Math.round(ky * b * 100) / 100 }, answer: b };
}
