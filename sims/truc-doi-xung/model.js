// Line symmetry and point symmetry.
// 1. An N × N grid of cells (row r from the top, column c from the left), stored as a string of
//    "0"/"1", row by row. A cell is reflected across the vertical or horizontal middle line, the
//    diagonal from the top-left corner, or through the centre O of the grid.
// 2. Built-in shapes made of segments (y down). Their axes of symmetry are found by testing every
//    line through the centre, so the count on screen is computed, not typed in.

export const N = 8;
export const AXES = { vertical: 1, horizontal: 2, diagonal: 3, center: 4 }; // codes used in events

/** Image of cell (r, c). */
export function reflect(r, c, axis) {
  if (axis === "vertical") return [r, N - 1 - c];
  if (axis === "horizontal") return [N - 1 - r, c];
  if (axis === "diagonal") return [c, r];
  return [N - 1 - r, N - 1 - c]; // center
}

/** Is cell (r, c) on the side where the learner is asked to draw (or on the axis)? */
export const drawSide = (r, c, axis) => (axis === "vertical" ? c < N / 2 : axis === "horizontal" ? r < N / 2 : axis === "diagonal" ? r >= c : c < N / 2);

const START = [[0, 3], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [4, 2], [4, 3], [5, 3], [6, 3], [7, 2], [7, 3]];
export const fromList = list => {
  const a = Array(N * N).fill("0");
  for (const [r, c] of list) a[r * N + c] = "1";
  return a.join("");
};
export const toList = cells => [...cells].flatMap((v, i) => (v === "1" ? [[Math.floor(i / N), i % N]] : []));

export const initialState = () => ({
  mode: "draw", // "draw" (trục đối xứng) | "count" (đếm trục đối xứng) | "center" (tâm đối xứng)
  axis: "vertical", // "vertical" | "horizontal" | "diagonal"
  cells: fromList(START), // half of a fir tree, left of the vertical axis
  mirror: true, // the reflected cells are shown
  shape: "square",
  // transient (not saved)
  _tried: [],
  _solved: false,
  _last: null, // last cell drawn, [r, c]
  _paint: null,
  _anim: null,
});

/** The reflection used in the current mode. */
export const activeAxis = s => (s.mode === "center" ? "center" : s.axis);

/** Cells of the learner's drawing and their images. */
export const mirrorCells = (cells, axis) => fromList(toList(cells).map(([r, c]) => reflect(r, c, axis)));
export const union = (a, b) => [...a].map((v, i) => (v === "1" || b[i] === "1" ? "1" : "0")).join("");
export const full = (cells, axis) => union(cells, mirrorCells(cells, axis));
export const count = cells => [...cells].filter(v => v === "1").length;
export const isSymmetric = (cells, axis) => count(cells) > 0 && mirrorCells(cells, axis) === cells;

export const toggle = (cells, r, c, on) => {
  const a = [...cells];
  a[r * N + c] = on ? "1" : "0";
  return a.join("");
};

/** Untrusted state: keep known keys of the right type; the grid must be N × N of 0/1. */
export function sanitize(incoming, base) {
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (key.startsWith("_")) continue;
    const v = incoming[key];
    if (typeof v === typeof base[key] && typeof v !== "object") out[key] = v;
  }
  if (typeof out.cells !== "string" || !/^[01]+$/.test(out.cells) || out.cells.length !== N * N) out.cells = base.cells;
  return out;
}

// ---------- built-in shapes ----------
const poly = pts => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
const regular = (n, r = 1, start = -90) => Array.from({ length: n }, (_, i) => [r * Math.cos(((start + (360 * i) / n) * Math.PI) / 180), r * Math.sin(((start + (360 * i) / n) * Math.PI) / 180)]);

