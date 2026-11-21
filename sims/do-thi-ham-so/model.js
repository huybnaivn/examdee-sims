// Graphs of y = ax + b and y = ax² + bx + c: roots, intercepts, vertex, discriminant.

export const RANGE = 5; // coefficients run from -RANGE to RANGE

export const initialState = () => ({
  kind: "quadratic", // "linear": y = ax + b, "quadratic": y = ax² + bx + c
  a: 1,
  b: -2,
  c: -3, // used only by the quadratic
});

const z = v => v + 0; // -0 -> 0, so "x = -0" is never shown

/** y = ax + b. One root -b/a; none when a = 0 and b ≠ 0; every x when a = b = 0. */
export function linear(a, b) {
  return {
    type: a === 0 ? "constant" : "linear",
    degenerate: false,
    slope: a,
    yIntercept: b,
    roots: a === 0 ? [] : [z(-b / a)],
    allReal: a === 0 && b === 0,
    delta: null,
    vertex: null,
  };
}

/** y = ax² + bx + c. Roots ascending. With a = 0 it is the line y = bx + c (degenerate: true). */
export function quadratic(a, b, c) {
  if (a === 0) return { ...linear(b, c), degenerate: true };
  const delta = b * b - 4 * a * c;
  const xv = z(-b / (2 * a));
  const root = Math.sqrt(Math.max(delta, 0));
  const roots = delta < 0 ? [] : delta === 0 ? [xv] : [z((-b - root) / (2 * a)), z((-b + root) / (2 * a))].sort((p, q) => p - q);
  return {
    type: "quadratic",
    degenerate: false,
    yIntercept: c,
    roots,
    allReal: false,
    delta,
    vertex: { x: xv, y: z(-delta / (4 * a)) }, // the axis of symmetry is x = vertex.x
  };
}

export const analyze = s => (s.kind === "linear" ? linear(s.a, s.b) : quadratic(s.a, s.b, s.c));

export const evaluate = (s, x) => (s.kind === "linear" ? s.a * x + s.b : s.a * x * x + s.b * x + s.c);
