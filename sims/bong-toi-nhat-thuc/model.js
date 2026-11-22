// Shadows by straight-line light propagation, side view.
// Part 1: lengths in cm, the screen stands at SCREEN_X; everything is centred on the axis y = 0.
// Part 2: a schematic Sun–Earth–Moon system in arbitrary units (NOT to scale), same shadow rule.

export const SCREEN_X = 100; // cm
export const MIN_GAP = 10; // cm, least source–object distance
export const MAX_OBJECT_X = 90; // cm

export const initialState = () => ({
  part: "shadow", // "shadow" | "eclipse"
  source: "bulb", // "point" | "bulb"
  bulbSize: 8, // cm, diameter of the bulb
  sourceX: 10, // cm
  objectX: 45, // cm
  objectSize: 12, // cm, diameter of the opaque disc
  moonAngle: 160, // degrees around the Earth, 180 = towards the Sun
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Positions actually used (forged or out-of-order states are pulled back into range). */
export function placed(s) {
  const sourceX = clamp(s.sourceX, 0, MAX_OBJECT_X - MIN_GAP);
  const objectX = clamp(s.objectX, sourceX + MIN_GAP, MAX_OBJECT_X);
  return { sourceX, objectX, d: s.source === "point" ? 0 : Math.max(0, s.bulbSize), h: Math.max(0, s.objectSize) };
}

/**
 * Half-widths at distance x behind an opaque body of radius r that is lit by a source of radius R
 * whose centre is L in front of it (similar triangles through the edges):
 *   umbra      u(x) = r − (R − r)·x / L   (line through the same-side edges)
 *   penumbra   p(x) = r + (R + r)·x / L   (line through opposite edges)
 * u ≤ 0 means the umbra cone has ended before x.
 */
export const halfWidths = (R, r, L, x) => ({ u: r - ((R - r) * x) / L, p: r + ((R + r) * x) / L });

/** Point source: umbra on the screen h·(source–screen)/(source–object). */
export const pointUmbra = (h, sourceToObject, sourceToScreen) => (h * sourceToScreen) / sourceToObject;

/** Shadow on the screen (cm): umbra diameter, penumbra ring width (each side), whole shadow diameter. */
export function screenShadow(s) {
  const { sourceX, objectX, d, h } = placed(s);
  const { u, p } = halfWidths(d / 2, h / 2, objectX - sourceX, SCREEN_X - objectX);
  const umbra = 2 * Math.max(0, u);
  return { umbra, penumbra: p - Math.max(0, u), outer: 2 * p, u, p, sourceToObject: objectX - sourceX, sourceToScreen: SCREEN_X - sourceX };
}

// ---------- Part 2: eclipses (schematic units) ----------
export const SUN = { x: -40, y: 0, r: 4.3 };
export const EARTH = { x: 0, y: 0, r: 1 };
export const MOON_R = 0.4;
export const ORBIT = 4;

export function moonPos(angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: ORBIT * Math.cos(a), y: ORBIT * Math.sin(a), r: MOON_R };
}

/** Shadow axis of `body` lit by the Sun: unit vector e pointing away from the Sun, and distance L. */
export function axis(body) {
  const dx = body.x - SUN.x;
  const dy = body.y - SUN.y;
  const L = Math.hypot(dx, dy);
  return { L, ex: dx / L, ey: dy / L };
}

/**
 * How much of disc `target` lies in the umbra (or penumbra) of `body`:
 * "all", "some" or "none". The disc is cut into thin slices across the shadow axis.
 */
export function inShadow(body, target, which) {
  const { L, ex, ey } = axis(body);
  const rx = target.x - body.x;
  const ry = target.y - body.y;
  const tx = rx * ex + ry * ey; // along the axis, behind the body
  const ty = Math.abs(-rx * ey + ry * ex); // off the axis
  let some = false;
  let all = true;
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const x = tx - target.r + (2 * target.r * i) / N;
    const w = Math.sqrt(Math.max(0, target.r ** 2 - (x - tx) ** 2));
    const h = x > 0 ? halfWidths(SUN.r, body.r, L, x)[which] : 0;
    if (h <= 0) {
      all = false;
      continue;
    }
    if (ty - w < h) some = true;
    if (ty + w > h) all = false;
  }
  return all && some ? "all" : some ? "some" : "none";
}

/** "solar-total" | "solar-partial" | "lunar-total" | "lunar-partial" | "lunar-penumbral" | "none" */
export function eclipse(angleDeg) {
  const moon = moonPos(angleDeg);
  if (inShadow(moon, EARTH, "u") !== "none") return "solar-total"; // somewhere on Earth the Sun is fully hidden
  if (inShadow(moon, EARTH, "p") !== "none") return "solar-partial";
  const lunar = inShadow(EARTH, moon, "u");
  if (lunar === "all") return "lunar-total";
  if (lunar === "some") return "lunar-partial";
  if (inShadow(EARTH, moon, "p") !== "none") return "lunar-penumbral";
  return "none";
}

/** Order of the three bodies along the Sun's direction, as a list of names. */
export function order(angleDeg) {
  const m = moonPos(angleDeg);
  return [
    ["Mặt Trời", SUN.x],
    ["Trái Đất", EARTH.x],
    ["Mặt Trăng", m.x],
  ]
    .sort((a, b) => a[1] - b[1])
    .map(n => n[0]);
}
