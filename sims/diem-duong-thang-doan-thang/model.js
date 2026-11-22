// Points, lines, rays and segments on a grid of 1 cm squares (x to the right, y up).
// Points sit on grid nodes, so "thẳng hàng" is an exact integer test.
// Lists are kept as strings so the state stays flat JSON:
//   points  "1,6;5,4;9,2"   (point i is named NAMES[i])
//   objects "l:0-1;s:1-3"   l = đường thẳng, r = tia (gốc là điểm đầu), s = đoạn thẳng

export const W = 12; // grid width, cm
export const H = 8; // grid height, cm
export const MAX_POINTS = 8;
export const MAX_OBJECTS = 12;
export const NAMES = "ABCDEFGH";
export const TYPES = { l: 1, r: 2, s: 3 }; // codes used in events
const EPS = 1e-9;

export const initialState = () => ({
  mode: "draw", // "draw" (vẽ hình) | "count" (đếm đường thẳng) | "midpoint" (trung điểm)
  tool: "point", // "point" | "l" | "r" | "s"
  points: "1,6;5,4;9,2;4,1;10,6",
  objects: "l:0-1;s:1-3;r:3-4",
  from: 0, // keyboard way of drawing: from point … to point …
  to: 1,
  // count mode
  n: 4,
  answer: 0,
  showLines: true,
  // midpoint mode: segment AB and a point M on it, AM = am (cm)
  ax: 2,
  ay: 1,
  bx: 10,
  by: 7,
  am: 3,
  found: false,
  // transient
  _sel: null,
  _drag: null,
  _moved: null,
  _anim: null,
  _tries: null,
  _solved: null,
});

// ---------- lists ----------
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/** Untrusted string -> [[x, y], …]: grid nodes only, no duplicates, at most MAX_POINTS. */
export function parsePoints(str) {
  const out = [];
  for (const part of String(str ?? "").split(";")) {
    if (!/^\d+,\d+$/.test(part)) continue;
    const [x, y] = part.split(",").map(Number);
    if (!int(x, 0, W) || !int(y, 0, H) || out.some(p => p[0] === x && p[1] === y)) continue;
    if (out.length < MAX_POINTS) out.push([x, y]);
  }
  return out;
}
export const formatPoints = pts => pts.map(p => p.join(",")).join(";");

/** Untrusted string -> [{ type, a, b }, …] referring to existing points. */
export function parseObjects(str, count) {
  const out = [];
  for (const part of String(str ?? "").split(";")) {
    const m = /^([lrs]):(\d)-(\d)$/.exec(part);
    if (!m) continue;
    const o = { type: m[1], a: +m[2], b: +m[3] };
    if (o.a === o.b || o.a >= count || o.b >= count || out.some(q => same(q, o))) continue;
    if (out.length < MAX_OBJECTS) out.push(o);
  }
  return out;
}
export const formatObjects = objs => objs.map(o => `${o.type}:${o.a}-${o.b}`).join(";");
/** A line or a segment is the same whichever end is named first; a ray is not. */
const same = (p, q) => p.type === q.type && ((p.a === q.a && p.b === q.b) || (p.type !== "r" && p.a === q.b && p.b === q.a));

// ---------- geometry ----------
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const dot = (a, b, p) => (b[0] - a[0]) * (p[0] - a[0]) + (b[1] - a[1]) * (p[1] - a[1]);

/** Ba điểm thẳng hàng. */
export const collinear = (a, b, c) => Math.abs(cross(a, b, c)) < EPS;
export const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Does point p lie on the line ("l"), the ray from a through b ("r"), or the segment ("s") ab? */
export function contains(type, a, b, p) {
  if (!collinear(a, b, p)) return false;
  const t = dot(a, b, p) / dot(a, b, b); // p = a + t (b − a)
  if (type === "r") return t >= -EPS;
  if (type === "s") return t >= -EPS && t <= 1 + EPS;
  return true;
}

/** Indices of the points lying on an object. */
export const pointsOn = (pts, o) => pts.flatMap((p, i) => (contains(o.type, pts[o.a], pts[o.b], p) ? [i] : []));

/**
 * Number of distinct lines through at least two of the points.
 * A line is counted at the pair of its two lowest-numbered points only.
 */
export function distinctLines(pts) {
  let count = 0;
  for (let j = 1; j < pts.length; j++)
    for (let i = 0; i < j; i++) {
      let first = true;
      for (let k = 0; k < j && first; k++) if (k !== i && collinear(pts[i], pts[j], pts[k])) first = false;
      if (first) count++;
    }
  return count;
}

