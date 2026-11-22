// Perpendicularity and angles in space (lớp 11) on a cube ABCD.A'B'C'D' (edge 1) and a regular
// pyramid S.ABCD (base edge 1, lateral edge 1 or √2). Points are [x, y, z], z up.
// A pair is (line or plane, plane). Angles in degrees.

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const mul = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
export const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const len = p => Math.hypot(p[0], p[1], p[2]);
const unit = p => mul(p, 1 / (len(p) || 1));
const mean = ps => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
const DEG = 180 / Math.PI;
const EPS = 1e-9;

/** Angle between two vectors, 0..180°. */
export const angleOf = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v))))) * DEG;

// Relation codes (also sent in events).
export const IN = 0; // line in the plane, or the same plane
export const PARALLEL = 1;
export const PERPENDICULAR = 2;
export const OBLIQUE = 3; // they meet at an angle strictly between 0° and 90°

export const SOLIDS = {
  cube: {
    vertices: ["A", "B", "C", "D", "A'", "B'", "C'", "D'"],
    faces: [["A", "B", "C", "D"], ["A'", "B'", "C'", "D'"], ["A", "B", "B'", "A'"], ["B", "C", "C'", "B'"], ["C", "D", "D'", "C'"], ["D", "A", "A'", "D'"]],
    lines: ["AA'", "AB", "AC", "BD", "A'B", "B'D'", "A'C", "AC'"],
    planes: ["(ABCD)", "(A'B'C'D')", "(ABB'A')", "(BCC'B')", "(CDD'C')", "(ACC'A')", "(BDD'B')", "(A'BD)", "(CB'D')", "(ABC'D')"],
    quiz: ["(ABCD)", "(ACC'A')", "(A'BD)", "(BCC'B')"],
  },
  pyramid: {
    vertices: ["A", "B", "C", "D", "S", "O", "M"],
    faces: [["A", "B", "C", "D"], ["S", "A", "B"], ["S", "B", "C"], ["S", "C", "D"], ["S", "D", "A"]],
    lines: ["SA", "SC", "SO", "SM", "AB", "CD", "AC", "BD"],
    planes: ["(ABCD)", "(SAB)", "(SCD)", "(SAC)", "(SBD)", "(SOM)"],
    quiz: ["(ABCD)", "(SAC)", "(SBD)", "(SOM)"],
  },
};

/** Textbook examples: [id, solid, lateral edge (pyramid), first element, plane, label]. */
export const EXAMPLES = [
  ["c1", "cube", null, "A'C", "(ABCD)", "Lập phương: góc giữa A'C và (ABCD)"],
  ["c2", "cube", null, "A'B", "(ABCD)", "Lập phương: góc giữa A'B và (ABCD)"],
  ["c3", "cube", null, "BD", "(ACC'A')", "Lập phương: BD ⊥ (ACC'A')"],
  ["c4", "cube", null, "AC'", "(A'BD)", "Lập phương: AC' ⊥ (A'BD)"],
  ["c5", "cube", null, "(ACC'A')", "(BDD'B')", "Lập phương: (ACC'A') ⊥ (BDD'B')"],
  ["c6", "cube", null, "(A'BD)", "(ABCD)", "Lập phương: góc giữa (A'BD) và (ABCD)"],
  ["c7", "cube", null, "(ABC'D')", "(ABCD)", "Lập phương: góc giữa (ABC'D') và (ABCD)"],
  ["c8", "cube", null, "(A'BD)", "(CB'D')", "Lập phương: (A'BD) // (CB'D')"],
  ["c9", "cube", null, "BD", "(CB'D')", "Lập phương: BD // (CB'D')"],
  ["p1", "pyramid", "a", "SA", "(ABCD)", "Chóp đều, mọi cạnh bằng a: góc giữa SA và (ABCD)"],
  ["p2", "pyramid", "a2", "SA", "(ABCD)", "Chóp đều, SA = a√2: góc giữa SA và (ABCD)"],
  ["p3", "pyramid", "a", "SO", "(ABCD)", "Chóp đều: SO ⊥ (ABCD)"],
  ["p4", "pyramid", "a", "BD", "(SAC)", "Chóp đều: BD ⊥ (SAC)"],
  ["p5", "pyramid", "a", "(SAC)", "(SBD)", "Chóp đều: (SAC) ⊥ (SBD)"],
  ["p6", "pyramid", "a", "(SCD)", "(ABCD)", "Chóp đều, mọi cạnh bằng a: góc giữa (SCD) và (ABCD)"],
  ["p7", "pyramid", "a2", "(SCD)", "(ABCD)", "Chóp đều, SA = a√2: góc giữa (SCD) và (ABCD)"],
  ["p8", "pyramid", "a", "CD", "(SOM)", "Chóp đều: CD ⊥ (SOM), M là trung điểm CD"],
  ["p9", "pyramid", "a", "AB", "(SCD)", "Chóp đều: AB // (SCD)"],
];

