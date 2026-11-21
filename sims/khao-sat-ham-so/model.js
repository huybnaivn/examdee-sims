// Survey of y = ax³ + bx² + cx + d: critical points, extrema, inflection, variation table, real roots.
// a = 0 degrades to the quadratic (or linear, or constant) case.

export const EPS = 1e-9;

export const initialState = () => ({
  a: 1,
  b: -3,
  c: 0,
  d: 2,
});

const z = v => v + 0; // -0 -> 0
const zero = v => Math.abs(v) < EPS;
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Coefficients with forged non-finite values replaced by 0. */
export const coeffs = s => ({ a: num(s.a), b: num(s.b), c: num(s.c), d: num(s.d) });

export const f = (k, x) => z(((k.a * x + k.b) * x + k.c) * x + k.d);
export const df = (k, x) => z((3 * k.a * x + 2 * k.b) * x + k.c);
export const d2f = (k, x) => z(6 * k.a * x + 2 * k.b);

/** Degree of the polynomial after dropping zero leading coefficients (−1 for y ≡ 0). */
export function degree(k) {
  if (!zero(k.a)) return 3;
  if (!zero(k.b)) return 2;
  if (!zero(k.c)) return 1;
  return zero(k.d) ? -1 : 0;
}

/** Δ′ = b² − 3ac, the reduced discriminant of y′ = 3ax² + 2bx + c. */
export const deltaPrime = k => z(k.b * k.b - 3 * k.a * k.c);

/**
 * Roots of y′ = 0 in increasing order, each with its type from y″:
 * "max" (y″ < 0), "min" (y″ > 0), "none" (double root of y′: y′ keeps its sign, no extremum).
 */
export function criticalPoints(k) {
  const deg = degree(k);
  if (deg === 3) {
    const dp = deltaPrime(k);
    if (zero(dp)) return [{ x: z(-k.b / (3 * k.a)), type: "none" }];
    if (dp < 0) return [];
    const r = Math.sqrt(dp);
    return [(-k.b - r) / (3 * k.a), (-k.b + r) / (3 * k.a)]
      .sort((p, q) => p - q)
      .map(x => ({ x: z(x), type: d2f(k, x) < 0 ? "max" : "min" }));
  }
  if (deg === 2) return [{ x: z(-k.c / (2 * k.b)), type: k.b < 0 ? "max" : "min" }];
  return []; // linear or constant: y′ is a nonzero constant or identically 0
}

/** Abscissa of the inflection point x = −b/(3a), or null when a = 0. */
export const inflection = k => (degree(k) === 3 ? z(-k.b / (3 * k.a)) : null);

function bisect(k, lo, hi) {
  let flo = f(k, lo);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(k, mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Distinct real roots (the abscissas where the graph meets Ox), increasing.
 * y is monotone between consecutive critical points, so each piece holds at most one root.
 * Returns null when y ≡ 0 (every x is a root).
 */
export function realRoots(k) {
  const deg = degree(k);
  if (deg === -1) return null;
  if (deg === 0) return [];
  const lead = [k.a, k.b, k.c][3 - deg];
  // Cauchy bound: every root has |x| < 1 + max|other coefficient| / |leading coefficient|
  const R = 1 + Math.max(Math.abs(k.a), Math.abs(k.b), Math.abs(k.c), Math.abs(k.d)) / Math.abs(lead) + 1;
  const pts = [-R, ...criticalPoints(k).map(p => p.x), R];
  const roots = [];
  const tiny = x => Math.abs(f(k, x)) < 1e-9 * Math.max(1, Math.abs(k.d));
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && i < pts.length - 1 && tiny(pts[i])) roots.push(pts[i]); // touches Ox at a critical point
    if (i === pts.length - 1) break;
    const lo = pts[i];
    const hi = pts[i + 1];
    const flo = f(k, lo);
    const fhi = f(k, hi);
    if ((i > 0 && tiny(lo)) || (i + 1 < pts.length - 1 && tiny(hi))) continue; // the root is that critical point
    if (flo * fhi < 0) roots.push(bisect(k, lo, hi));
  }
  return roots.map(z);
}

/**
 * Variation table: `nodes` from −∞ through each critical point to +∞, `signs[i]` the sign of y′
 * on the interval between nodes i and i + 1. Each node has a `level` (+1 top row, −1 bottom, 0 middle)
 * and the value of y there (±Infinity at the ends unless y is constant).
 */
export function variationTable(k) {
  const crit = criticalPoints(k);
  const deg = degree(k);
  const cuts = crit.map(p => p.x);
  const edges = [-Infinity, ...cuts, Infinity];
  const signs = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const mid = !Number.isFinite(lo) && !Number.isFinite(hi) ? 0 : !Number.isFinite(lo) ? hi - 1 : !Number.isFinite(hi) ? lo + 1 : (lo + hi) / 2;
    const v = df(k, mid);
    signs.push(zero(v) ? 0 : Math.sign(v));
  }
  const lead = deg <= 0 ? 0 : [k.a, k.b, k.c][3 - deg];
  const end = (x, sgn) => (deg <= 0 ? k.d : sgn * Infinity);
  const nodes = [
    { x: -Infinity, y: end(-Infinity, deg <= 0 ? 0 : Math.sign(lead) * (deg % 2 ? -1 : 1)), level: -signs[0], type: "end" },
    ...crit.map((p, i) => {
      const left = signs[i];
      const right = signs[i + 1];
      return { x: p.x, y: f(k, p.x), level: left > 0 && right < 0 ? 1 : left < 0 && right > 0 ? -1 : 0, type: p.type };
    }),
    { x: Infinity, y: end(Infinity, Math.sign(lead)), level: signs[signs.length - 1], type: "end" },
  ];
  return { nodes, signs };
}

/** Everything the screen and the event show. */
export function summary(s) {
  const k = coeffs(s);
  const crit = criticalPoints(k).map(p => ({ ...p, y: f(k, p.x) }));
  const xi = inflection(k);
  const roots = realRoots(k);
  return {
    k,
    deg: degree(k),
    delta: deltaPrime(k),
    crit,
    extrema: crit.filter(p => p.type !== "none"),
    inflection: xi === null ? null : { x: xi, y: f(k, xi) },
    roots,
    table: variationTable(k),
  };
}
