// Triangle ABC with AB = 5, AC = 7, BC = 8 (cm): B at the origin, C on the x-axis, A above.
// M on AB with AM/AB = t, N on AC with AN/AC = u. MN // BC exactly when u = t (0 < t < 1).

export const AB = 5;
export const AC = 7;
export const BC = 8;
const AX = (AB * AB - AC * AC + BC * BC) / (2 * BC); // 2,5
export const TRI = { A: [AX, Math.sqrt(AB * AB - AX * AX)], B: [0, 0], C: [BC, 0] };

export const initialState = () => ({ mode: "talet", t: 0.6, converse: false, u: 0.6, k: 1.5 });

const EPS = 1e-9;
const clamp01 = v => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const lerp = (p, q, f) => [p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])];
export const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

/** Positions and ratios for the Ta-lét figure; u follows t unless the converse mode unlocks N. */
export function talet(s, tri = TRI) {
  const t = clamp01(s.t);
  const u = s.converse ? clamp01(s.u) : t;
  const { A, B, C } = tri;
  const M = lerp(A, B, t);
  const N = lerp(A, C, u);
  const ab = dist(A, B), ac = dist(A, C), bc = dist(B, C);
  const am = dist(A, M), an = dist(A, N), mn = dist(M, N);
  const mb = ab - am, nc = ac - an;
  // sine of the angle between MN and BC; 0 means the same direction
  const cross = ((N[0] - M[0]) * (C[1] - B[1]) - (N[1] - M[1]) * (C[0] - B[0])) / (Math.max(mn, EPS) * bc);
  const degenerate = t === 0 || t === 1 || u === 0 || u === 1; // M or N at a vertex: MN is no longer a line cutting both sides
  return {
    A, B, C, M, N, t, u,
    ab, ac, bc, am, an, mn, mb, nc,
    rAB: am / ab, // AM/AB
    rAC: an / ac, // AN/AC
    rBC: mn / bc, // MN/BC
    rMB: mb > EPS ? am / mb : Infinity, // AM/MB
    rNC: nc > EPS ? an / nc : Infinity, // AN/NC
    parallel: !degenerate && mn > EPS && Math.abs(cross) < 1e-9,
    degenerate,
  };
}

const angleAt = (p, q, r) => {
  const ux = q[0] - p[0], uy = q[1] - p[1], vx = r[0] - p[0], vy = r[1] - p[1];
  return (Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy) * 180) / Math.PI;
};

/** Sides a = BC, b = CA, c = AB; angles at A, B, C (degrees); perimeter; area. */
export function measure([A, B, C]) {
  const sides = [dist(B, C), dist(C, A), dist(A, B)];
  return {
    sides,
    angles: [angleAt(A, B, C), angleAt(B, C, A), angleAt(C, A, B)],
    perimeter: sides[0] + sides[1] + sides[2],
    area: Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])) / 2,
  };
}

export const K_MIN = 0.5;
export const K_MAX = 2.5;

/** Triangle A'B'C' = ABC scaled by k (a homothety about B, then moved right of ABC). */
export function similar(s, tri = TRI) {
  const k = Math.min(K_MAX, Math.max(K_MIN, Number.isFinite(s.k) ? s.k : 1));
  const P = [tri.A, tri.B, tri.C];
  const shift = Math.max(...P.map(p => p[0])) - k * Math.min(...P.map(p => p[0])) + 3; // A'B'C' starts 3 cm right of ABC
  const Q = P.map(p => [shift + k * p[0], k * p[1]]);
  const m = measure(P);
  const m2 = measure(Q);
  return {
    k, P, Q, m, m2,
    sideRatios: m2.sides.map((v, i) => v / m.sides[i]),
    perimeterRatio: m2.perimeter / m.perimeter,
    areaRatio: m2.area / m.area,
  };
}
