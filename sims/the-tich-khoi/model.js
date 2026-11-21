// Volume and surface area of solids, a small mesh for each, and a perspective projection.
// Lengths in cm, angles of the view in degrees. y is up; every solid is centred on the origin.

export const SOLIDS = ["box", "cube", "prism", "pyramid", "cylinder", "cone", "sphere"];
export const MIN = 1;
export const MAX = 10;

export const initialState = () => ({
  solid: "box",
  a: 6, // cm: box length, cube edge, prism leg, pyramid base edge
  b: 4, // cm: box width, prism second leg
  h: 3, // cm: height
  r: 3, // cm: radius
  yaw: 35, // degrees, turn about the vertical axis
  pitch: 20, // degrees, positive looks down on the top face
  showNet: false,
});

const dims = s => {
  const d = k => Math.min(MAX, Math.max(MIN, Number.isFinite(s[k]) ? s[k] : MIN)); // forged state stays in range
  return { a: d("a"), b: d("b"), h: d("h"), r: d("r") };
};

/** Volume V, lateral area Sxq, total area Stp (for the sphere both areas are the sphere's area). */
export function measure(s) {
  const { a, b, h, r } = dims(s);
  switch (s.solid) {
    case "cube":
      return { volume: a ** 3, lateral: 4 * a * a, total: 6 * a * a };
    case "prism": {
      const c = Math.hypot(a, b); // right-angled triangle base with legs a, b
      const base = (a * b) / 2;
      return { volume: base * h, lateral: (a + b + c) * h, total: (a + b + c) * h + 2 * base };
    }
    case "pyramid": {
      const d = Math.hypot(h, a / 2); // apothem (trung đoạn)
      const lateral = 2 * a * d; // p·d, p = half the base perimeter = 2a
      return { volume: (a * a * h) / 3, lateral, total: lateral + a * a, apothem: d };
    }
    case "cylinder":
      return { volume: Math.PI * r * r * h, lateral: 2 * Math.PI * r * h, total: 2 * Math.PI * r * h + 2 * Math.PI * r * r };
    case "cone": {
      const l = Math.hypot(r, h); // slant height (đường sinh)
      return { volume: (Math.PI * r * r * h) / 3, lateral: Math.PI * r * l, total: Math.PI * r * l + Math.PI * r * r, slant: l };
    }
    case "sphere":
      return { volume: (4 / 3) * Math.PI * r ** 3, lateral: 4 * Math.PI * r * r, total: 4 * Math.PI * r * r };
    default:
      return { volume: a * b * h, lateral: 2 * (a + b) * h, total: 2 * (a + b) * h + 2 * a * b };
  }
}

// ---------- meshes ----------

const ring = (n, r, y) => Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), y, r * Math.sin((2 * Math.PI * i) / n)]);

/**
 * { verts, faces (vertex index lists), forced (edge keys always drawn), marks }.
 * A mark labels one length: either one of several parallel `edges` (vertex pairs; the view picks a
 * visible one) or a drawn segment chosen from `lines` (point pairs, label at fraction `at`; `outline` picks the one furthest right on screen).
 */
