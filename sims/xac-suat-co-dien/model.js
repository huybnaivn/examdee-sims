// Classical probability: P(A) = n(A) / n(Ω) by counting equally likely outcomes, compared with the
// relative frequency of A over many random trials (seeded generator kept in the state).

export const MAX_TRIALS = 100000;
export const MAX_CARDS = 10; // of each colour
const SEED = 2025;

const range = (n, f = i => i) => Array.from({ length: n }, (_, i) => f(i));

/**
 * Each experiment: the bins the results are counted in (what the chart shows), and the sample
 * space Ω listed outcome by outcome as the bin each one falls in. All outcomes of Ω are equally likely.
 */
export const EXPERIMENTS = {
  coin: { label: "Tung một đồng xu", bins: ["S", "N"], space: () => [0, 1] },
  die: { label: "Gieo một con xúc xắc", bins: range(6, i => String(i + 1)), space: () => range(6) },
  dice: {
    label: "Gieo hai con xúc xắc",
    bins: range(11, i => String(i + 2)), // sum of the two faces, 2 to 12
    space: () => range(36, i => Math.floor(i / 6) + (i % 6)), // pair (i, j) → bin of i + j + 2
  },
  cards: {
    label: "Rút một thẻ từ hộp",
    bins: ["Đỏ", "Xanh", "Vàng"],
    space: s => [...Array(s.red).fill(0), ...Array(s.blue).fill(1), ...Array(s.yellow).fill(2)],
  },
};

/** The events A on offer per experiment, as a test on the bin of an outcome. */
export const EVENTS = {
  coin: [
    { id: "heads", label: "Mặt ngửa (N) xuất hiện", test: k => k === 1 },
    { id: "tails", label: "Mặt sấp (S) xuất hiện", test: k => k === 0 },
  ],
  die: [
    { id: "even", label: "Số chấm là số chẵn", test: k => (k + 1) % 2 === 0 },
    { id: "prime", label: "Số chấm là số nguyên tố", test: k => [2, 3, 5].includes(k + 1) },
    { id: "div3", label: "Số chấm chia hết cho 3", test: k => (k + 1) % 3 === 0 },
    { id: "six", label: "Xuất hiện mặt 6 chấm", test: k => k + 1 === 6 },
    { id: "le6", label: "Số chấm không vượt quá 6", test: k => k + 1 <= 6 },
    { id: "gt6", label: "Số chấm lớn hơn 6", test: k => k + 1 > 6 },
  ],
  dice: [
    { id: "sum7", label: "Tổng số chấm bằng 7", test: k => k + 2 === 7 },
    { id: "not7", label: "Tổng số chấm khác 7", test: k => k + 2 !== 7 },
    { id: "sum2", label: "Tổng số chấm bằng 2", test: k => k + 2 === 2 },
    { id: "ge10", label: "Tổng số chấm lớn hơn hoặc bằng 10", test: k => k + 2 >= 10 },
    { id: "even", label: "Tổng số chấm là số chẵn", test: k => (k + 2) % 2 === 0 },
    { id: "sum13", label: "Tổng số chấm bằng 13", test: k => k + 2 === 13 },
  ],
  cards: [
    { id: "red", label: "Rút được thẻ màu đỏ", test: k => k === 0 },
    { id: "blue", label: "Rút được thẻ màu xanh", test: k => k === 1 },
    { id: "yellow", label: "Rút được thẻ màu vàng", test: k => k === 2 },
    { id: "notRed", label: "Thẻ rút được không phải màu đỏ", test: k => k !== 0 },
  ],
};

/** State key holding the chosen event of each experiment (one select per experiment). */
export const EVENT_KEY = { coin: "coinEvent", die: "dieEvent", dice: "diceEvent", cards: "cardEvent" };

export const event = s => EVENTS[s.experiment].find(e => e.id === s[EVENT_KEY[s.experiment]]) ?? EVENTS[s.experiment][0];

export function initialState() {
  const s = {
    experiment: "dice",
    coinEvent: "heads",
    dieEvent: "even",
    diceEvent: "sum7",
    cardEvent: "red",
    red: 3,
    blue: 2,
    yellow: 1,
    seed: SEED, // state of the random generator: the same seed replays the same trials
    counts: [], // counts[k] = trials whose result fell in bin k
    history: [], // [n, hits]: relative frequency of A after n trials, for the chart
    last1: -1, // bin (or first die face − 1) of the last trial, −1 if none
    last2: -1, // second die face − 1 of the last trial (two dice only)
  };
  clear(s);
  run(s, 100); // start with a sample on the chart
  return s;
}

