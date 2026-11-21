// A system of two linear equations in two unknowns:
//   a1·x + b1·y = c1   (d1)
//   a2·x + b2·y = c2   (d2)

export const initialState = () => ({
  a1: 2,
  b1: 1,
  c1: 4,
  a2: 1,
  b2: -1,
  c2: -1,
});

/** "line" for a real first-degree equation; 0x + 0y = c is "all" (c = 0, every point) or "empty" (c ≠ 0). */
export const equationKind = (a, b, c) => (a !== 0 || b !== 0 ? "line" : c === 0 ? "all" : "empty");

/**
 * Classify and solve the system with determinants (Cramer's rule).
 * kind: "unique" (with x, y), "none" or "infinite". degenerate: an equation is 0x + 0y = c,
 * in which case D = Dx = Dy = 0 says nothing and the equations are judged directly.
 */
export function solve({ a1, b1, c1, a2, b2, c2 }) {
  // "+ 0" turns a possible −0 into 0
  const D = a1 * b2 - a2 * b1 + 0;
  const Dx = c1 * b2 - c2 * b1 + 0;
  const Dy = a1 * c2 - a2 * c1 + 0;
  const out = { D, Dx, Dy, degenerate: false };
  if (D !== 0) return { ...out, kind: "unique", x: Dx / D + 0, y: Dy / D + 0 };
  const k1 = equationKind(a1, b1, c1);
  const k2 = equationKind(a2, b2, c2);
  if (k1 !== "line" || k2 !== "line") {
    return { ...out, degenerate: true, kind: k1 === "empty" || k2 === "empty" ? "none" : "infinite" };
  }
  // two parallel directions: the same line when the constants are in the same ratio
  return { ...out, kind: Dx === 0 && Dy === 0 ? "infinite" : "none" };
}

/**
 * The segment of the line a·x + b·y = c inside the square |x| ≤ r, |y| ≤ r,
 * as [[x, y], [x, y]], or null when the line misses the square or is not a line.
 */
export function segment(a, b, c, r) {
  if (a === 0 && b === 0) return null;
  const pts = [];
  const add = (x, y) => {
    if (Math.abs(x) <= r + 1e-9 && Math.abs(y) <= r + 1e-9 && !pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 1e-9)) pts.push([x, y]);
  };
  if (b !== 0) for (const x of [-r, r]) add(x, (c - a * x) / b);
  if (a !== 0) for (const y of [-r, r]) add((c - b * y) / a, y);
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}
