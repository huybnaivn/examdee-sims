// Triangular prism in air, ray in the principal section. Angles in degrees.
// i1: angle of incidence on the first face, r1: refraction angle there,
// r2: angle of incidence on the second face (inside the glass), i2: angle of emergence.
//   sin i1 = n·sin r1,  r1 + r2 = A,  n·sin r2 = sin i2,  D = i1 + i2 − A

// Dispersion table: refractive index of borosilicate crown glass for seven representative
// wavelengths (from the usual three-term Sellmeier fit for this glass, rounded to 4 decimals).
export const SPECTRUM = [
  { value: "red", label: "Đỏ", nm: 656, n: 1.5143 },
  { value: "orange", label: "Cam", nm: 610, n: 1.5159 },
  { value: "yellow", label: "Vàng", nm: 589, n: 1.5167 },
  { value: "green", label: "Lục", nm: 546, n: 1.5187 },
  { value: "blue", label: "Lam", nm: 486, n: 1.5224 },
  { value: "indigo", label: "Chàm", nm: 450, n: 1.5253 },
  { value: "violet", label: "Tím", nm: 405, n: 1.5302 },
];

export const MIN_TOLERANCE = 1; // degrees: "at minimum deviation" when |i1 − i2| is within this

export const initialState = () => ({
  light: "white", // "white" (all seven colours) or "mono" (only `color`)
  color: "yellow", // the colour being measured (and the only one drawn when light = "mono")
  apex: 60, // refracting angle A, degrees
  incidence: 35, // i1, degrees
  exaggerate: true, // white light only: draw the angular spread between colours enlarged
});

const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

export const colorOf = value => SPECTRUM.find(c => c.value === value) ?? SPECTRUM[2];
export const indexOf = value => colorOf(value).n;

/** Critical angle glass → air, asin(1/n). */
export const criticalAngle = n => deg(Math.asin(1 / n));

/**
 * Trace one ray through both faces. r2 may be negative (ray meets the second face on the apex
 * side of its normal), then so is i2. When r2 exceeds the critical angle the ray is totally
 * reflected at the second face: emerges = false, i2 and deviation are null.
 */
export function trace(apex, i1, n) {
  const r1 = deg(Math.asin(Math.sin(rad(i1)) / n));
  const r2 = apex - r1;
  const sinI2 = n * Math.sin(rad(r2));
  const emerges = Math.abs(sinI2) <= 1;
  const i2 = emerges ? deg(Math.asin(sinI2)) : null;
  return { r1, r2, i2, emerges, deviation: emerges ? i1 + i2 - apex : null };
}

/**
 * Minimum deviation: symmetric passage, r1 = r2 = A/2, i1 = i2, sin((D_min + A)/2) = n·sin(A/2).
 * null when n·sin(A/2) > 1 (no ray can cross such a prism).
 */
export function minDeviation(apex, n) {
  const x = n * Math.sin(rad(apex / 2));
  if (x > 1) return null;
  const incidence = deg(Math.asin(x));
  return { incidence, deviation: 2 * incidence - apex };
}

/** The learner's goal: the ray emerges and i1 = i2 within the tolerance. */
export function atMinDeviation(apex, i1, n, tolerance = MIN_TOLERANCE) {
  const t = trace(apex, i1, n);
  return t.emerges && Math.abs(i1 - t.i2) <= tolerance;
}
