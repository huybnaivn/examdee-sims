// Circumscribed and inscribed circles of a triangle ABC (coordinates in grid units).
//
// Notation as in the grade 9 textbooks: a = BC, b = CA, c = AB, p = (a + b + c) / 2 (half perimeter),
// S the area, O and R the circumcentre and circumradius, I and r the incentre and inradius.
//   O = intersection of the perpendicular bisectors, R = OA = OB = OC = abc / (4S)
//   I = intersection of the angle bisectors, r = distance from I to each side = S / p
//   Euler: OI² = R² − 2Rr

export const initialState = () => ({
  ax: -5, ay: -3,
  bx: 4, by: -3,
  cx: 2, cy: 3,
  showCircum: true, // perpendicular bisectors and the circumscribed circle
  showIn: true, // angle bisectors and the inscribed circle
});

export const POSITION = { inside: 0, onSide: 1, outside: 2 };

const dist = (P, Q) => Math.hypot(P[0] - Q[0], P[1] - Q[1]);
export const points = s => [[s.ax, s.ay], [s.bx, s.by], [s.cx, s.cy]];

/** Every quantity of the triangle; `degenerate` is true when A, B, C are (almost) collinear. */
export function solve(s) {
  const [A, B, C] = points(s);
  const a = dist(B, C);
  const b = dist(C, A);
  const c = dist(A, B);
  const cross = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
  const S = Math.abs(cross) / 2;
  const p = (a + b + c) / 2;
  const scale = Math.max(a, b, c, 1e-9);
  if (S < 1e-6 * scale * scale) return { A, B, C, a, b, c, S, p, degenerate: true };

  // circumcentre: solve |OA| = |OB| = |OC|
  const d = 2 * cross;
  const sa = A[0] ** 2 + A[1] ** 2;
  const sb = B[0] ** 2 + B[1] ** 2;
  const sc = C[0] ** 2 + C[1] ** 2;
  const O = [
    (sa * (B[1] - C[1]) + sb * (C[1] - A[1]) + sc * (A[1] - B[1])) / d,
    (sa * (C[0] - B[0]) + sb * (A[0] - C[0]) + sc * (B[0] - A[0])) / d,
  ];
  // incentre: vertices weighted by the opposite side lengths
  const I = [(a * A[0] + b * B[0] + c * C[0]) / (2 * p), (a * A[1] + b * B[1] + c * C[1]) / (2 * p)];
  const R = (a * b * c) / (4 * S);
  const r = S / p;

  // where O lies: compare the largest angle with 90° through the sides (law of cosines, exact on the grid)
  const sq = [a * a, b * b, c * c].sort((x, y) => x - y);
  const gap = sq[2] - sq[0] - sq[1]; // > 0 obtuse, 0 right, < 0 acute
  const tol = 1e-9 * sq[2];
  const position = gap > tol ? POSITION.outside : gap < -tol ? POSITION.inside : POSITION.onSide;
  return { A, B, C, a, b, c, S, p, O, I, R, r, position, degenerate: false };
}

/** Foot of the perpendicular from P to line UV. */
export function foot(P, U, V) {
  const dx = V[0] - U[0];
  const dy = V[1] - U[1];
  const u = ((P[0] - U[0]) * dx + (P[1] - U[1]) * dy) / (dx * dx + dy * dy);
  return [U[0] + u * dx, U[1] + u * dy];
}

/** Distance from P to line UV. */
export const lineDist = (P, U, V) => dist(P, foot(P, U, V));

/** Where the bisector of the angle at V meets the opposite side (it divides it in the ratio of the adjacent sides). */
export function bisectorFoot(V, P, Q) {
  const dp = dist(V, P);
  const dq = dist(V, Q);
  return [(dq * P[0] + dp * Q[0]) / (dp + dq), (dq * P[1] + dp * Q[1]) / (dp + dq)];
}

export { dist };
