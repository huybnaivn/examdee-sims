// Arc length, sector area and annulus (hình vành khuyên) area. Lengths in cm, the arc in degrees.

export const R_MIN = 1;
export const R_MAX = 10;
export const R_STEP = 0.5;
/** Requested sector areas of the challenge, in units of π cm². Each one can be made with the sliders. */
export const TARGETS = [3, 4, 6, 5, 2, 15, 10, 8, 12, 9];

export const initialState = () => ({
  mode: "sector", // "sector" (cung và hình quạt) or "ring" (hình vành khuyên)
  R: 5, // cm, radius (outer radius of the ring)
  r: 2, // cm, inner radius of the ring
  angle: 60, // degrees, the arc AB and its central angle
  challenge: 0, // 0: no challenge; k ≥ 1: the k-th requested area
  solved: false, // the current challenge has been met
});

export const toRadians = n => (n * Math.PI) / 180;
/** l = πRn/180 */
export const arcLength = (R, n) => (Math.PI * R * n) / 180;
/** S = πR²n/360 */
export const sectorArea = (R, n) => (Math.PI * R * R * n) / 360;
/** S = π(R² − r²) */
export const ringArea = (R, r) => Math.PI * (R * R - r * r);

const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo)); // forged state stays in range

/** Requested area (cm²) of the running challenge, or null. */
export function target(s) {
  const k = Number.isFinite(s.challenge) ? Math.floor(s.challenge) : 0;
  return k >= 1 ? TARGETS[(k - 1) % TARGETS.length] * Math.PI : null;
}

/** Same area as far as the screen shows it (two decimals). */
export const sameArea = (x, y) => Math.round(x * 100) === Math.round(y * 100);

export function measure(s) {
  const R = num(s.R, R_MIN, R_MAX);
  const r = num(s.r, R_STEP, R - R_STEP); // the hole is always smaller than the disc
  const n = num(s.angle, 0, 360);
  const sector = sectorArea(R, n);
  const t = target(s);
  return {
    R, r, n,
    radians: toRadians(n),
    arc: arcLength(R, n),
    sector,
    circumference: 2 * Math.PI * R,
    disc: Math.PI * R * R,
    ring: ringArea(R, r),
    target: t,
    hit: t != null && sameArea(sector, t),
  };
}

/** Number of the next challenge whose area differs from the sector on screen. */
export function nextChallenge(s) {
  const now = measure(s).sector;
  let k = (Number.isFinite(s.challenge) ? Math.max(0, Math.floor(s.challenge)) : 0) + 1;
  while (sameArea(target({ challenge: k }), now)) k++;
  return k;
}

/**
 * Angle while dragging B round the circle. `raw` is the direction of the pointer in degrees.
 * Passing A does not jump between 0° and 360°: the arc stops at the end it came from.
 */
export function dragAngle(prev, raw) {
  const a = ((raw % 360) + 360) % 360;
  if (prev > 270 && a < 90) return 360;
  if (prev < 90 && a > 270) return 0;
  return Math.round(a);
}
