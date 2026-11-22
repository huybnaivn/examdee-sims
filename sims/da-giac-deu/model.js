// Regular polygons: ruler-and-compass constructions, tiling around a point, perimeter and area.
// Lengths in cm, angles in degrees, y pointing up.

export const STEPS = 4; // every construction is told in four steps
export const STEP_SECONDS = 2.2;
export const A_MIN = 2;
export const A_MAX = 6;
export const BUILD = [3, 4, 6];
export const TILES = [3, 4, 5, 6];

const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));
const dir = deg => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];

/** Each angle of a regular n-gon: (n − 2) · 180° / n. */
export const interiorAngle = n => ((n - 2) * 180) / n;

/** k copies around one point: sum of the angles, and what is missing from (gap > 0) or over (gap < 0) 360°. */
export function aroundVertex(n, k) {
  const sum = k * interiorAngle(n);
  return { sum, gap: 360 - sum };
}

/** A regular n-gon tiles the plane by itself exactly when its angle divides 360°: 360 / angle = 2n / (n − 2). */
export const tiles = n => n >= 3 && (2 * n) % (n - 2) === 0;
/** How many meet at each point of the tiling (0 when the polygon does not tile). */
export const fitCount = n => (tiles(n) ? (2 * n) / (n - 2) : 0);

export const perimeter = (n, a) => n * a;
export const area = (n, a) => (n * a * a) / (4 * Math.tan(Math.PI / n));
/** Height of the equilateral triangle of side a. */
export const triangleHeight = a => (a * Math.sqrt(3)) / 2;

/** The n-gon that has one corner at `from`, its first side leaving in direction `deg`, interior on the left. */
export function polygonAt(n, side, from = [0, 0], deg = 0) {
  const pts = [from];
  for (let i = 0; i < n - 1; i++) {
    const [dx, dy] = dir(deg + i * (180 - interiorAngle(n)));
    pts.push([pts[i][0] + side * dx, pts[i][1] + side * dy]);
  }
  return pts;
}

/**
 * The construction of the regular n-gon (n = 3, 4, 6) of side a, as four steps of drawing items:
 *   { seg: [from, to], guide? }  a line drawn along the ruler (guide = thin helper line)
 *   { arc: [centre, radius, fromDeg, toDeg] }  an arc drawn with the compass
 * `points` are named points with the progress (0…4) at which they exist; `polygon` is the result.
 */
export function construction(n, a) {
  if (n === 3) {
    const [A, B, C] = polygonAt(3, a);
    return {
      polygon: [A, B, C],
      points: [["A", A, 0], ["B", B, 1], ["C", C, 3]],
      steps: [[{ seg: [A, B] }], [{ arc: [A, a, 35, 85] }], [{ arc: [B, a, 145, 95] }], [{ seg: [A, C] }, { seg: [B, C] }]],
      box: [0, 0, a, a],
    };
  }
  if (n === 4) {
    const [A, B, C, D] = polygonAt(4, a);
    const up = p => [p[0], p[1] + 1.3 * a];
    return {
      polygon: [A, B, C, D],
      points: [["A", A, 0], ["B", B, 1], ["D", D, 2], ["C", C, 3]],
      steps: [
        [{ seg: [A, B] }],
        [{ seg: [A, up(A)], guide: true }, { arc: [A, a, 65, 110] }, { seg: [A, D] }],
        [{ seg: [B, up(B)], guide: true }, { arc: [B, a, 115, 70] }, { seg: [B, C] }],
        [{ seg: [D, C] }],
      ],
      box: [0, 0, a, 1.3 * a],
    };
  }
  // hexagon: the radius of the circle is stepped off six times around it
  const O = [0, 0];
  const P = [0, 1, 2, 3, 4, 5].map(k => dir(60 * k).map(v => v * a));
  return {
    polygon: P,
    points: [["O", O, 0], ["A", P[0], 1], ...[1, 2, 3, 4, 5].map(k => ["BCDEF"[k - 1], P[k], 1 + k / 5])],
    steps: [
      [{ arc: [O, a, 0, 360] }],
      [0, 1, 2, 3, 4].map(k => ({ arc: [P[k], a, 120 + 60 * k - 14, 120 + 60 * k + 14] })),
      [0, 1, 2, 3, 4, 5].map(k => ({ seg: [P[k], P[(k + 1) % 6]] })),
      [0, 1, 2].map(k => ({ seg: [P[k], P[k + 3]] })),
    ],
    box: [-a, -a, a, a],
  };
}

export const initialState = () => ({
  mode: "build", // "build" | "tile"
  n: 6, // polygon being constructed: 3, 4 or 6
  a: 4, // side, cm
  progress: STEPS, // 0…4, how far the construction has got
  tile: 6, // polygon being fitted around a point: 3, 4, 5 or 6
  around: 2, // how many copies around the point
  pick3: false, // the learner's answer: which polygons tile the plane
  pick4: false,
  pick5: false,
  pick6: false,
  status: "", // "" | "right" | "wrong"
});

/** The shape on the drawing board, clamped (state can be forged). */
export const shape = s => ({ n: BUILD.includes(s.n) ? s.n : 6, a: clampInt(s.a, A_MIN, A_MAX) });
export const tileOf = s => ({ n: TILES.includes(s.tile) ? s.tile : 6, k: clampInt(s.around, 1, 6) });

/** Advance the drawing; a finished one starts again. Returns true on the step that completes it. */
export function advance(s, dt) {
  if (!(s.progress >= 0) || s.progress >= STEPS) s.progress = 0;
  s.progress = Math.min(STEPS, s.progress + dt / STEP_SECONDS);
  return s.progress >= STEPS;
}

/** Has the learner ticked exactly the polygons that tile the plane? */
export const identified = s => TILES.every(n => !!s[`pick${n}`] === tiles(n));
