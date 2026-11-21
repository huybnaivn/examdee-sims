// Radioactive decay of a sample of N0 nuclei.
// Every nucleus gets its lifetime from a seeded generator, so { seed, n0, time } fixes the whole
// picture: a saved state replays identically and the state stays flat.
//
// Time scaling: real half-lives run from days to billions of years, so for a real isotope one
// half-life always takes WATCH seconds on screen. `time` is kept in the isotope's own unit
// (days, years, ...); only the playback rate is rescaled, never the law N = N0·2^(−t/T).
// With the custom half-life, time is in real seconds (1 s on screen = 1 s).

export const WATCH = 4; // s on screen for one half-life of a real isotope
export const SPAN = 6; // the run stops after this many half-lives

export const ISOTOPES = {
  "I-131": { label: "¹³¹I (iodine-131)", symbol: "¹³¹I", T: 8.02, unit: "ngày" },
  "Rn-222": { label: "²²²Rn (radon-222)", symbol: "²²²Rn", T: 3.82, unit: "ngày" },
  "Po-210": { label: "²¹⁰Po (polonium-210)", symbol: "²¹⁰Po", T: 138, unit: "ngày" },
  "Co-60": { label: "⁶⁰Co (cobalt-60)", symbol: "⁶⁰Co", T: 5.27, unit: "năm" },
  "C-14": { label: "¹⁴C (carbon-14)", symbol: "¹⁴C", T: 5730, unit: "năm" },
  "U-238": { label: "²³⁸U (uranium-238)", symbol: "²³⁸U", T: 4.47, unit: "tỉ năm" },
};

export const initialState = () => {
  const s = {
    isotope: "I-131", // a key of ISOTOPES, or "custom"
    customT: 3, // s, used when isotope = "custom"
    n0: 400,
    seed: 2029, // seed of the random generator for this sample
    time: 0, // elapsed time, in the isotope's unit
    showTheory: true,
  };
  s.time = 1.6 * halfLife(s); // start with a partly decayed sample: an informative first picture
  return s;
};

const isotope = s => ISOTOPES[s.isotope];
/** Half-life T, in unit(s). */
export const halfLife = s => isotope(s)?.T ?? Math.min(10, Math.max(1, Number(s.customT) || 1));
export const unit = s => isotope(s)?.unit ?? "s";
/** Units of `time` that pass per second on screen. */
export const rate = s => (isotope(s) ? halfLife(s) / WATCH : 1);
/** Elapsed time, safe against a forged state. */
export const elapsed = s => Math.min(SPAN * halfLife(s), Math.max(0, Number(s.time) || 0));
export const finished = s => elapsed(s) >= SPAN * halfLife(s);

/** Decay constant λ = ln2 / T. */
export const decayConstant = T => Math.LN2 / T;
/** Law of radioactive decay, N = N0·2^(−t/T) = N0·e^(−λt). */
export const expected = (n0, t, T) => n0 * 2 ** (-t / T);
/** Activity H = λN (decays per unit of time). */
export const activity = (n, T) => decayConstant(T) * n;

/** Seedable generator (mulberry32): returns a function giving numbers in [0, 1). */
export function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lifetime of each nucleus in half-lives: exponentially distributed, P(alive after x) = 2^(−x). */
export function lifetimes(seed, n0) {
  const random = generator(seed);
  return Float64Array.from({ length: n0 }, () => -Math.log2(1 - random()));
}

/** The sample for this state (cached on the transient key _sample). */
export function sample(s) {
  const key = `${s.seed >>> 0}:${s.n0}`;
  if (s._sample?.key !== key) {
    const life = lifetimes(s.seed, s.n0);
    s._sample = { key, life, sorted: Float64Array.from(life).sort() };
  }
  return s._sample;
}

/** Nuclei not yet decayed at time t (default: now). */
export function remaining(s, t = elapsed(s)) {
  const { sorted } = sample(s);
  const x = t / halfLife(s);
  let lo = 0;
  let hi = sorted.length; // first index whose lifetime is > x
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] > x) hi = mid;
    else lo = mid + 1;
  }
  return sorted.length - lo;
}

/** Whole half-lives passed so far. */
export const halfLivesPassed = s => Math.floor(elapsed(s) / halfLife(s) + 1e-9);

/** Fresh sample at t = 0 (after a setting changes, or on request). */
export function restart(s) {
  s.seed = ((s.seed >>> 0) + 1) >>> 0;
  s.time = 0;
  return s;
}

/** Advance by dt seconds of screen time. A finished run starts again with a new sample. */
export function step(s, dt) {
  if (finished(s)) restart(s);
  s.time = Math.min(SPAN * halfLife(s), elapsed(s) + dt * rate(s));
  return s;
}