export function mesh(s) {
  const { a, b, h, r } = dims(s);
  const k = s.solid;
  if (k === "box" || k === "cube") {
    const [x, y, z] = k === "cube" ? [a / 2, a / 2, a / 2] : [a / 2, h / 2, b / 2];
    const verts = [];
    for (const sy of [-1, 1]) for (const [sx, sz] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) verts.push([sx * x, sy * y, sz * z]);
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const marks = [
      { edges: [[0, 1], [3, 2], [4, 5], [7, 6]], text: "a" },
      { edges: [[1, 2], [0, 3], [5, 6], [4, 7]], text: k === "cube" ? "a" : "b" },
      { edges: [[0, 4], [1, 5], [2, 6], [3, 7]], text: k === "cube" ? "a" : "h" },
    ];
    return { verts, faces, marks };
  }
  if (k === "prism") {
    const tri = [[0, 0], [a, 0], [0, b]].map(([x, z]) => [x - a / 3, z - b / 3]);
    const verts = [...tri.map(([x, z]) => [x, -h / 2, z]), ...tri.map(([x, z]) => [x, h / 2, z])];
    const faces = [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]];
    const marks = [
      { edges: [[0, 1], [3, 4]], text: "a" },
      { edges: [[0, 2], [3, 5]], text: "b" },
      { edges: [[0, 3], [1, 4], [2, 5]], text: "h" },
    ];
    return { verts, faces, marks };
  }
  if (k === "pyramid") {
    const verts = [[-a / 2, -h / 2, a / 2], [a / 2, -h / 2, a / 2], [a / 2, -h / 2, -a / 2], [-a / 2, -h / 2, -a / 2], [0, h / 2, 0]];
    const faces = [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
    const marks = [
      { edges: [[0, 1], [1, 2], [2, 3], [3, 0]], text: "a" },
      { lines: [[[0, -h / 2, 0], verts[4]]], text: "h" },
      { lines: [[0, 1], [1, 2], [2, 3], [3, 0]].map(([i, j]) => [verts[4], verts[i].map((v, c) => (v + verts[j][c]) / 2)]), text: "d", at: 0.75 },
    ];
    return { verts, faces, marks };
  }
  const n = 48;
  if (k === "cylinder") {
    const verts = [...ring(n, r, -h / 2), ...ring(n, r, h / 2)];
    const faces = [ring(n, 0, 0).map((_, i) => i), ring(n, 0, 0).map((_, i) => n + i)];
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
    const marks = [
      { lines: [[[0, h / 2, 0], verts[n]]], text: "r" },
      { lines: [[[0, -h / 2, 0], [0, h / 2, 0]]], text: "h" },
    ];
    return { verts, faces, marks };
  }
  if (k === "cone") {
    const verts = [...ring(n, r, -h / 2), [0, h / 2, 0]];
    const faces = [ring(n, 0, 0).map((_, i) => i)];
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
    const marks = [
      { lines: [[[0, -h / 2, 0], verts[0]]], text: "r" },
      { lines: [[[0, -h / 2, 0], verts[n]]], text: "h" },
      { lines: verts.slice(0, n).filter((_, i) => i % 4 === 0).map(v => [verts[n], v]), text: "l", outline: true },
    ];
    return { verts, faces, marks };
  }
  // sphere: latitude bands (even, so the equator is a mesh edge) and poles
  const lat = 18;
  const lon = 36;
  const verts = [[0, -r, 0]];
  for (let j = 1; j < lat; j++) {
    const phi = -Math.PI / 2 + (Math.PI * j) / lat;
    verts.push(...ring(lon, r * Math.cos(phi), r * Math.sin(phi)));
  }
  verts.push([0, r, 0]);
  const top = verts.length - 1;
  const at = (j, i) => 1 + (j - 1) * lon + (i % lon);
  const faces = [];
  for (let i = 0; i < lon; i++) {
    faces.push([0, at(1, i + 1), at(1, i)]);
    faces.push([top, at(lat - 1, i), at(lat - 1, i + 1)]);
    for (let j = 1; j < lat - 1; j++) faces.push([at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j + 1, i)]);
  }
  const forced = new Set();
  for (let i = 0; i < lon; i++) forced.add(edgeKey(at(lat / 2, i), at(lat / 2, i + 1)));
  const marks = [{ lines: [[[0, 0, 0], verts[at(lat / 2, 0)]]], text: "R" }];
  return { verts, faces, marks, forced };
}

const edgeKey = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const unit = p => {
  const n = Math.hypot(...p) || 1;
  return p.map(v => v / n);
};

/** Turn a point by yaw (about y) then pitch (about x), both in degrees. */
export function rotate([x, y, z], yaw, pitch) {
  const t = (yaw * Math.PI) / 180;
  const f = (pitch * Math.PI) / 180;
  const x1 = x * Math.cos(t) + z * Math.sin(t);
  const z1 = -x * Math.sin(t) + z * Math.cos(t);
  return [x1, y * Math.cos(f) - z1 * Math.sin(f), y * Math.sin(f) + z1 * Math.cos(f)];
}

/**
 * Project a mesh for a camera on the +z axis at distance `dist` (same units as the mesh).
 * Returns view-space points, faces with outward normal and front flag, and edges:
 * an edge is drawn when it is a crease (or forced) or on the outline; it is hidden
 * (dashed) when every face that meets it faces away from the camera.
 */