export const initialState = () => ({
  solid: "cube", // "cube" | "pyramid"
  edge: "a", // pyramid lateral edge SA: "a" or "a2" (a√2); base edge is a
  mode: "explore", // "explore" | "quiz"
  example: "c1", // id from EXAMPLES, "" once the learner picks a pair by hand
  c1: "A'C", // cube: first element (line or plane), second element (plane)
  c2: "(ABCD)",
  p1: "SA", // pyramid: the same
  p2: "(ABCD)",
  yaw: -28, // degrees, turn about the vertical axis
  pitch: 22, // degrees, positive looks down from above
  quiz: 0, // index of the quiz question (a plane of the solid)
  solved: false, // the current quiz question has been answered
  found: 0, // quiz questions answered
});

/** Named points of the solid (edge a = 1). */
export function points(s) {
  if (s.solid === "pyramid") {
    const h = s.edge === "a2" ? Math.sqrt(1.5) : Math.SQRT1_2; // SO = √(SA² − OA²), OA = a√2/2
    return { A: [-0.5, -0.5, 0], B: [0.5, -0.5, 0], C: [0.5, 0.5, 0], D: [-0.5, 0.5, 0], O: [0, 0, 0], M: [0, 0.5, 0], S: [0, 0, h] };
  }
  return { A: [0, 0, 0], B: [1, 0, 0], C: [1, 1, 0], D: [0, 1, 0], "A'": [0, 0, 1], "B'": [1, 0, 1], "C'": [1, 1, 1], "D'": [0, 1, 1], O: [0.5, 0.5, 0] };
}

