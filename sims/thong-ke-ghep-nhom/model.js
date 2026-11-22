// Grouped data (mẫu số liệu ghép nhóm), grade 11.
//
// Raw data: heights (cm, whole numbers) of N students, drawn from a seeded generator so the same seed
// always gives the same sample. They are grouped into k classes [a₁; a₂), [a₂; a₃), …, [a_k; a_{k+1})
// of equal width h, starting at the multiple of h just below the smallest value.
//
// Textbook formulas (m_i frequency of class i, c_i its midpoint, n = Σ m_i):
//   mean    x̄ = (m₁c₁ + … + m_k c_k) / n
//   median  Me = a_p + (n/2 − (m₁ + … + m_{p−1})) / m_p · h, p the first class whose cumulative
//           frequency reaches n/2; Q₁ and Q₃ alike with n/4 and 3n/4 (Q₂ = Me)
//   mode    Mo = a_j + (m_j − m_{j−1}) / ((m_j − m_{j−1}) + (m_j − m_{j+1})) · h, j the modal class,
//           with m₀ = m_{k+1} = 0
// Exact values of the raw sample: Q₁, Q₃ are the medians of the lower and upper halves
// (the middle value left out when n is odd), as in grade 10.

export const N = 40;
export const MIN_H = 140;
export const MAX_H = 185;

export const initialState = () => ({
  seed: 7, // which sample (1 to 999)
  width: 5, // class width h (cm)
  pick: 0, // class the learner says is modal, 1-based; 0 = none yet
});

export const cleanSeed = seed => (Math.trunc(Math.abs(Number(seed) || 0)) % 1000) || 1;

/** Small deterministic generator (mulberry32), uniform in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** N heights (cm), roughly normal around 160 cm with standard deviation 7 cm. */
export function sample(seed, n = N) {
  const next = rng(cleanSeed(seed) * 7919);
  const out = [];
  while (out.length < n) {
    const u = 1 - next();
    const v = next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    out.push(Math.min(MAX_H, Math.max(MIN_H, Math.round(160 + 7 * z))));
  }
  return out;
}

/** Group the values into classes of width h: { start, width, k, bounds, counts, mids }. */
export function group(values, width) {
  const h = Math.max(1, Math.round(width));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const start = Math.floor(min / h) * h;
  const k = Math.floor((max - start) / h) + 1; // max lies in [a_k; a_k + h)
  const counts = new Array(k).fill(0);
  for (const v of values) counts[Math.floor((v - start) / h)]++;
  return classesOf(start, h, counts);
}

export function classesOf(start, width, counts) {
  const k = counts.length;
  const bounds = Array.from({ length: k + 1 }, (_, i) => start + i * width);
  const mids = counts.map((_, i) => start + (i + 0.5) * width);
  return { start, width, k, bounds, counts, mids };
}

/** a_p + (target − cumulative before p) / m_p · h, p the first class whose cumulative frequency reaches target. */
export function groupedQuantile(cls, frac) {
  const n = cls.counts.reduce((p, q) => p + q, 0);
  const target = frac * n;
  let before = 0;
  for (let i = 0; i < cls.k; i++) {
    const m = cls.counts[i];
    if (m > 0 && before + m >= target) return { value: cls.bounds[i] + ((target - before) / m) * cls.width, index: i };
    before += m;
  }
  return { value: cls.bounds[cls.k], index: cls.k - 1 };
}

/** Indices (0-based) of the classes with the largest frequency. */
export const modalClasses = cls => {
  const top = Math.max(...cls.counts);
  return cls.counts.flatMap((m, i) => (m === top ? [i] : []));
};

/** Mode estimate in class j (0-based); the first modal class by default. */
export function groupedMode(cls, j = modalClasses(cls)[0]) {
  const m = cls.counts[j];
  const prev = cls.counts[j - 1] ?? 0;
  const next = cls.counts[j + 1] ?? 0;
  const d = m - prev + (m - next);
  return cls.bounds[j] + (d > 0 ? ((m - prev) / d) * cls.width : cls.width / 2);
}

export function groupedStats(cls) {
  const n = cls.counts.reduce((p, q) => p + q, 0);
  const mean = cls.counts.reduce((s, m, i) => s + m * cls.mids[i], 0) / n;
  const me = groupedQuantile(cls, 1 / 2);
  return {
    n,
    mean,
    median: me.value,
    medianClass: me.index,
    q1: groupedQuantile(cls, 1 / 4).value,
    q3: groupedQuantile(cls, 3 / 4).value,
    modal: modalClasses(cls),
    mode: groupedMode(cls),
  };
}

const medianOf = sorted => {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};

/** Exact statistics of the raw values. */
export function rawStats(values) {
  const sorted = [...values].sort((p, q) => p - q);
  const n = sorted.length;
  const count = new Map();
  for (const v of sorted) count.set(v, (count.get(v) ?? 0) + 1);
  const top = Math.max(...count.values());
  return {
    n,
    sorted,
    mean: sorted.reduce((p, q) => p + q, 0) / n,
    median: medianOf(sorted),
    q1: medianOf(sorted.slice(0, Math.floor(n / 2))),
    q3: medianOf(sorted.slice(Math.ceil(n / 2))),
    modes: [...count].filter(([, c]) => c === top).map(([v]) => v),
    count,
  };
}

/** Everything the view needs for a state. */
export function analyse(s) {
  const values = sample(s.seed);
  const cls = group(values, s.width);
  return { values, cls, grouped: groupedStats(cls), raw: rawStats(values) };
}