/** Qua n điểm, không có ba điểm nào thẳng hàng: n(n − 1)/2 đường thẳng. */
export const lineCount = n => (n * (n - 1)) / 2;

/** Groups of three or more collinear points, each as a list of indices (one group per line). */
export function collinearGroups(pts) {
  const out = [];
  for (let j = 1; j < pts.length; j++)
    for (let i = 0; i < j; i++) {
      const group = pts.flatMap((p, k) => (collinear(pts[i], pts[j], p) ? [k] : []));
      if (group.length >= 3 && group[0] === i && group[1] === j) out.push(group);
    }
  return out;
}

/** Pairs of rays (indices into objs) that are opposite: same origin, together they make a line. */
export function oppositeRays(pts, objs) {
  const out = [];
  objs.forEach((p, i) =>
    objs.forEach((q, j) => {
      if (i >= j || p.type !== "r" || q.type !== "r" || p.a !== q.a) return;
      const [o, u, v] = [pts[p.a], pts[p.b], pts[q.b]];
      if (collinear(o, u, v) && dot(o, u, v) < 0) out.push([i, j]);
    })
  );
  return out;
}

/** n points on a circle (count mode): no three of them are ever collinear. */
export const circlePoints = n =>
  Array.from({ length: n }, (_, i) => {
    const a = Math.PI / 2 + (2 * Math.PI * i) / n;
    return [W / 2 + 3.4 * Math.cos(a), H / 2 + 3.4 * Math.sin(a)];
  });

// ---------- editing (all return true when something changed) ----------
export function addPoint(s, x, y) {
  const pts = parsePoints(s.points);
  const before = pts.length;
  const next = parsePoints(`${s.points};${x},${y}`);
  if (next.length === before) return false;
  s.points = formatPoints(next);
  return true;
}

/** First free grid node of a fixed list, for the "Thêm điểm" button. */
export function freeSpot(s) {
  const pts = parsePoints(s.points);
  for (const [x, y] of [[2, 2], [7, 6], [10, 3], [6, 1], [3, 4], [8, 4], [11, 7], [1, 1], [5, 7], [9, 5]]) if (!pts.some(p => p[0] === x && p[1] === y)) return [x, y];
  return null;
}

export function movePoint(s, i, x, y) {
  const pts = parsePoints(s.points);
  if (!pts[i] || !int(x, 0, W) || !int(y, 0, H) || pts.some(p => p[0] === x && p[1] === y)) return false;
  pts[i] = [x, y];
  s.points = formatPoints(pts);
  return true;
}

export function addObject(s, type, a, b) {
  const pts = parsePoints(s.points);
  const objs = parseObjects(s.objects, pts.length);
  const next = parseObjects(`${formatObjects(objs)};${type}:${a}-${b}`, pts.length);
  if (next.length === objs.length) return false;
  s.objects = formatObjects(next);
  return true;
}

export function undo(s) {
  const pts = parsePoints(s.points);
  const objs = parseObjects(s.objects, pts.length);
  if (objs.length) s.objects = formatObjects(objs.slice(0, -1));
  else if (pts.length) s.points = formatPoints(pts.slice(0, -1));
  else return false;
  return true;
}

// ---------- midpoint ----------
const grid = (v, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(0, Math.round(v))) : fallback);

/** Segment AB of the midpoint activity, clamped to the grid; A and B never coincide. */
export function segment(s) {
  const a = [grid(s.ax, W, 2), grid(s.ay, H, 1)];
  const b = [grid(s.bx, W, 10), grid(s.by, H, 7)];
  if (a[0] === b[0] && a[1] === b[1]) b[0] = a[0] < W ? a[0] + 1 : a[0] - 1;
  const length = distance(a, b);
  const am = Math.min(length, Math.max(0, Number.isFinite(s.am) ? s.am : 0));
  const m = [a[0] + ((b[0] - a[0]) * am) / length, a[1] + ((b[1] - a[1]) * am) / length];
  return { a, b, length, am, mb: length - am, m, mid: midpoint(a, b) };
}

export const MID_TOLERANCE = 0.05; // cm: half a step of the AM slider

/** Write the clamped segment back; M snaps to the midpoint when it is within the tolerance. */
export function settle(s) {
  const g = segment(s);
  [s.ax, s.ay, s.bx, s.by] = [...g.a, ...g.b];
  s.am = Math.abs(g.am - g.length / 2) <= MID_TOLERANCE ? g.length / 2 : g.am;
  return (s.found = s.am === g.length / 2);
}
