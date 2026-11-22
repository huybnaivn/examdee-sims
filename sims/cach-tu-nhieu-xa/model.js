// Fraunhofer diffraction by a single slit and by a grating, light at normal incidence.
// Wavelengths, slit width and grating period in nanometres inside the model; angles in radians; screen in metres.

export const VIOLET = 380; // nm, short end of the visible spectrum
export const RED = 760; // nm, long end
export const SCREEN_DISTANCE = 1; // m, grating (or slit) to the flat screen
export const SCREEN_HALF = 0.5; // m, the screen reaches ±50 cm from the centre
export const TOLERANCE = 10; // nm, accepted error of a measured wavelength

export const initialState = () => ({
  task: "explore", // "explore" | "measure" (find the hidden wavelength)
  mode: "grating", // "grating" | "slit"
  source: "mono", // "mono" | "white"
  wavelength: 550, // nm
  lines: 250, // grating lines per mm
  slitWidth: 4, // μm
  cursor: 0, // cm, measuring cursor on the screen, positive upwards
  unknown: 635, // nm, hidden wavelength of the measuring task
  answer: 550, // nm, the learner's measured wavelength
  feedback: "", // "" | "correct" | "wrong"
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const measuring = s => s.task === "measure";
export const isWhite = s => s.source === "white" && !measuring(s);
/** Wavelength of the monochromatic source in use (nm); the hidden one while measuring. */
export const activeWavelength = s => (measuring(s) ? clamp(Number(s.unknown) || 0, VIOLET, RED) : s.wavelength);

/** Grating period d in nm from the number of lines per mm. */
export const gratingPeriod = linesPerMm => 1e6 / linesPerMm;

/** Width in nm of whatever diffracts: grating period d, or slit width a. */
export const aperture = s => (s.mode === "slit" ? s.slitWidth * 1000 : gratingPeriod(s.lines));

/** Angle of the principal maximum of order k, d·sinθ = k·λ; null when that order does not exist. */
export function orderAngle(k, wavelength, d) {
  const sin = (k * wavelength) / d;
  return Math.abs(sin) <= 1 + 1e-12 ? Math.asin(clamp(sin, -1, 1)) : null;
}

/** Highest order of principal maximum, ⌊d/λ⌋. */
export const maxOrder = (wavelength, d) => Math.floor(d / wavelength + 1e-9);

/** Angle of the m-th minimum of a single slit of width a, a·sinθ = m·λ (m ≠ 0); null when there is none. */
export const slitMinimumAngle = (m, wavelength, a) => (m === 0 ? null : orderAngle(m, wavelength, a));

/** Relative intensity of single-slit diffraction, (sin β / β)² with β = π·a·sinθ / λ. */
export function slitIntensity(sinTheta, wavelength, a) {
  const beta = (Math.PI * a * sinTheta) / wavelength;
  return Math.abs(beta) < 1e-9 ? 1 : (Math.sin(beta) / beta) ** 2;
}

/** Position on the flat screen (m from the centre) of light leaving at angle θ. */
export const screenPosition = (theta, distance = SCREEN_DISTANCE) => distance * Math.tan(theta);

/** Small-angle position of order k: x ≈ k·λ·L / d. */
export const smallAnglePosition = (k, wavelength, d, distance = SCREEN_DISTANCE) => (k * wavelength * distance) / d;

/** Width on the screen of the central maximum of a single slit (between the two first minima), m. */
export function centralWidth(wavelength, a, distance = SCREEN_DISTANCE) {
  const theta = slitMinimumAngle(1, wavelength, a);
  return theta == null ? Infinity : 2 * screenPosition(theta, distance);
}

/** Angle seen from the grating of a point x metres from the screen centre. */
export const angleOf = (x, distance = SCREEN_DISTANCE) => Math.atan2(x, distance);

/** Wavelength from a measured angle of order k: λ = d·sinθ / k. */
export const wavelengthFrom = (theta, d, k = 1) => (d * Math.sin(Math.abs(theta))) / k;

export const answerOk = s => Math.abs(s.answer - activeWavelength(s)) <= TOLERANCE;

/** A new hidden wavelength, 400–700 nm in steps of 5 nm; `rand` returns numbers in [0, 1). */
export function newSource(s, rand = Math.random) {
  s.unknown = 400 + 5 * Math.floor(rand() * 61);
  s.feedback = "";
  return s;
}