export const SHAPES = [
  { key: "letterA", name: "Chữ A", stroke: true, segs: [[[-0.6, 0.8], [0, -0.8]], [[0, -0.8], [0.6, 0.8]], [[-0.3, 0], [0.3, 0]]] },
  { key: "letterH", name: "Chữ H", stroke: true, segs: [[[-0.5, -0.8], [-0.5, 0.8]], [[0.5, -0.8], [0.5, 0.8]], [[-0.5, 0], [0.5, 0]]] },
  { key: "letterE", name: "Chữ E", stroke: true, segs: [[[-0.5, -0.8], [-0.5, 0.8]], [[-0.5, -0.8], [0.5, -0.8]], [[-0.5, 0], [0.5, 0]], [[-0.5, 0.8], [0.5, 0.8]]] },
  { key: "letterN", name: "Chữ N", stroke: true, segs: [[[-0.5, 0.8], [-0.5, -0.8]], [[-0.5, -0.8], [0.5, 0.8]], [[0.5, 0.8], [0.5, -0.8]]] },
  { key: "square", name: "Hình vuông", segs: poly([[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) },
  { key: "rectangle", name: "Hình chữ nhật", segs: poly([[-1.2, -0.7], [1.2, -0.7], [1.2, 0.7], [-1.2, 0.7]]) },
  { key: "triangle", name: "Tam giác đều", segs: poly(regular(3, 1.05, -90).map(([x, y]) => [x, y + 0.2])) },
  { key: "trapezoid", name: "Hình thang cân", segs: poly([[-0.6, -0.65], [0.6, -0.65], [1.15, 0.65], [-1.15, 0.65]]) },
  { key: "rhombus", name: "Hình thoi", segs: poly([[0, -1.05], [0.7, 0], [0, 1.05], [-0.7, 0]]) },
  { key: "hexagon", name: "Lục giác đều", segs: poly(regular(6, 1, 0)) },
  { key: "parallelogram", name: "Hình bình hành", segs: poly([[-0.6, -0.6], [1.15, -0.6], [0.6, 0.6], [-1.15, 0.6]]) },
  { key: "circle", name: "Hình tròn", circle: 1 },
];
export const shapeOf = key => SHAPES.find(x => x.key === key) ?? SHAPES[0];

/** Centre of a shape: mean of its distinct corner points (any symmetry keeps it fixed). */
export function centre(shape) {
  if (shape.circle) return [0, 0];
  const pts = new Map();
  for (const seg of shape.segs) for (const [x, y] of seg) pts.set(`${x.toFixed(6)},${y.toFixed(6)}`, [x, y]);
  const all = [...pts.values()];
  return [all.reduce((a, p) => a + p[0], 0) / all.length, all.reduce((a, p) => a + p[1], 0) / all.length];
}

const EPS = 1e-6;
const same = (p, q) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;
/** Does the map f send the set of segments onto itself? */
const invariant = (segs, f) => segs.every(([a, b]) => segs.some(([c, d]) => (same(f(a), c) && same(f(b), d)) || (same(f(a), d) && same(f(b), c))));

/** Reflection across the line through o at `deg` degrees. */
const reflectAcross = (o, deg) => {
  const t = (2 * deg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(t), Math.sin(t)];
  return ([x, y]) => {
    const dx = x - o[0];
    const dy = y - o[1];
    return [o[0] + dx * cos + dy * sin, o[1] + dx * sin - dy * cos];
  };
};

/** Angles (whole degrees in [0, 180)) of every axis of symmetry; a circle has infinitely many. */
export function axesOf(shape) {
  if (shape.circle) return null;
  const o = centre(shape);
  const out = [];
  for (let deg = 0; deg < 180; deg++) if (invariant(shape.segs, reflectAcross(o, deg))) out.push(deg);
  return out;
}

/** Number of axes, Infinity for a circle. */
export const axisCount = shape => (shape.circle ? Infinity : axesOf(shape).length);

/** Half-turn about the centre maps the shape onto itself. */
export const hasCentre = shape => {
  if (shape.circle) return true;
  const o = centre(shape);
  return invariant(shape.segs, ([x, y]) => [2 * o[0] - x, 2 * o[1] - y]);
};

/** The answer buttons: 0..6 and "vô số" (−1). */
export const ANSWERS = [0, 1, 2, 3, 4, 5, 6, -1];
export const isCorrect = (shape, answer) => (answer === -1 ? axisCount(shape) === Infinity : axisCount(shape) === answer);
