// A stretched string and an air column as sound sources. SI units unless noted.
//
// String fixed at both ends:   f_k = (k / 2L) · √(T / μ),  μ = ρ · π · (d/2)²  (steel, ρ = 7850 kg/m³)
// Pipe open at both ends:      f_k = k · v / (2L)            k = 1, 2, 3, …
// Pipe closed at one end:      f_k = (2k − 1) · v / (4L)     only odd harmonics
// Speed of sound in air v = 340 m/s. End corrections of the pipe are ignored.
// Notes: twelve-tone equal temperament, A4 (La4) = 440 Hz, note index = MIDI number (A4 = 69).

export const SOUND_SPEED = 340; // m/s
export const STEEL_DENSITY = 7850; // kg/m³
export const TOLERANCE = 5; // cents, how close counts as "in tune"
export const TARGETS = [57, 60, 64, 67, 69, 72]; // La3, Đô4, Mi4, Sol4, La4, Đô5

export const initialState = () => ({
  instrument: "string", // "string" | "open" | "closed"
  length: 0.65, // m, vibrating length of the string
  tension: 100, // N
  diameter: 0.5, // mm
  pipeLength: 0.5, // m, length of the air column
  harmonic: 1, // which standing wave is drawn: the k-th possible one
  target: 57, // note index to tune to, 0 = none
  tunedNote: 0, // target for which the goal has been reported, 0 while out of tune
});

/** Mass per metre of a steel string of diameter d (mm), in kg/m. */
export const linearDensity = diameterMm => STEEL_DENSITY * Math.PI * (diameterMm / 2000) ** 2;

/** Speed of a transverse wave on the string, v = √(T/μ). */
export const stringWaveSpeed = (tension, mu) => Math.sqrt(tension / mu);

export const stringFrequency = (length, tension, mu, k = 1) => (k / (2 * length)) * stringWaveSpeed(tension, mu);

/** Harmonic number of the k-th possible standing wave: 1, 2, 3… or, for a closed pipe, 1, 3, 5… */
export const harmonicNumber = (instrument, k) => (instrument === "closed" ? 2 * k - 1 : k);

export const pipeFrequency = (length, closed, k = 1, v = SOUND_SPEED) =>
  closed ? ((2 * k - 1) * v) / (4 * length) : (k * v) / (2 * length);

/** Frequency of the k-th possible standing wave of the current instrument (k = 1 is the fundamental). */
export function frequency(s, k = 1) {
  if (s.instrument === "string") return stringFrequency(s.length, s.tension, linearDensity(s.diameter), k);
  return pipeFrequency(s.pipeLength, s.instrument === "closed", k);
}

/** Wavelength of the k-th standing wave on the string or in the air column (m). */
export function wavelength(s, k = 1) {
  const L = s.instrument === "string" ? s.length : s.pipeLength;
  return s.instrument === "closed" ? (4 * L) / (2 * k - 1) : (2 * L) / k;
}

/**
 * Displacement amplitude (−1…1) at x = 0…1 along the instrument.
 * String: nodes at both ends. Open pipe: antinodes at both ends. Closed pipe: node at the closed end x = 0.
 */
export function modeShape(instrument, k, x) {
  if (instrument === "string") return Math.sin(k * Math.PI * x);
  if (instrument === "open") return Math.cos(k * Math.PI * x);
  return Math.sin(((2 * k - 1) * Math.PI * x) / 2);
}

export const noteFrequency = index => 440 * 2 ** ((index - 69) / 12);

/** Signed distance from frequency f to the note, in cents (100 cents = one semitone). */
export const centsFrom = (f, index) => 1200 * Math.log2(f / noteFrequency(index));

/** Nearest equal-tempered note: { index, cents } with cents in (−50, 50]. */
export function nearestNote(f) {
  const index = Math.round(69 + 12 * Math.log2(f / 440));
  return { index, cents: centsFrom(f, index) };
}

const NAMES = ["Đô", "Đô♯", "Rê", "Rê♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
const LETTERS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** "La4 (A4)" for index 69. */
export function noteName(index) {
  const pc = ((index % 12) + 12) % 12;
  const octave = Math.floor(index / 12) - 1;
  return `${NAMES[pc]}${octave} (${LETTERS[pc]}${octave})`;
}

/** True when a target is set and the fundamental is within TOLERANCE cents of it. */
export const inTune = s => TARGETS.includes(s.target) && Math.abs(centsFrom(frequency(s), s.target)) <= TOLERANCE;
