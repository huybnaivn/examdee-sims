// Young's double-slit experiment. Units as in the textbook exercises:
//   λ in nm (shown as µm), a in mm, D in m, x and i in mm.
//   i = λD/a (λ in µm, D in m, a in mm gives i in mm)
//   bright fringe: x = k·i, dark fringe: x = (k + ½)·i
//   intensity (two thin slits, single-slit envelope ignored): I/I₀ = cos²(π·a·x/(λD))

export const TOLERANCE = 0.1; // marker within 0,1·i of a fringe centre counts as on that fringe

export const initialState = () => ({
  wavelength: 600, // λ (nm)
  slits: 1, // a, distance between the two slits (mm)
  distance: 2, // D, slits to screen (m)
  field: 10, // L, width of the observed field on the screen, centred on the central fringe (mm)
  marker: 2.4, // x of the marker on the screen (mm), from the central bright fringe
});

/** Fringe spacing i = λD/a (mm). */
export const spacing = s => (s.wavelength / 1000) * s.distance / s.slits;

/** Relative intensity I/I₀ = cos²(π·a·x/(λD)) at x (mm), between 0 and 1. */
export const intensity = (s, x) => Math.cos((Math.PI * x) / spacing(s)) ** 2;

/** x of the bright fringe of order k and of the dark fringe between k and k + 1 (mm). */
export const brightAt = (s, k) => k * spacing(s);
export const darkAt = (s, k) => (k + 0.5) * spacing(s);

/** Marker clamped to the observed field. */
export const markerX = s => Math.max(-s.field / 2, Math.min(s.field / 2, s.marker));

/**
 * What the marker reads at x: kind 1 bright (order k = round(x/i), "vân sáng bậc |k|"),
 * −1 dark (order ±n, "vân tối thứ n", n ≥ 1 counted from the centre, x = ±(n − ½)·i), 0 between fringes.
 */
export function readAt(s, x) {
  const i = spacing(s);
  const ratio = x / i;
  const k = Math.round(ratio);
  if (Math.abs(ratio - k) <= TOLERANCE) return { ratio, kind: 1, order: k || 0 };
  const half = Math.floor(ratio) + 0.5; // nearest half-integer below the next bright fringe
  if (Math.abs(ratio - half) <= TOLERANCE) {
    const n = Math.floor(Math.abs(half)) + 1;
    return { ratio, kind: -1, order: Math.sign(half) * n };
  }
  return { ratio, kind: 0, order: 0 };
}

/** Number of bright and dark fringes inside a field of width L (mm) centred on the central fringe. */
export function count(s, L = s.field) {
  const h = L / (2 * spacing(s)) + 1e-9; // tolerance: a fringe exactly at the edge is counted
  return { bright: 2 * Math.floor(h) + 1, dark: 2 * Math.floor(h + 0.5) };
}
