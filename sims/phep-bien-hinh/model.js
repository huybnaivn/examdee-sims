// Plane isometries on a coordinate grid. Every transformation is an affine map
//   x' = a·x + b·y + e,   y' = c·x + d·y + f
// stored as [a, b, c, d, e, f], so two of them compose by matrix product.

export const LIMIT = 8; // vertices stay within −LIMIT..LIMIT on both axes
export const NAMES = ["A", "B", "C", "D", "E"];

export const PRESETS = {
  triangle: [[1, 1], [4, 2], [2, 4]],
  quad: [[1, 1], [5, 1], [4, 3], [1, 4]],
  pentagon: [[1, 0], [4, 0], [5, 2], [2, 4], [0, 2]], // no symmetry axis, so reflections show
};

// Numeric codes reported to the host (documented in manifest.json).
export const CODES = { translate: 1, ox: 2, oy: 3, yx: 4, vertical: 5, horizontal: 6, rotate: 7, central: 8 };

const group = sfx => ({
  [`kind${sfx}`]: sfx ? "reflect" : "rotate", // "translate" | "reflect" | "rotate" | "central"
  [`tx${sfx}`]: 3, // translation vector v = (tx; ty)
  [`ty${sfx}`]: -2,
  [`axis${sfx}`]: "oy", // "ox" | "oy" | "yx" | "vertical" (x = m) | "horizontal" (y = m)
  [`m${sfx}`]: 2, // position of the chosen vertical / horizontal line
  [`center${sfx}`]: "origin", // "origin" | "point": centre of rotation / symmetry
  [`cx${sfx}`]: 1, // the chosen centre I
  [`cy${sfx}`]: -1,
  [`angle${sfx}`]: 90, // 90 | 180 | 270 | 0 (0 = free angle)
  [`free${sfx}`]: 45, // free angle in degrees, positive = counter-clockwise
});

export const initialState = () => ({
  preset: "triangle",
  points: PRESETS.triangle.map(p => [...p]),
  sel: 0, // selected vertex (index into points)
  vx: 1, // coordinates of the selected vertex, mirrored for the sliders
  vy: 1,
  ...group(""),
  compose: false,
  ...group("2"),
});

const finite = (v, dflt = 0) => (Number.isFinite(v) ? v : dflt);
const clean = v => {
  const r = Math.round(v * 1e9) / 1e9; // cos/sin rounding noise
  return r === 0 ? 0 : r;
};

/** cos and sin of `deg` degrees, exact for multiples of 90°. */
export function trig(deg) {
  const q = ((deg % 360) + 360) % 360;
  const exact = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] }[q];
  if (exact) return exact;
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

/** The transformation number `n` (1 or 2) of state `s` as a plain description. */
export function describe(s, n = 1) {
  const k = n === 2 ? "2" : "";
  const kind = ["translate", "reflect", "rotate", "central"].includes(s[`kind${k}`]) ? s[`kind${k}`] : "translate";
  const axis = ["ox", "oy", "yx", "vertical", "horizontal"].includes(s[`axis${k}`]) ? s[`axis${k}`] : "ox";
  const atPoint = s[`center${k}`] === "point";
  const angle = [90, 180, 270].includes(s[`angle${k}`]) ? s[`angle${k}`] : finite(s[`free${k}`]);
  return {
    kind,
    axis,
    tx: finite(s[`tx${k}`]),
    ty: finite(s[`ty${k}`]),
    m: finite(s[`m${k}`]),
    cx: atPoint ? finite(s[`cx${k}`]) : 0,
    cy: atPoint ? finite(s[`cy${k}`]) : 0,
    angle,
    code: kind === "reflect" ? CODES[axis] : CODES[kind],
  };
}

/** Affine matrix [a, b, c, d, e, f] of a description. */
export function matrix(t) {
  if (t.kind === "translate") return [1, 0, 0, 1, t.tx, t.ty];
  if (t.kind === "reflect") {
    return {
      ox: [1, 0, 0, -1, 0, 0],
      oy: [-1, 0, 0, 1, 0, 0],
      yx: [0, 1, 1, 0, 0, 0],
      vertical: [-1, 0, 0, 1, 2 * t.m, 0],
      horizontal: [1, 0, 0, -1, 0, 2 * t.m],
    }[t.axis];
  }
  if (t.kind === "central") return [-1, 0, 0, -1, 2 * t.cx, 2 * t.cy];
  const [c, s] = trig(t.angle);
  return [c, -s, s, c, t.cx - c * t.cx + s * t.cy, t.cy - s * t.cx - c * t.cy].map(v => v + 0); // no −0
}

