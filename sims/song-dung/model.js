// A string of length L driven at x = 0 by a small vertical oscillation; the end x = L is
// fixed or free. Damped wave equation y_tt + b·y_t = v²·y_xx, v = √(T/μ), solved by finite
// differences. Displacements are in cm, everything else in SI units.
// The string is deliberately heavy and slack so the waves are slow enough to watch in real time.

export const L = 2; // m
export const MU = 0.2; // kg/m, linear mass density
// A fine grid keeps numerical dispersion from detuning the sharp high harmonics.
export const N = 400; // segments
const SUB = 10; // sub-steps per step, keeps v·dt/dx < 1 up to v = 5 m/s at dt = 1/120 s

export const waveSpeed = s => Math.sqrt(s.tension / MU);
export const wavelength = s => waveSpeed(s) / s.frequency;

/** n-th resonant frequency: n·v/(2L) with two fixed ends, (2n−1)·v/(4L) with one free end. */
export const resonantFrequency = (s, n) =>
  s.endType === "free" ? ((2 * n - 1) * waveSpeed(s)) / (4 * L) : (n * waveSpeed(s)) / (2 * L);

/** Index n >= 1 of the resonance closest to the driving frequency. */
export function nearestHarmonic(s) {
  const x = (2 * L * s.frequency) / waveSpeed(s);
  return Math.max(1, Math.round(s.endType === "free" ? (2 * x + 1) / 2 : x));
}

/** n when the driving frequency is on a resonance (within 3 % of the fundamental spacing), else 0. */
export function harmonicNumber(s) {
  const n = nearestHarmonic(s);
  return Math.abs(s.frequency - resonantFrequency(s, n)) <= (0.03 * waveSpeed(s)) / (2 * L) ? n : 0;
}

/** Node positions (m from the source) of the n-th standing wave. The source end counts as a node. */
export const nodePositions = (endType, n) =>
  endType === "free"
    ? Array.from({ length: n }, (_, j) => (2 * j * L) / (2 * n - 1))
    : Array.from({ length: n + 1 }, (_, j) => (j * L) / n);

export const antinodePositions = (endType, n) =>
  endType === "free"
    ? Array.from({ length: n }, (_, j) => ((2 * j + 1) * L) / (2 * n - 1))
    : Array.from({ length: n }, (_, j) => ((2 * j + 1) * L) / (2 * n));

/**
 * Steady-state amplitude (cm) at position x. With y = Re[Y(x)·e^{iωt}] the equation gives
 * Y'' + k²Y = 0, k² = (ω² − iωb)/v², so Y = A·sin(k(L−x))/sin(kL) for a fixed end and
 * A·cos(k(L−x))/cos(kL) for a free end. With k = p − iq: |sin|² = sin²(p·) + sinh²(q·).
 */
export function envelope(s, x) {
  const v = waveSpeed(s);
  const w = 2 * Math.PI * s.frequency;
  const re = (w * w) / (v * v);
  const mod = Math.hypot(re, (w * s.damping) / (v * v));
  const p = Math.sqrt((mod + re) / 2);
  const q = Math.sqrt((mod - re) / 2);
  const trig = s.endType === "free" ? Math.cos : Math.sin;
  const mag2 = u => trig(p * u) ** 2 + Math.sinh(q * u) ** 2;
  return s.amplitude * Math.sqrt(mag2(L - x) / mag2(L));
}

/** Flatten the string and restart the source, to watch the wave travel out. */
export function rest(s) {
  s._y = new Float64Array(N + 1);
  s._prev = new Float64Array(N + 1);
  s.phase = 0;
  return s;
}

/** Advance by dt seconds. Mutates and returns the state. */
export function step(s, dt) {
  if (!s._y) rest(s);
  const h = dt / SUB;
  const c2 = ((waveSpeed(s) * h * N) / L) ** 2;
  const g = (s.damping * h) / 2;
  const free = s.endType === "free";
  let y = s._y;
  let prev = s._prev;
  for (let k = 0; k < SUB; k++) {
    s.phase = (s.phase + 2 * Math.PI * s.frequency * h) % (2 * Math.PI);
    // the new shape is written over the oldest one
    for (let i = 1; i < N; i++) {
      prev[i] = (2 * y[i] - (1 - g) * prev[i] + c2 * (y[i + 1] - 2 * y[i] + y[i - 1])) / (1 + g);
    }
    prev[0] = s.amplitude * Math.sin(s.phase);
    prev[N] = free ? (2 * y[N] - (1 - g) * prev[N] + 2 * c2 * (y[N - 1] - y[N])) / (1 + g) : 0;
    [y, prev] = [prev, y];
  }
  s._y = y;
  s._prev = prev;
  return s;
}

const DEFAULTS = {
  endType: "fixed", // or "free"
  frequency: 1.5, // Hz
  amplitude: 2, // cm, of the source
  tension: 0.8, // N
  damping: 0.4, // 1/s
  showEnvelope: true,
};
export const LIMITS = { frequency: [0.1, 4], amplitude: [0.5, 5], tension: [0.2, 5], damping: [0.1, 2] };

/**
 * A valid state built from untrusted `params`, with the wave already built up for those
 * parameters, so a restored session opens on its own pattern rather than on a transient.
 */
export function settled(params = {}) {
  const s = { ...DEFAULTS };
  for (const [key, [lo, hi]] of Object.entries(LIMITS)) {
    if (Number.isFinite(params[key])) s[key] = Math.min(hi, Math.max(lo, params[key]));
  }
  if (params.endType === "free") s.endType = "free";
  if (typeof params.showEnvelope === "boolean") s.showEnvelope = params.showEnvelope;
  rest(s);
  // transients die out as e^(−bt/2)
  const seconds = Math.min(60, Math.max(10, 8 / s.damping));
  for (let i = 0; i < seconds * 120; i++) step(s, 1 / 120);
  s._harmonic = harmonicNumber(s); // the resonance the session opens on is not a new find
  return s;
}

/** Opens on the third harmonic of a string with two fixed ends. */
export const initialState = () => settled();
