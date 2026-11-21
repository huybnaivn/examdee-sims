// Interference of two coherent point sources on a water surface.
// S₁ = (−d/2, 0), S₂ = (+d/2, 0), lengths in cm. Both sources have amplitude A; S₂ leads S₁ by Δφ.
//   u₁ = A·cos(ωt − 2πd₁/λ), u₂ = A·cos(ωt + Δφ − 2πd₂/λ)
// Amplitude decay with distance is ignored, as in the school model.

export const FIELD = { w: 20, h: 12 }; // cm, the visible patch of water, centred on the midpoint of S₁S₂
export const TOLERANCE = 0.05; // in wavelengths: how close to a line counts as "on" it

export const initialState = () => ({
  separation: 6, // S₁S₂, cm
  wavelength: 2, // λ, cm
  phaseDeg: 0, // Δφ of S₂ relative to S₁, degrees
  probeX: -3, // cm
  probeY: 2.5, // cm
  showLines: true,
});

/** Distances from (x, y) to the two sources, cm. */
export const distances = (s, x = s.probeX, y = s.probeY) => ({
  d1: Math.hypot(x + s.separation / 2, y),
  d2: Math.hypot(x - s.separation / 2, y),
});

/** Path difference d₂ − d₁ in cm. */
export const pathDifference = (s, x = s.probeX, y = s.probeY) => {
  const { d1, d2 } = distances(s, x, y);
  return d2 - d1;
};

/** Resultant amplitude in units of A (0…2) for a path difference given in wavelengths. */
export const relativeAmplitude = (deltaInWavelengths, phaseDeg = 0) =>
  2 * Math.abs(Math.cos(Math.PI * deltaInWavelengths - (phaseDeg * Math.PI) / 360));

/** Instantaneous displacement in units of A at (x, y) when the phase of S₁ is `wt` (rad). */
export function displacement(s, x, y, wt) {
  const { d1, d2 } = distances(s, x, y);
  const k = (2 * Math.PI) / s.wavelength;
  return Math.cos(wt - k * d1) + Math.cos(wt + (s.phaseDeg * Math.PI) / 180 - k * d2);
}

/**
 * Maximum (kind 1), minimum (kind −1) or neither (kind 0) for a path difference in wavelengths.
 * Maxima: d₂ − d₁ = (k + Δφ/2π)λ. Minima: d₂ − d₁ = (k + ½ + Δφ/2π)λ.
 */
export function classify(deltaInWavelengths, phaseDeg = 0) {
  const c = deltaInWavelengths - phaseDeg / 360;
  if (Math.abs(c - Math.round(c)) <= TOLERANCE) return { kind: 1, k: Math.round(c) + 0 }; // + 0 turns −0 into 0
  if (Math.abs(c - 0.5 - Math.round(c - 0.5)) <= TOLERANCE) return { kind: -1, k: Math.round(c - 0.5) + 0 };
  return { kind: 0, k: 0 };
}

/** Everything the probe reads at its current position. */
export function probe(s) {
  const { d1, d2 } = distances(s);
  const delta = (d2 - d1) / s.wavelength;
  return { d1, d2, delta, amplitude: relativeAmplitude(delta, s.phaseDeg), ...classify(delta, s.phaseDeg) };
}

/**
 * Lines of maxima (offset 0) or minima (offset 0.5) that cross the segment S₁S₂ strictly between the sources.
 * Each is { k, c } with d₂ − d₁ = c·λ on the line.
 */
export function orders(s, offset = 0) {
  const shift = s.phaseDeg / 360 + offset;
  const n = s.separation / s.wavelength;
  const out = [];
  for (let k = Math.ceil(-n - shift) - 1; k <= n - shift + 1; k++) {
    if (Math.abs(k + shift) < n - 1e-9) out.push({ k, c: k + shift });
  }
  return out;
}

export const countMaxima = s => orders(s, 0).length;
export const countMinima = s => orders(s, 0.5).length;

/** An angle in degrees written as a fraction of π, e.g. 60 → "π/3", −90 → "−π/2". */
export function piFrac(deg) {
  const n = Math.round(deg / 15);
  if (Math.abs(deg - n * 15) > 1e-9) return `${(deg / 180).toFixed(2).replace(".", ",").replace("-", "−")}π`;
  if (n === 0) return "0";
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = gcd(Math.abs(n), 12);
  const num = Math.abs(n) / g;
  const den = 12 / g;
  return `${n < 0 ? "−" : ""}${num === 1 ? "" : num}π${den === 1 ? "" : "/" + den}`;
}
