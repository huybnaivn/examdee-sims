// Two lines a, b cut by a transversal c at A (on a) and B (on b); A lies above B.
// Directions are in degrees, counter-clockwise from the positive x axis (y up).
// At each vertex the four angles are numbered counter-clockwise from the right-hand ray of the line:
//   1 = between the right ray and the upward ray of c (upper right), 2 = upper left, 3 = lower left, 4 = lower right.
// The learner sets Â₁ and B̂₁ (30°…150°) and the tilt of c (60°…120°), so every ray keeps its side.

export const initialState = () => ({
  c: 75, // direction of the transversal c (deg)
  a1: 60, // Â₁ (deg)
  b1: 75, // B̂₁ (deg)
  pair: "dv1", // highlighted pair, a key of PAIRS
  showValues: false,
});

export const RANGE = { c: [60, 120], a1: [30, 150], b1: [30, 150] };

const mod = (x, m) => ((x % m) + m) % m;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Clamp and round the three angles so a forged state cannot break the numbering. */
export function normalize(s) {
  for (const k of ["c", "a1", "b1"]) s[k] = Math.round(clamp(Number.isFinite(s[k]) ? s[k] : initialState()[k], ...RANGE[k]));
  if (!PAIRS[s.pair]) s.pair = initialState().pair;
  return s;
}

/** Direction of the right-hand ray of line a / line b. */
export const dirA = s => s.c - s.a1;
export const dirB = s => s.c - s.b1;

/** The four angles at a vertex, from the line's right ray r and the upward ray u of c (degrees). */
export function anglesAt(r, u) {
  const rays = [r, u, r + 180, u + 180, r + 360];
  return [0, 1, 2, 3].map(i => mod(rays[i + 1] - rays[i], 360));
}

/** All eight angles: { A: [Â₁…Â₄], B: [B̂₁…B̂₄] }. */
export const angles = s => ({ A: anglesAt(dirA(s), s.c), B: anglesAt(dirB(s), s.c) });

/** a ∥ b when the two lines have the same direction (mod 180°). */
export function isParallel(s) {
  const d = mod(dirA(s) - dirB(s), 180);
  return Math.min(d, 180 - d) < 1e-9;
}

// rel "eq": the two angles are equal when a ∥ b (or always, for vertical angles);
// rel "sum": they add up to 180° when a ∥ b (or always, for adjacent supplementary angles).
const P = (kind, rel, always, x, y) => ({ kind, rel, always, x, y });
export const PAIRS = {
  slt1: P("so le trong", "eq", false, ["A", 3], ["B", 1]),
  slt2: P("so le trong", "eq", false, ["A", 4], ["B", 2]),
  dv1: P("đồng vị", "eq", false, ["A", 1], ["B", 1]),
  dv2: P("đồng vị", "eq", false, ["A", 2], ["B", 2]),
  dv3: P("đồng vị", "eq", false, ["A", 3], ["B", 3]),
  dv4: P("đồng vị", "eq", false, ["A", 4], ["B", 4]),
  tcp1: P("trong cùng phía", "sum", false, ["A", 4], ["B", 1]),
  tcp2: P("trong cùng phía", "sum", false, ["A", 3], ["B", 2]),
  dd1: P("đối đỉnh", "eq", true, ["A", 1], ["A", 3]),
  dd2: P("đối đỉnh", "eq", true, ["B", 2], ["B", 4]),
  kb1: P("kề bù", "sum", true, ["A", 1], ["A", 2]),
  kb2: P("kề bù", "sum", true, ["B", 3], ["B", 4]),
};

/** Values of a pair and whether its relation (equal / sum 180°) holds. */
export function relation(s, key) {
  const p = PAIRS[key];
  const g = angles(s);
  const v1 = g[p.x[0]][p.x[1] - 1];
  const v2 = g[p.y[0]][p.y[1] - 1];
  const holds = p.rel === "eq" ? Math.abs(v1 - v2) < 1e-9 : Math.abs(v1 + v2 - 180) < 1e-9;
  return { ...p, v1, v2, holds };
}
