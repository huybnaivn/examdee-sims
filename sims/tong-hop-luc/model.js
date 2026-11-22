// Concurrent forces on a point (a ring or the knot a traffic light hangs from).
// Directions are in degrees, counter-clockwise from the horizontal pointing right, y up.

const RAD = Math.PI / 180;

export const initialState = () => ({
  mode: "lab", // "lab": ring held by spring scales; "light": traffic light hung on two cables
  count: 2, // number of strings with a spring scale in lab mode (2 or 3)
  weight: 10, // N, weight P hanging from the ring / of the light
  a1: 135, // °, direction of string 1 from the ring (0 = right, 90 = up, 180 = left)
  f1: 6, // N, reading of spring scale 1
  a2: 45,
  f2: 6,
  a3: 90,
  f3: 4,
  b1: 20, // °, angle of the left cable above the horizontal (light mode)
  b2: 20, // °, angle of the right cable above the horizontal
  showT: false, // light mode: reveal the tensions (the learner works them out first)
  showParallelogram: true,
});

export const vec = (F, deg) => ({ x: F * Math.cos(deg * RAD), y: F * Math.sin(deg * RAD) });

/** Vector sum of [{ x, y }]: { x, y, mag, deg }. */
export function sum(vs) {
  const x = vs.reduce((a, v) => a + v.x, 0);
  const y = vs.reduce((a, v) => a + v.y, 0);
  return { x, y, mag: Math.hypot(x, y), deg: Math.atan2(y, x) / RAD };
}

/** Parallelogram rule: |F1 + F2| for two forces at angle alpha (°) to each other. */
export const parallelogram = (F1, F2, alpha) => Math.sqrt(Math.max(0, F1 * F1 + F2 * F2 + 2 * F1 * F2 * Math.cos(alpha * RAD)));

/** Angle between two directions, 0..180°. */
export const angleBetween = (d1, d2) => {
  const d = Math.abs((((d1 - d2) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

/** The ring is in equilibrium when |ΣF| is within what the scales can show (0,1 N steps). */
export const tolerance = P => Math.max(0.15, 0.015 * P);

/** Lab mode: string forces, the weight and their resultant. */
export function lab(s) {
  const n = s.count === 3 ? 3 : 2;
  const strings = [[s.a1, s.f1], [s.a2, s.f2], [s.a3, s.f3]].slice(0, n).map(([deg, F]) => ({ deg, F, ...vec(F, deg) }));
  const weight = { deg: 270, F: s.weight, ...vec(s.weight, 270) };
  const net = sum([...strings, weight]);
  const f12 = sum(strings.slice(0, 2));
  return { strings, weight, net, f12, balanced: net.mag <= tolerance(s.weight) };
}

/**
 * Two cables at b1 (left) and b2 (right) above the horizontal hold a weight P.
 * ΣFx = 0: T1·cos b1 = T2·cos b2;  ΣFy = 0: T1·sin b1 + T2·sin b2 = P.
 */
export function hang(P, b1, b2) {
  const d = Math.sin((b1 + b2) * RAD);
  const t1 = (P * Math.cos(b2 * RAD)) / d;
  const t2 = (P * Math.cos(b1 * RAD)) / d;
  return { t1, t2, theta: 180 - b1 - b2, dir1: 180 - b1, dir2: b2 };
}

/** Symmetric hang: T = P / (2·cos(θ/2)), θ the angle between the two cables. */
export const symmetricTension = (P, theta) => P / (2 * Math.cos((theta / 2) * RAD));
