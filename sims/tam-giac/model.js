// A triangle ABC on a grid. Vertex i is A, B, C; side i is the side opposite vertex i (a = BC, b = CA, c = AB).

export const W = 14; // grid width, units
export const H = 11; // grid height, units

// 3-4-5 right triangle, placed so the three squares on its sides fit on the grid.
export const initialState = () => ({ ax: 5, ay: 4, bx: 9, by: 4, cx: 5, cy: 7, show: "none" });

export const points = s => [[s.ax, s.ay], [s.bx, s.by], [s.cx, s.cy]];

const REL = 1e-9; // relative tolerance on squared lengths: absorbs rounding, far below one grid step
const same = (x, y) => Math.abs(x - y) <= REL * Math.max(x, y);

/** Everything measurable about the triangle. Never returns NaN, also for collinear or coincident points. */
export function measure(s) {
  const P = points(s);
  const [A, B, C] = P;
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
  const sq = [d2(B, C), d2(C, A), d2(A, B)];
  const sides = sq.map(Math.sqrt);
  const cross = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
  const area = Math.abs(cross) / 2; // shoelace formula
  const longest = Math.max(...sq);
  const degenerate = !(area > REL * Math.max(longest, 1));

  // Angle at each vertex from the two edge vectors (atan2 is safe for 0°, 180° and zero-length edges).
  const angles = P.map((p, i) => {
    const q = P[(i + 1) % 3];
    const r = P[(i + 2) % 3];
    const ux = q[0] - p[0], uy = q[1] - p[1], vx = r[0] - p[0], vy = r[1] - p[1];
    return (Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy) * 180) / Math.PI;
  });

  let bySides = null; // "equilateral" | "isosceles" | "scalene"
  let byAngles = null; // "right" | "acute" | "obtuse"
  let apex = -1; // isosceles: the vertex where the two equal sides meet
  let big = -1; // vertex of the largest angle (the right or obtuse one)
  if (!degenerate) {
    const equal = [same(sq[1], sq[2]), same(sq[2], sq[0]), same(sq[0], sq[1])]; // equal[i]: the two sides meeting at vertex i
    bySides = equal.every(Boolean) ? "equilateral" : equal.some(Boolean) ? "isosceles" : "scalene";
    if (bySides === "isosceles") apex = equal.indexOf(true);
    big = sq.indexOf(longest);
    const rest = sq[0] + sq[1] + sq[2] - longest;
    byAngles = same(rest, longest) ? "right" : rest > longest ? "acute" : "obtuse"; // Pythagoras and its converse
  }

  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  // Foot of the altitude from vertex i onto the line through the other two.
  const feet = P.map((p, i) => {
    const q = P[(i + 1) % 3];
    const r = P[(i + 2) % 3];
    const len2 = d2(q, r);
    if (len2 === 0) return [...q];
    const t = ((p[0] - q[0]) * (r[0] - q[0]) + (p[1] - q[1]) * (r[1] - q[1])) / len2;
    return [q[0] + t * (r[0] - q[0]), q[1] + t * (r[1] - q[1])];
  });

  let orthocenter = null;
  if (!degenerate) {
    // circumcentre O, then H = A + B + C − 2·O
    const n = P.map(p => p[0] * p[0] + p[1] * p[1]);
    const ox = (n[0] * (B[1] - C[1]) + n[1] * (C[1] - A[1]) + n[2] * (A[1] - B[1])) / (2 * cross);
    const oy = (n[0] * (C[0] - B[0]) + n[1] * (A[0] - C[0]) + n[2] * (B[0] - A[0])) / (2 * cross);
    orthocenter = [A[0] + B[0] + C[0] - 2 * ox, A[1] + B[1] + C[1] - 2 * oy];
  }

  return {
    points: P,
    sq, // squared side lengths
    sides,
    angles, // degrees
    area,
    perimeter: sides[0] + sides[1] + sides[2],
    heights: sides.map(side => (side > 0 ? (2 * area) / side : 0)), // heights[i] drops from vertex i onto side i
    degenerate,
    bySides,
    byAngles,
    apex,
    big,
    centroid: [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3],
    midpoints: [mid(B, C), mid(C, A), mid(A, B)],
    feet,
    orthocenter,
  };
}

/** The noteworthy shape the learner may be aiming for, "" if none. */
export function specialType(m) {
  if (m.bySides === "equilateral") return "equilateral";
  if (m.byAngles === "right") return m.bySides === "isosceles" ? "right-isosceles" : "right";
  return m.bySides === "isosceles" ? "isosceles" : "";
}

const NAMES = ["A", "B", "C"];

/** The classification in words, as a Vietnamese textbook would say it. */
export function describe(m) {
  const zero = m.sq.map(v => v === 0); // zero[i]: the two vertices other than i coincide
  if (zero.every(Boolean)) return "Ba đỉnh trùng nhau: không tạo thành tam giác";
  const i = zero.indexOf(true);
  if (i >= 0) return `Hai đỉnh ${NAMES[(i + 1) % 3]} và ${NAMES[(i + 2) % 3]} trùng nhau: không tạo thành tam giác`;
  if (m.degenerate) return "Ba điểm thẳng hàng: không tạo thành tam giác";
  if (m.bySides === "equilateral") return "Tam giác đều";
  if (m.byAngles === "right") return `Tam giác vuông ${m.bySides === "isosceles" ? "cân " : ""}tại ${NAMES[m.big]}`;
  const angle = m.byAngles === "acute" ? "nhọn" : "tù";
  return m.bySides === "isosceles" ? `Tam giác cân tại ${NAMES[m.apex]} (tam giác ${angle})` : `Tam giác ${angle}`;
}

/**
 * The square drawn outward on each side, in grid units: squares[i] = [q, r, r + n, q + n] for side i
 * (from vertex q to vertex r), where n is perpendicular to the side, as long as it, and points away
 * from vertex i. Its area is side² (Pythagoras' figure).
 */
export function sideSquares(m) {
  return m.points.map((p, i) => {
    const q = m.points[(i + 1) % 3];
    const r = m.points[(i + 2) % 3];
    let n = [r[1] - q[1], q[0] - r[0]];
    if (n[0] * (p[0] - q[0]) + n[1] * (p[1] - q[1]) > 0) n = [-n[0], -n[1]];
    return [q, r, [r[0] + n[0], r[1] + n[1]], [q[0] + n[0], q[1] + n[1]]];
  });
}

/**
 * The three angles rounded to 0.1° so that the rounded values still add up to exactly 180
 * (largest-remainder rounding). Only meaningful for a real triangle.
 */
export function roundedAngles(angles) {
  const tenths = angles.map(a => Math.floor(a * 10 + 1e-7));
  const order = [0, 1, 2].sort((i, j) => angles[j] * 10 - tenths[j] - (angles[i] * 10 - tenths[i]));
  const missing = 1800 - tenths[0] - tenths[1] - tenths[2];
  for (let k = 0; k < missing; k++) tenths[order[k % 3]]++;
  return tenths.map(t => t / 10);
}

/** The two points that make an equilateral triangle with p and q. */
export function equilateralApexes(p, q) {
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
  const hx = (-(q[1] - p[1]) * Math.sqrt(3)) / 2, hy = ((q[0] - p[0]) * Math.sqrt(3)) / 2;
  return [[mx + hx, my + hy], [mx - hx, my - hy]];
}