export const names = id => id.match(/[A-Z]'?/g) ?? [];

/** A line { kind, id, names, p, q } or a plane { kind, id, names, pts } from its name, e.g. "A'C" or "(ABCD)". */
export function element(s, id) {
  const P = points(s);
  const n = names(id);
  if (id.startsWith("(")) return { kind: "plane", id, names: n, pts: n.map(k => P[k]) };
  return { kind: "line", id, names: n, p: P[n[0]], q: P[n[1]] };
}

/** Plane through the first three points: unit normal n and d with n·x = d. */
export function planeOf(pts) {
  const n = unit(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  return { n, d: dot(n, pts[0]) };
}
const offset = (P, x) => dot(P.n, x) - P.d;

/** Orthogonal projection of a point on a plane. */
export const project = (P, x) => sub(x, mul(P.n, offset(P, x)));

/** First element and plane of the current pair, per solid. */
export const pairIds = s => {
  const [a, b] = s.solid === "pyramid" ? [s.p1, s.p2] : [s.c1, s.c2];
  return [a, s.mode === "quiz" ? quizPlane(s) : b]; // in quiz mode the plane is the question, whatever the state says
};

/**
 * Relation of e1 (line or plane) with the plane e2.
 * line: { code, angle, I (meeting point), M (point of the line off the plane), H (projection of M) }
 * plane: { code, angle, u (direction of the common line), K (point on it), v1, v2 (lines in each plane ⊥ the common line at K) }
 */
export function relate(e1, e2) {
  const P = planeOf(e2.pts);
  if (e1.kind === "line") {
    const dir = sub(e1.q, e1.p);
    const c = Math.abs(dot(unit(dir), P.n)); // sine of the angle
    if (c < EPS) return { code: Math.abs(offset(P, e1.p)) < EPS ? IN : PARALLEL, angle: 0 };
    const I = add(e1.p, mul(dir, -offset(P, e1.p) / dot(dir, P.n)));
    const M = Math.abs(offset(P, e1.p)) >= Math.abs(offset(P, e1.q)) ? e1.p : e1.q;
    const H = project(P, M);
    if (c > 1 - EPS) return { code: PERPENDICULAR, angle: 90, I, M, H: I };
    // the angle between the line and its projection IH
    return { code: OBLIQUE, angle: angleOf(sub(M, I), sub(H, I)), I, M, H };
  }
  const Q = planeOf(e1.pts);
  const u = cross(Q.n, P.n);
  if (len(u) < EPS) return { code: Math.abs(offset(P, e1.pts[0])) < EPS ? IN : PARALLEL, angle: 0 };
  const uh = unit(u);
  const c = dot(Q.n, P.n);
  const x0 = mul(add(mul(Q.n, Q.d - P.d * c), mul(P.n, P.d - Q.d * c)), 1 / (1 - c * c)); // on both planes
  const G = mean([mean(e1.pts), mean(e2.pts)]);
  const K = add(x0, mul(uh, dot(sub(G, x0), uh)));
  const toward = (n, pts) => {
    const v = unit(cross(n, uh)); // in the plane, ⊥ the common line
    return dot(v, sub(mean(pts), K)) < 0 ? mul(v, -1) : v;
  };
  const v1 = toward(Q.n, e1.pts);
  const v2 = toward(P.n, e2.pts);
  const angle = Math.acos(Math.min(1, Math.abs(c))) * DEG; // angle between the normals, folded into 0..90°
  return { code: Math.abs(c) < EPS ? PERPENDICULAR : OBLIQUE, angle, u: uh, K, v1, v2, open: angleOf(v1, v2) };
}

/** Relation of the current pair. */
export function relation(s) {
  const [a, b] = pairIds(s);
  return relate(element(s, a), element(s, b));
}

/** Named point at x, if any. */
export function nameAt(s, x) {
  for (const [k, p] of Object.entries(points(s))) if (len(sub(p, x)) < 1e-7) return k;
  return null;
}

/** Named points on the line through x0 with direction u. */
export const namesOnLine = (s, x0, u) => Object.entries(points(s)).filter(([, p]) => len(cross(sub(p, x0), u)) < 1e-7).map(([k]) => k);

/** Current quiz plane (index made safe against a forged state). */
export function quizPlane(s) {
  const list = SOLIDS[s.solid]?.quiz ?? SOLIDS.cube.quiz;
  const i = Math.floor(Number.isFinite(s.quiz) ? s.quiz : 0);
  return list[((i % list.length) + list.length) % list.length];
}

// ---------- view ----------

/** Turn by yaw about z, then tilt by pitch; returns [x right, y up, depth away from the eye]. */
export function rotate([x, y, z], yaw, pitch) {
  const t = (yaw * Math.PI) / 180;
  const f = (pitch * Math.PI) / 180;
  const x1 = x * Math.cos(t) - y * Math.sin(t);
  const y1 = x * Math.sin(t) + y * Math.cos(t);
  return [x1, y1 * Math.sin(f) + z * Math.cos(f), y1 * Math.cos(f) - z * Math.sin(f)];
}

/** Centre of the solid's vertices, so it turns about its middle. */
export const centre = s => mean(SOLIDS[s.solid].vertices.map(k => points(s)[k]));

/** Faces that look towards the eye (at distance `dist` in front of the centre). */
export function frontFaces(s, yaw, pitch, dist) {
  const P = points(s);
  const c = centre(s);
  const V = x => rotate(sub(x, c), yaw, pitch);
  return SOLIDS[s.solid].faces.map(f => {
    const pts = f.map(k => V(P[k]));
    let n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    const m = mean(pts);
    if (dot(n, m) < 0) n = mul(n, -1); // outward: away from the centre
    return { names: f, front: dot(n, sub([0, 0, -dist], m)) > EPS };
  });
}

/** Is the segment pq on some face that faces the eye (drawn solid) or not (drawn dashed)? */
export function segmentVisible(s, p, q, faces) {
  const P = points(s);
  return faces.some(f => {
    if (!f.front) return false;
    const pl = planeOf(f.names.map(k => P[k]));
    return Math.abs(offset(pl, p)) < 1e-7 && Math.abs(offset(pl, q)) < 1e-7;
  });
}
