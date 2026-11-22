// Area of a triangle, a parallelogram and a trapezoid, derived by cutting and rearranging.
//
// Every shape sits on a grid of unit squares (1 cm) with its base AB on the x-axis, A at the origin:
//   parallelogram ABCD: A(0, 0), B(a, 0), C(s + a, h), D(s, h)
//   triangle ABC:       A(0, 0), B(a, 0), C(s, h)
//   trapezoid ABCD:     A(0, 0), B(a, 0), C(s + b, h), D(s, h)   (bases AB = a, DC = b)
// s is how far the top vertex D (or C) is shifted to the right of A; the foot of the height
// falls outside the base when s < 0 or s > a.
//
// The rearrangement:
//   parallelogram → rectangle: cut by vertical lines x = k·a and slide each piece by −k·a.
//     (with 0 ≤ s ≤ a this is the single cut along the height through B's side.)
//   triangle / trapezoid → first a copy turned half a turn about the midpoint of BC joins the shape
//     into a parallelogram with base a (triangle) or a + b (trapezoid), then that parallelogram
//     is cut into the rectangle as above. So the shape is half of the rectangle.

export const SHAPES = ["parallelogram", "triangle", "trapezoid"];
export const SHAPE_ID = { triangle: 1, parallelogram: 2, trapezoid: 3 };

export const initialState = () => ({
  shape: "parallelogram",
  a: 6, // base AB (cm)
  b: 3, // top base DC of the trapezoid (cm)
  h: 4, // height (cm)
  s: 2, // horizontal shift of the top vertex D (or C of the triangle) from A (cm)
  t: 0, // progress of the cut-and-rearrange animation, 0 to 1
  target: 12, // area the learner is asked to make (cm²)
  showCells: false,
});

export function vertices(st) {
  const { a, b, h, s } = st;
  if (st.shape === "triangle") return [[0, 0], [a, 0], [s, h]];
  if (st.shape === "trapezoid") return [[0, 0], [a, 0], [s + b, h], [s, h]];
  return [[0, 0], [a, 0], [s + a, h], [s, h]];
}

/** Area by the shoelace formula, always ≥ 0. */
export function shoelace(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Area by the textbook formula. */
export function formulaArea(st) {
  if (st.shape === "triangle") return (st.a * st.h) / 2;
  if (st.shape === "trapezoid") return ((st.a + st.b) * st.h) / 2;
  return st.a * st.h;
}

/** Base of the parallelogram the shape is rearranged into, i.e. the width of the final rectangle. */
export const rectWidth = st => (st.shape === "trapezoid" ? st.a + st.b : st.a);

/**
 * Height from P to the line through A and B (the base, extended if need be): the perpendicular
 * distance, with the foot of the perpendicular and whether that foot lies on segment AB.
 */
export function heightToBase(P, A, B) {
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const len2 = dx * dx + dy * dy;
  const u = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2;
  const foot = [A[0] + u * dx, A[1] + u * dy];
  const height = Math.abs(dx * (P[1] - A[1]) - dy * (P[0] - A[0])) / Math.sqrt(len2);
  return { height, foot, inside: u >= -1e-12 && u <= 1 + 1e-12 };
}

/** The vertex the height is drawn from: D for the quadrilaterals, C for the triangle. */
export const apex = st => vertices(st).at(-1);

/** Keep the part of a polygon where nx·x + ny·y ≤ c (Sutherland–Hodgman, one edge). */
export function clip(poly, nx, ny, c) {
  const out = [];
  const inside = p => nx * p[0] + ny * p[1] <= c + 1e-12;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const pin = inside(p);
    const qin = inside(q);
    if (pin) out.push(p);
    if (pin !== qin) {
      const fp = nx * p[0] + ny * p[1] - c;
      const fq = nx * q[0] + ny * q[1] - c;
      const k = fp / (fp - fq);
      out.push([p[0] + k * (q[0] - p[0]), p[1] + k * (q[1] - p[1])]);
    }
  }
  return out;
}

