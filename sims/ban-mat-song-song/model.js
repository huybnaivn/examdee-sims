// Rays through glass: a parallel-sided slab, a right-angle prism, a two-prism periscope.
// One 2D tracer for all three: Snell's law n₁·sin i = n₂·sin r at each face, total internal
// reflection when sin r would exceed 1. Partial reflection is ignored. Lengths in cm, y up.

const RAD = Math.PI / 180;
export const CORNERS = ["tl", "tr", "br", "bl"]; // where the right angle of a prism sits, clockwise
export const PRISM = 4; // cm, leg of the right-angle prisms
export const PERISCOPE_H = 14; // cm, distance between the two prisms of the periscope

export const initialState = () => ({
  mode: "slab", // "slab" | "prism" | "periscope"
  angle: 50, // °, angle of incidence on the slab
  thickness: 5, // cm, slab thickness e
  n: 1.5, // refractive index of the slab
  turn: 90, // prism mode: 90 (ray turned through 90°) or 180 (ray sent back)
  prismN: 1.5, // refractive index of the prisms
  top: "bl", // periscope: right-angle corner of the upper prism
  bottom: "br", // periscope: right-angle corner of the lower prism
  solved: false, // periscope: the present arrangement works and has been reported
});

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

function inside(p, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const indexAt = (p, polys) => polys.find(g => inside(p, g.pts))?.n ?? 1;

/**
 * Trace a ray from `start` along unit `dir` through polygons [{ pts, n }] in air.
 * Returns { points, dir (final), steps: [{ kind: "refract" | "tir", i, r? }] } with angles in degrees.
 */
export function trace(start, dir, polys, far = 60, maxSteps = 12) {
  const points = [start];
  const steps = [];
  let p = start;
  let d = dir;
  for (let s = 0; s < maxSteps; s++) {
    let best = Infinity;
    let normal = null;
    for (const g of polys) {
      for (let i = 0; i < g.pts.length; i++) {
        const a = g.pts[i];
        const e = sub(g.pts[(i + 1) % g.pts.length], a);
        const den = cross(d, e);
        if (Math.abs(den) < 1e-12) continue;
        const ap = sub(a, p);
        const t = cross(ap, e) / den;
        const u = cross(ap, d) / den;
        if (t > 1e-9 && u >= 0 && u <= 1 && t < best) {
          best = t;
          const len = Math.hypot(...e);
          normal = [e[1] / len, -e[0] / len];
        }
      }
    }
    if (!normal) break;
    const q = [p[0] + d[0] * best, p[1] + d[1] * best];
    points.push(q);
    const nn = dot(normal, d) > 0 ? normal : [-normal[0], -normal[1]]; // along the ray
    const n1 = indexAt([q[0] - nn[0] * 1e-6, q[1] - nn[1] * 1e-6], polys);
    const n2 = indexAt([q[0] + nn[0] * 1e-6, q[1] + nn[1] * 1e-6], polys);
    const cosI = dot(nn, d);
    const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
    const sinR = (n1 / n2) * sinI;
    const i = Math.asin(Math.min(1, sinI)) / RAD;
    if (sinR > 1) {
      d = [d[0] - 2 * cosI * nn[0], d[1] - 2 * cosI * nn[1]];
      steps.push({ kind: "tir", i, n1, n2 });
    } else {
      const cosR = Math.sqrt(1 - sinR * sinR);
      const k = n1 / n2;
      d = [k * (d[0] - cosI * nn[0]) + cosR * nn[0], k * (d[1] - cosI * nn[1]) + cosR * nn[1]];
      steps.push({ kind: "refract", i, r: Math.asin(sinR) / RAD, n1, n2 });
    }
    const len = Math.hypot(...d);
    d = [d[0] / len, d[1] / len];
    p = q;
  }
  points.push([p[0] + d[0] * far, p[1] + d[1] * far]);
  return { points, dir: d, steps };
}

/** Textbook lateral shift of a slab: d = e·sin(i − r)/cos r. */
export const shiftFormula = (e, i, r) => (e * Math.sin((i - r) * RAD)) / Math.cos(r * RAD);
export const refractionAngle = (i, n) => Math.asin(Math.sin(i * RAD) / n) / RAD;
export const criticalAngle = n => Math.asin(1 / n) / RAD;

/** Slab from y = 0 to y = e; the ray meets the top face at the origin's x = 0. */
export function slab(s) {
  const e = Math.max(0.1, s.thickness);
  const n = Math.max(1, s.n);
  const i = Math.min(Math.max(s.angle, 0), 89);
  const W = 200;
  const dir = [Math.sin(i * RAD), -Math.cos(i * RAD)];
  const start = [-30 * dir[0], e - 30 * dir[1]];
  const t = trace(start, dir, [{ pts: [[-W, 0], [W, 0], [W, e], [-W, e]], n }], 60);
  const [, A, B] = t.points;
  const r = t.steps[0].r;
  const shift = Math.abs(cross(sub(B, start), dir));
  return { i, r, e, n, start, A, B, dir, out: t.dir, points: t.points, shift };
}

/** Right-angle isosceles prism as a triangle in the square cell centred at (cx, cy). */
export function cell(cx, cy, corner, a = PRISM) {
  const h = a / 2;
  const c = { tl: [cx - h, cy + h], tr: [cx + h, cy + h], br: [cx + h, cy - h], bl: [cx - h, cy - h] };
  const k = CORNERS.indexOf(corner);
  return [CORNERS[(k + 3) % 4], CORNERS[k], CORNERS[(k + 1) % 4]].map(x => c[x]);
}

/** Single prism: 90° turn (enters a leg, reflects on the hypotenuse) or 180° (enters the hypotenuse, reflects on both legs). */
export function prism(s) {
  const n = Math.max(1, s.prismN);
  const a = PRISM;
  let pts;
  let start;
  if (s.turn === 180) {
    const h = a * 0.75;
    pts = [[0, h], [h, 0], [0, -h]];
    start = [-10, h * 0.5];
  } else {
    pts = cell(a / 2, a / 2, "bl");
    start = [-10, a * 0.4];
  }
  const t = trace(start, [1, 0], [{ pts, n }], 40);
  const tir = t.steps.filter(x => x.kind === "tir").length;
  const turned = Math.round(Math.acos(Math.max(-1, Math.min(1, t.dir[0]))) / RAD);
  const want = s.turn === 180 ? 2 : 1;
  return { pts, points: t.points, steps: t.steps, tir, turned, works: tir === want && turned === s.turn, critical: criticalAngle(n), n };
}

/** Periscope: light from an object on the right at the upper prism's height, eye on the left at the lower one. */
export function periscope(s) {
  const n = Math.max(1, s.prismN);
  const polys = [
    { pts: cell(0, PERISCOPE_H, s.top), n },
    { pts: cell(0, 0, s.bottom), n },
  ];
  const t = trace([12, PERISCOPE_H], [-1, 0], polys, 30);
  const last = t.points.at(-2);
  const tir = t.steps.filter(x => x.kind === "tir").length;
  const works = tir === 2 && t.dir[0] < -0.999 && Math.abs(last[1]) <= PRISM / 2;
  return { polys, points: t.points, steps: t.steps, tir, works };
}