export const apply = (M, [x, y]) => [clean(M[0] * x + M[1] * y + M[4]), clean(M[2] * x + M[3] * y + M[5])];

/** Matrix of "first M1, then M2". */
export const then = (M1, M2) => [
  M2[0] * M1[0] + M2[1] * M1[2],
  M2[0] * M1[1] + M2[1] * M1[3],
  M2[2] * M1[0] + M2[3] * M1[2],
  M2[2] * M1[1] + M2[3] * M1[3],
  M2[0] * M1[4] + M2[1] * M1[5] + M2[4],
  M2[2] * M1[4] + M2[3] * M1[5] + M2[5],
];

/** Images: `first` after transformation 1, `second` after 2 (null unless composing); `final` is what the learner sees last. */
export function images(s) {
  const pts = s.points;
  const M1 = matrix(describe(s, 1));
  const first = pts.map(p => apply(M1, p));
  const second = s.compose ? first.map(p => apply(matrix(describe(s, 2)), p)) : null;
  return { first, second, final: second ?? first, M: s.compose ? then(M1, matrix(describe(s, 2))) : M1 };
}

/**
 * What a single isometry M is: translation, rotation (180° = central symmetry), reflection in a line,
 * or a reflection followed by a translation along the same line (glide reflection).
 */
const r6 = v => Math.round(v * 1e6) / 1e6 + 0; // what is shown and compared: 6 decimals

export function classify(M) {
  const [a, b, c, d, e, f] = M.map(clean);
  const det = clean(a * d - b * c);
  if (det > 0) {
    if (r6(a) === 1 && r6(b) === 0 && r6(c) === 0 && r6(d) === 1) return r6(e) === 0 && r6(f) === 0 ? { type: "identity" } : { type: "translate", tx: r6(e), ty: r6(f) };
    // fixed point: (I − R)·p = (e, f)
    const A = 1 - a;
    const B = -b;
    const C = -c;
    const D = 1 - d;
    const k = A * D - B * C;
    const angle = r6((Math.atan2(c, a) * 180) / Math.PI);
    return { type: Math.abs(angle) === 180 ? "central" : "rotate", angle, cx: r6((e * D - B * f) / k), cy: r6((A * f - e * C) / k) };
  }
  // reflection: applying it twice gives the identity
  const twice = then(M, M).map(r6);
  const involution = twice[4] === 0 && twice[5] === 0;
  return { type: involution ? "reflect" : "glide", shift: [r6(twice[4] / 2), r6(twice[5] / 2)] };
}

export const length = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

/** Signed area (shoelace): positive when the vertices go counter-clockwise. */
export function signedArea(pts) {
  let sum = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    sum += p[0] * q[1] - q[0] * p[1];
  });
  return sum / 2;
}

const snap = v => Math.max(-LIMIT, Math.min(LIMIT, Math.round(finite(v))));

/** Move vertex i to (x, y), snapped to the grid. */
export function moveVertex(s, i, x, y) {
  s.points[i] = [snap(x), snap(y)];
  s.sel = i;
  s.vx = s.points[i][0];
  s.vy = s.points[i][1];
  return s;
}

export function usePreset(s, name) {
  s.preset = PRESETS[name] ? name : "triangle";
  s.points = PRESETS[s.preset].map(p => [...p]);
  return moveVertex(s, 0, s.points[0][0], s.points[0][1]);
}

/** Incoming (untrusted) state: keep known keys of the right type; points must be 3–5 grid points. */
export function sanitize(incoming, base) {
  const out = {};
  for (const key of Object.keys(base)) {
    const v = incoming[key];
    if (key === "points") continue;
    if (typeof v !== typeof base[key]) continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    out[key] = v;
  }
  const pts = incoming.points;
  const ok = Array.isArray(pts) && pts.length >= 3 && pts.length <= NAMES.length && pts.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
  out.points = ok ? pts.map(p => [snap(p[0]), snap(p[1])]) : PRESETS[PRESETS[out.preset] ? out.preset : "triangle"].map(p => [...p]);
  out.sel = Math.max(0, Math.min(out.points.length - 1, Math.round(finite(out.sel))));
  out.vx = out.points[out.sel][0];
  out.vy = out.points[out.sel][1];
  return out;
}