export function project(m, yaw, pitch, dist) {
  const pts = m.verts.map(v => rotate(v, yaw, pitch));
  const eye = [0, 0, dist];
  const faces = m.faces.map(f => {
    const p = f.map(i => pts[i]);
    const c = p.reduce((acc, q) => acc.map((v, k) => v + q[k] / p.length), [0, 0, 0]);
    let n = unit(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    if (dot(n, c) < 0) n = n.map(v => -v); // convex solid around the origin: outward = away from centre
    return { idx: f, centre: c, normal: n, front: dot(sub(eye, c), n) > 1e-9 };
  });
  const byEdge = new Map();
  faces.forEach((f, fi) =>
    f.idx.forEach((i, k) => {
      const key = edgeKey(i, f.idx[(k + 1) % f.idx.length]);
      if (!byEdge.has(key)) byEdge.set(key, []);
      byEdge.get(key).push(fi);
    })
  );
  const crease = Math.cos((25 * Math.PI) / 180);
  const edges = [];
  for (const [key, fs] of byEdge) {
    const [i, j] = key.split("-").map(Number);
    const [f1, f2 = f1] = fs.map(fi => faces[fi]);
    const sharp = dot(f1.normal, f2.normal) < crease || m.forced?.has(key);
    const outline = f1.front !== f2.front;
    if (!sharp && !outline) continue;
    edges.push({ i, j, hidden: !f1.front && !f2.front });
  }
  return { pts, faces, edges };
}

/** Screen position of a view-space point; `scale` is px per cm at the solid's centre. */
export const toScreen = ([x, y, z], dist, scale, cx, cy) => {
  const k = (scale * dist) / (dist - z);
  return [cx + x * k, cy - y * k];
};

/** Radius of a sphere around the origin that holds the solid. */
export const extent = s => Math.max(...mesh(s).verts.map(v => Math.hypot(...v)));

// ---------- nets ----------

const arc = (cx, cy, R, a0, a1, n = 48) => Array.from({ length: n + 1 }, (_, i) => [cx + R * Math.cos(a0 + ((a1 - a0) * i) / n), cy + R * Math.sin(a0 + ((a1 - a0) * i) / n)]);
const rect = (x, y, w, h, kind) => ({ kind, pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] });

/** The net as flat polygons in cm (y up), each a lateral "side" or a "base"; null for the sphere. */
export function net(s) {
  const { a, b, h, r } = dims(s);
  switch (s.solid) {
    case "box":
    case "cube": {
      const [w, d, H] = s.solid === "cube" ? [a, a, a] : [a, b, h];
      return [rect(0, 0, w, H, "side"), rect(w, 0, d, H, "side"), rect(w + d, 0, w, H, "side"), rect(2 * w + d, 0, d, H, "side"), rect(0, H, w, d, "base"), rect(0, -d, w, d, "base")];
    }
    case "prism": {
      const c = Math.hypot(a, b);
      return [rect(0, 0, a, h, "side"), rect(a, 0, b, h, "side"), rect(a + b, 0, c, h, "side"), { kind: "base", pts: [[0, h], [a, h], [a, h + b]] }, { kind: "base", pts: [[0, 0], [a, 0], [a, -b]] }];
    }
    case "pyramid": {
      const d = Math.hypot(h, a / 2);
      const m = a / 2;
      return [
        rect(-m, -m, a, a, "base"),
        { kind: "side", pts: [[-m, m], [m, m], [0, m + d]] },
        { kind: "side", pts: [[m, -m], [-m, -m], [0, -m - d]] },
        { kind: "side", pts: [[m, m], [m, -m], [m + d, 0]] },
        { kind: "side", pts: [[-m, -m], [-m, m], [-m - d, 0]] },
      ];
    }
    case "cylinder": {
      const w = 2 * Math.PI * r;
      return [rect(0, 0, w, h, "side"), { kind: "base", pts: arc(w / 2, h + r, r, 0, 2 * Math.PI, 64) }, { kind: "base", pts: arc(w / 2, -r, r, 0, 2 * Math.PI, 64) }];
    }
    case "cone": {
      const l = Math.hypot(r, h);
      const sweep = (2 * Math.PI * r) / l; // the sector's arc is the base circle's length
      const mid = Math.PI / 2;
      return [{ kind: "side", pts: [[0, 0], ...arc(0, 0, l, mid - sweep / 2, mid + sweep / 2, 96)] }, { kind: "base", pts: arc(0, l + r, r, 0, 2 * Math.PI, 64) }]; // touches the arc
    }
    default:
      return null;
  }
}

/** Shoelace area of a polygon. */
export const polygonArea = pts => Math.abs(pts.reduce((acc, [x, y], i) => acc + x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y, 0)) / 2;
