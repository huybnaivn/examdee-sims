// A system of one to three first-degree inequalities in two unknowns,
//   a_i·x + b_i·y  (≤ | < | ≥ | >)  c_i,   i = 1..count,
// its solution region, the region's vertices, and an objective F = p·x + q·y on it.

export const SIGNS = { le: "≤", lt: "<", ge: "≥", gt: ">" };
const EPS = 1e-9;
const BIG = 1e4; // clipping box for the "whole" plane; integer coefficients ≤ 10 keep every vertex well inside

export const initialState = () => ({
  count: 3,
  a1: 1, b1: 1, c1: 6, s1: "le", // x + y ≤ 6
  a2: 1, b2: -2, c2: 0, s2: "le", // x − 2y ≤ 0
  a3: 2, b3: -1, c3: 0, s3: "ge", // 2x − y ≥ 0
  px: 2, // test point M
  py: 2,
  showObj: true,
  p: 1, // F = p·x + q·y
  q: 2,
  zoom: 6, // the plot shows |x|, |y| ≤ zoom
});

/** The active inequalities as [{ a, b, c, sign }]. */
export const inequalities = s =>
  [1, 2, 3].slice(0, Math.min(3, Math.max(1, Math.round(s.count) || 1))).map(i => ({ a: s[`a${i}`], b: s[`b${i}`], c: s[`c${i}`], sign: s[`s${i}`] }));

/** Does (x, y) satisfy the inequality? A point on the line satisfies ≤ and ≥ but not < and >. */
export function holds({ a, b, c, sign }, x, y, closed = false) {
  const v = a * x + b * y - c;
  if (sign === "le" || (closed && sign === "lt")) return v <= EPS;
  if (sign === "lt") return v < -EPS;
  if (sign === "ge" || (closed && sign === "gt")) return v >= -EPS;
  return v > EPS; // gt
}

export const satisfiesAll = (list, x, y, closed = false) => list.every(e => holds(e, x, y, closed));

/** The opposite inequality, as a closed half-plane: the part that is crossed out (bị gạch bỏ). */
export const excluded = e => ({ ...e, sign: e.sign === "le" || e.sign === "lt" ? "ge" : "le" });

/** Clip a convex polygon [[x, y]…] to the closed half-plane of the inequality (Sutherland–Hodgman). */
export function clip(poly, e) {
  const up = e.sign === "le" || e.sign === "lt" ? 1 : -1; // keep up·(ax + by − c) ≤ 0
  const f = ([x, y]) => up * (e.a * x + e.b * y - e.c);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % poly.length];
    const fp = f(P);
    const fq = f(Q);
    if (fp <= EPS) out.push(P);
    if ((fp < -EPS && fq > EPS) || (fp > EPS && fq < -EPS)) {
      const t = fp / (fp - fq);
      out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
    }
  }
  // drop repeated points (a region shrunk to a segment or a point keeps one copy of each)
  return out.filter((p, i) => !out.slice(0, i).some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9));
}

export const box = r => [[-r, -r], [r, -r], [r, r], [-r, r]];

/** Closed solution region inside the square |x|, |y| ≤ r, as a convex polygon (maybe empty). */
export const regionIn = (list, r) => list.reduce((poly, e) => (poly.length ? clip(poly, e) : poly), box(r));

export const area = poly => Math.abs(poly.reduce((sum, p, i) => sum + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1], 0)) / 2;

/** Intersection of the two boundary lines, or null when they are parallel (or one is not a line). */
export function meet(e, f) {
  const D = e.a * f.b - f.a * e.b;
  if (D === 0) return null;
  return [(e.c * f.b - f.c * e.b) / D + 0, (e.a * f.c - f.a * e.c) / D + 0];
}

/**
 * Vertices of the region: the pairwise intersections of the boundary lines that satisfy every
 * inequality (with the boundary counted, since a vertex on a dashed line is a corner of the region
 * but not one of its points; `inside` says which).
 */
export function vertices(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const P = meet(list[i], list[j]);
      if (!P || !satisfiesAll(list, P[0], P[1], true)) continue;
      if (out.some(v => Math.hypot(v.x - P[0], v.y - P[1]) < 1e-9)) continue;
      out.push({ x: P[0], y: P[1], inside: satisfiesAll(list, P[0], P[1]) });
    }
  }
  return out;
}

/**
 * kind: "empty" (no point satisfies the system), "bounded" or "unbounded".
 * The closed region is clipped to a huge box; it is unbounded if it reaches the box's edge.
 * Strict inequalities matter only when the closed region has no area (a segment or a point).
 */
export function classify(list) {
  const poly = regionIn(list, BIG);
  if (!poly.length) return "empty";
  if (area(poly) < 1e-6) {
    const mid = poly.reduce(([x, y], p) => [x + p[0] / poly.length, y + p[1] / poly.length], [0, 0]);
    if (![...poly, mid].some(([x, y]) => satisfiesAll(list, x, y))) return "empty";
  }
  return poly.some(([x, y]) => Math.max(Math.abs(x), Math.abs(y)) > BIG / 2) ? "unbounded" : "bounded";
}

/**
 * F = p·x + q·y at each vertex of a bounded region, and where it is largest and smallest.
 * null when the region is empty or unbounded.
 */
export function optimise(list, p, q) {
  if (classify(list) !== "bounded") return null;
  const values = vertices(list).map(v => ({ ...v, F: p * v.x + q * v.y + 0 }));
  if (!values.length) return null;
  const max = values.reduce((m, v) => (v.F > m.F ? v : m));
  const min = values.reduce((m, v) => (v.F < m.F ? v : m));
  return { values, max, min };
}
