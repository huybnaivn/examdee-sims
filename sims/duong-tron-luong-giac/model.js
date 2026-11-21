// Unit circle. The angle is kept in whole degrees, 0..360, so special angles are exact.

export const initialState = () => ({
  deg: 60, // angle α in degrees
  unit: "deg", // display unit: "deg" | "rad"
  showGraph: true, // plot y = sin x and y = cos x beside the circle
});

export const toRad = deg => (deg * Math.PI) / 180;
export const toDeg = rad => (rad * 180) / Math.PI;

/** Whole degrees in [0, 360]. */
export const normDeg = deg => (Number.isFinite(deg) ? Math.min(360, Math.max(0, Math.round(deg))) : 0);

const mod360 = deg => ((deg % 360) + 360) % 360;
const AXIS = [0, 1, 0, -1]; // sin at 0°, 90°, 180°, 270°

/** sin, cos, tan of an angle in degrees. Exact 0 and ±1 on the axes; tan is null where undefined. */
export function trig(deg) {
  const d = mod360(deg);
  const onAxis = d % 90 === 0;
  const sin = onAxis ? AXIS[d / 90] : Math.sin(toRad(d));
  const cos = onAxis ? AXIS[(d / 90 + 1) % 4] : Math.cos(toRad(d));
  return { sin, cos, tan: cos === 0 ? null : sin === 0 ? 0 : sin / cos };
}

/** Quadrant 1..4, or 0 when the point lies on an axis. */
export const quadrant = deg => {
  const d = mod360(deg);
  return d % 90 === 0 ? 0 : Math.floor(d / 90) + 1;
};

/** Signs (-1, 0, 1) of sin, cos, tan; tan is null where undefined. */
export const signs = deg => {
  const { sin, cos, tan } = trig(deg);
  return { sin: Math.sign(sin), cos: Math.sign(cos), tan: tan === null ? null : Math.sign(tan) };
};

/** Special angles: multiples of 30° and 45°. */
export const isSpecial = deg => {
  const d = mod360(deg);
  return d % 30 === 0 || d % 45 === 0;
};

// reference angle -> [sin, cos, tan]
const TABLE = {
  0: ["0", "1", "0"],
  30: ["1/2", "√3/2", "√3/3"],
  45: ["√2/2", "√2/2", "1"],
  60: ["√3/2", "1/2", "√3"],
  90: ["1", "0", null],
};

/** Exact values as text at a special angle (e.g. "−√3/2"), else null. tan is null where undefined. */
export function exact(deg) {
  if (!isSpecial(deg)) return null;
  const d = mod360(deg);
  const ref = d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
  const [sin, cos, tan] = TABLE[ref];
  const sign = signs(deg);
  const signed = (text, sg) => (text === null ? null : sg < 0 ? "−" + text : text);
  return { sin: signed(sin, sign.sin), cos: signed(cos, sign.cos), tan: signed(tan, sign.tan) };
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** A whole number of degrees as a multiple of π: 60 -> "π/3", 270 -> "3π/2", 0 -> "0". */
export function piFraction(deg) {
  if (deg === 0) return "0";
  const g = gcd(Math.abs(deg), 180);
  const p = deg / g;
  const q = 180 / g;
  return `${p === 1 ? "" : p === -1 ? "−" : p}π${q === 1 ? "" : "/" + q}`;
}

/** Whole degrees for a dragged angle, pulled to a special angle when within `tol` degrees. */
export function snap(deg, tol = 3) {
  const d = mod360(deg);
  const near = [Math.round(d / 30) * 30, Math.round(d / 45) * 45].sort((p, q) => Math.abs(p - d) - Math.abs(q - d))[0];
  return normDeg(Math.abs(near - d) <= tol ? near : d);
}
