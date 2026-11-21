// Descriptive statistics of a small sample on a number line (whole values from MIN to MAX).
//
// Conventions, as in the Vietnamese grade 10 textbooks:
// - Median Me: the middle value of the sorted sample, or the mean of the two middle values when n is even.
// - Quartiles: Q2 = Me. Q1 is the median of the lower half and Q3 the median of the upper half,
//   where the halves leave out the middle value when n is odd. A single point has no Q1 or Q3.
// - Mode Mo: the value(s) with the highest frequency. When every value occurs equally often
//   (and there are at least two different values) the sample is said to have no mode.
// - Variance and standard deviation divide by n (population form): s² = Σ(xᵢ − x̄)² / n.

export const MIN = 0;
export const MAX = 20;
export const CAP = 20; // at most this many points

export const PRESETS = {
  outlier: [4, 5, 5, 6, 6, 6, 7, 7, 20], // "plain" with its largest value pushed far out
  plain: [4, 5, 5, 6, 6, 6, 7, 7, 8],
  bimodal: [2, 3, 3, 3, 5, 8, 9, 9, 9, 10],
  nomode: [2, 4, 6, 8, 10, 12],
};

export const initialState = () => ({
  points: [...PRESETS.outlier],
  preset: "outlier", // "custom" once the learner edits the points
  newValue: 10, // value used by the add / remove buttons
  showBox: true,
});

/** Median of an already sorted list; null when it is empty. */
export function median(sorted) {
  const n = sorted.length;
  if (!n) return null;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/** All statistics of a list of values. Quantities that do not exist are null, never NaN. */
export function stats(values) {
  const sorted = [...values].sort((p, q) => p - q);
  const n = sorted.length;
  if (!n) {
    return { n, sorted, mean: null, median: null, modes: [], min: null, max: null, range: null, q1: null, q3: null, iqr: null, variance: null, sd: null };
  }
  const mean = sorted.reduce((p, q) => p + q, 0) / n;
  const q1 = median(sorted.slice(0, Math.floor(n / 2)));
  const q3 = median(sorted.slice(Math.ceil(n / 2)));
  const count = new Map();
  for (const v of sorted) count.set(v, (count.get(v) ?? 0) + 1);
  const top = Math.max(...count.values());
  const modes = [...count].filter(([, c]) => c === top).map(([v]) => v);
  const variance = sorted.reduce((p, q) => p + (q - mean) ** 2, 0) / n;
  return {
    n,
    sorted,
    mean,
    median: median(sorted),
    modes: count.size > 1 && modes.length === count.size ? [] : modes,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    q1,
    q3,
    iqr: q1 === null ? null : q3 - q1,
    variance,
    sd: Math.sqrt(variance),
  };
}

/** State from the host is untrusted: keep whole values in range, at most CAP of them, and scalars of the right type. */
export function sanitize(incoming, base) {
  const out = {};
  for (const key of Object.keys(base)) {
    const value = incoming[key];
    if (key === "points") {
      if (!Array.isArray(value)) continue;
      out.points = value
        .filter(v => typeof v === "number" && Number.isFinite(v))
        .slice(0, CAP)
        .map(v => Math.min(MAX, Math.max(MIN, Math.round(v))));
    } else if (typeof value === typeof base[key] && (typeof value !== "number" || Number.isFinite(value))) {
      out[key] = value;
    }
  }
  // a list that is not one of the presets must not be labelled as one
  if (out.points && String(PRESETS[out.preset ?? base.preset]) !== String(out.points)) out.preset = "custom";
  return out;
}