/** The copy of the shape turned by `angle` (rad, counter-clockwise) about the midpoint of BC. */
function turnedCopy(V, angle) {
  const [B, C] = [V[1], V[2]];
  if (angle >= Math.PI) return V.map(P => [B[0] + C[0] - P[0], B[1] + C[1] - P[1]]); // exact half turn
  const mx = (B[0] + C[0]) / 2;
  const my = (B[1] + C[1]) / 2;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return V.map(([x, y]) => [mx + c * (x - mx) - s * (y - my), my + s * (x - mx) + c * (y - my)]);
}

/**
 * The pieces on screen at animation progress t (0 to 1). Each piece is { pts, kind } where kind is
 * "orig" (part of the learner's shape) or "copy" (part of the half-turned copy).
 * For the triangle and trapezoid the first half of t turns the copy, the second half cuts and slides.
 */
export function pieces(st, t) {
  const V = vertices(st);
  const para = st.shape === "parallelogram";
  const turn = para ? 1 : Math.min(1, Math.max(0, 2 * t));
  const slide = para ? Math.min(1, Math.max(0, t)) : Math.min(1, Math.max(0, 2 * t - 1));
  const polys = [{ pts: V, kind: "orig" }];
  if (!para && t > 0) polys.push({ pts: turnedCopy(V, Math.PI * turn), kind: "copy" });
  if (slide <= 0) return polys;
  const L = rectWidth(st);
  const out = [];
  for (const { pts, kind } of polys) {
    const xs = pts.map(p => p[0]);
    const k0 = Math.floor(Math.min(...xs) / L);
    const k1 = Math.ceil(Math.max(...xs) / L) - 1;
    for (let k = k0; k <= k1; k++) {
      const piece = clip(clip(pts, -1, 0, -k * L), 1, 0, (k + 1) * L);
      if (piece.length < 3) continue;
      // keep zero-area pieces out, except when the whole shape is flat (h = 0)
      if (shoelace(piece) < 1e-9 && st.h > 0) continue;
      out.push({ kind, k, pts: piece.map(([x, y]) => [x - k * L * slide, y]) });
    }
  }
  return out;
}

/**
 * Unit squares of the grid that the polygon covers: `full` squares lie wholly inside,
 * `partial` ones are cut by its sides; `sum` adds the exact covered area of every square.
 */
export function cellCoverage(pts) {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  let full = 0;
  let partial = 0;
  let sum = 0;
  const cells = [];
  for (let i = Math.floor(Math.min(...xs)); i < Math.ceil(Math.max(...xs)); i++) {
    for (let j = Math.floor(Math.min(...ys)); j < Math.ceil(Math.max(...ys)); j++) {
      let p = clip(pts, -1, 0, -i);
      p = clip(p, 1, 0, i + 1);
      p = clip(p, 0, -1, -j);
      p = clip(p, 0, 1, j + 1);
      const area = p.length >= 3 ? shoelace(p) : 0;
      if (area > 1 - 1e-9) full++;
      else if (area > 1e-9) partial++;
      else continue;
      sum += area;
      cells.push({ i, j, area });
    }
  }
  return { full, partial, sum, cells };
}

/** Points the learner can drag, in grid units, and how dragging each one changes the state. */
export function handles(st) {
  const { a, b, h, s } = st;
  const list = [{ name: "B", x: a, y: 0, set: (q, x) => (q.a = x) }];
  if (st.shape === "triangle") list.push({ name: "C", x: s, y: h, set: (q, x, y) => ((q.s = x), (q.h = y)) });
  else {
    const top = st.shape === "trapezoid" ? b : a;
    list.push({ name: "D", x: s, y: h, set: (q, x, y) => ((q.s = x), (q.h = y)) });
    list.push({
      name: "C",
      x: s + top,
      y: h,
      set: st.shape === "trapezoid" ? (q, x, y) => ((q.b = x - q.s), (q.h = y)) : (q, x, y) => ((q.s = x - q.a), (q.h = y)),
    });
  }
  return list;
}