/** Seedable generator (mulberry32). Advances s.seed and returns a number in [0, 1). */
export function random(s) {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** P(A) = n(A) / n(Ω), by listing Ω. */
export function theory(s) {
  const space = EXPERIMENTS[s.experiment].space(s);
  const { test } = event(s);
  const favourable = space.filter(test).length;
  return { favourable, total: space.length, p: space.length ? favourable / space.length : 0 };
}

/** One trial: the bin of the result. Each outcome of Ω is equally likely. */
export function trial(s) {
  if (s.experiment === "dice") {
    const i = Math.floor(random(s) * 6);
    const j = Math.floor(random(s) * 6);
    s.last1 = i;
    s.last2 = j;
    return i + j;
  }
  const space = EXPERIMENTS[s.experiment].space(s);
  const k = space[Math.floor(random(s) * space.length)];
  s.last1 = k;
  s.last2 = -1;
  return k;
}

export const totalTrials = s => s.counts.reduce((a, c) => a + c, 0);
export const hits = s => {
  const { test } = event(s);
  return s.counts.reduce((a, c, k) => a + (test(k) ? c : 0), 0);
};

/** Run n more trials (no more than MAX_TRIALS in all). Returns how many were run. */
export function run(s, n) {
  const { test } = event(s);
  let total = totalTrials(s);
  let h = hits(s);
  n = Math.max(0, Math.min(n, MAX_TRIALS - total));
  for (let i = 0; i < n; i++) {
    const k = trial(s);
    s.counts[k]++;
    total++;
    if (test(k)) h++;
    // every trial at first, then about 25 points per tenfold, and always the last one
    const prev = s.history.at(-1)?.[0] ?? 0;
    if (total <= 30 || total >= prev * 1.1 || i === n - 1) s.history.push([total, h]);
  }
  return n;
}

/** Forget every trial (new experiment, event or box). The seed keeps going. */
export function clear(s) {
  s.counts = Array(EXPERIMENTS[s.experiment].bins.length).fill(0);
  s.history = [];
  s.last1 = s.last2 = -1;
}

/** A box needs at least one card: put back a card of the colour just changed. */
export function fixMix(s, key) {
  if (s.red + s.blue + s.yellow === 0) s[key] = 1;
}

/** Keep only a well-formed saved state. */
export function sanitize(incoming, base) {
  const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
  const out = { ...base };
  if (Object.hasOwn(EXPERIMENTS, incoming.experiment)) out.experiment = incoming.experiment;
  for (const [exp, key] of Object.entries(EVENT_KEY)) if (EVENTS[exp].some(e => e.id === incoming[key])) out[key] = incoming[key];
  for (const key of ["red", "blue", "yellow"]) out[key] = int(incoming[key], 0, MAX_CARDS, base[key]);
  if (out.red + out.blue + out.yellow === 0) out.red = 1;
  out.seed = int(incoming.seed, 0, 0xffffffff, base.seed);
  const bins = EXPERIMENTS[out.experiment].bins.length;
  const counts = incoming.counts;
  const okCounts = Array.isArray(counts) && counts.length === bins && counts.every(c => Number.isInteger(c) && c >= 0) && counts.reduce((a, c) => a + c, 0) <= MAX_TRIALS;
  if (!okCounts) {
    clear(out);
    return out;
  }
  out.counts = [...counts];
  const n = totalTrials(out);
  const h = hits(out);
  const hist = incoming.history;
  const okHist =
    Array.isArray(hist) &&
    hist.length <= 1000 &&
    hist.every((p, i) => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[1] >= 0 && p[1] <= p[0] && p[0] > (i ? hist[i - 1][0] : 0)) &&
    (hist.length ? hist.at(-1)[0] === n && hist.at(-1)[1] === h : n === 0);
  out.history = okHist ? hist.map(p => [...p]) : n ? [[n, h]] : [];
  out.last1 = int(incoming.last1, -1, bins - 1, -1);
  out.last2 = out.experiment === "dice" ? int(incoming.last2, -1, 5, -1) : -1;
  if (out.experiment === "dice") out.last1 = int(incoming.last1, -1, 5, -1);
  return out;
}
