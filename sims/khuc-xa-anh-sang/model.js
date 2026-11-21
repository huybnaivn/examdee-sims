// Refraction at a flat boundary. Angles are in degrees, measured from the normal.

export const MEDIA = [
  { value: "air", label: "Không khí", n: 1 },
  { value: "water", label: "Nước", n: 1.33 },
  { value: "glass", label: "Thủy tinh", n: 1.5 },
  { value: "diamond", label: "Kim cương", n: 2.42 },
];

/** Preset whose index matches n, or "custom". */
export const mediumOf = n => MEDIA.find(m => Math.abs(m.n - n) < 1e-9)?.value ?? "custom";

export const initialState = () => ({
  angle: 45, // angle of incidence, degrees
  n1: 1, // refractive index of the medium the ray comes from
  n2: 1.33, // refractive index of the medium it enters
  medium1: "air",
  medium2: "water",
});

const rad = deg => (deg * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

/** Law of reflection. */
export const reflectionAngle = i => i;

/** Snell: n1·sin i = n2·sin r. Returns r in degrees, or null on total internal reflection. */
export function refractionAngle(n1, n2, i) {
  const sinR = (n1 * Math.sin(rad(i))) / n2;
  if (sinR > 1 + 1e-12) return null;
  return deg(Math.asin(Math.min(sinR, 1)));
}

/** Critical angle asin(n2/n1) in degrees; null when n1 <= n2 (no total internal reflection). */
export const criticalAngle = (n1, n2) => (n1 > n2 ? deg(Math.asin(n2 / n1)) : null);

/** Fraction of unpolarised light that is reflected (Fresnel). 1 on total internal reflection. */
export function reflectance(n1, n2, i) {
  const r = refractionAngle(n1, n2, i);
  if (r === null) return 1;
  const ci = Math.cos(rad(i));
  const ct = Math.cos(rad(r));
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  const rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
  return (rs * rs + rp * rp) / 2;
}
