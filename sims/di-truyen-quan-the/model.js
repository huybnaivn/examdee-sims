// Population genetics of one gene with two alleles, A (frequency p) and a (q = 1 − p).
// The population is tracked as genotype frequencies of the newborns, [AA, Aa, aa], summing to 1.
// One generation, in this order (each step only when its force is switched on):
//   1. selection against aa: aa survives with relative fitness 1 − s, then renormalise
//   2. gene flow: a fraction m of the breeding adults are migrants, in Hardy–Weinberg
//      proportions of their own allele frequency p_m, so p becomes (1 − m)·p + m·p_m
//   3. mating: random mating gives p² AA + 2pq Aa + q² aa (Hardy–Weinberg);
//      otherwise self-fertilisation: AA + Aa/4, Aa/2, aa + Aa/4
//   4. genetic drift: the N newborns are a random sample (multinomial) of those proportions;
//      with drift off the population is taken as infinitely large (no sampling)
// With selection against aa and random mating this gives the textbook recurrence
// q' = q(1 − s·q)/(1 − s·q²); for s = 1, q_n = q₀/(1 + n·q₀).
//
// The run is a pure function of (settings, seed, generation): generation n always comes from the
// same draws of the generator, so a saved state replays exactly.

export const GEN_MAX = 200;
export const SIZES = [10, 20, 50, 100, 200, 500, 1000, 5000, 10000];
const SEED = 1908;

export const initialState = () => ({
  p0: 0.6, // initial frequency of A
  start: "homo", // "hw": p² AA + 2pq Aa + q² aa; "homo": p AA + q aa (no heterozygotes)
  randomMating: true, // false: self-fertilisation
  selection: false,
  sel: 0.5, // selection coefficient against aa
  migration: false,
  m: 0.05, // migrant fraction per generation
  pm: 0.1, // frequency of A among the migrants
  drift: true,
  N: 200, // individuals per generation when drift is on
  seed: SEED,
  generation: 40,
});

/** Seedable generator (mulberry32): returns a function giving numbers in [0, 1). */
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

const num = (v, lo, hi, fallback = lo) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
/** Settings with forged values made safe. */
export const settings = s => ({
  p0: num(s.p0, 0, 1, 0.5),
  start: s.start === "hw" ? "hw" : "homo",
  randomMating: s.randomMating !== false,
  sel: s.selection === true ? num(s.sel, 0, 1) : 0,
  m: s.migration === true ? num(s.m, 0, 1) : 0,
  pm: num(s.pm, 0, 1),
  N: s.drift === true ? Math.round(num(s.N, 2, 10000, 100)) : 0, // 0: infinite population
  seed: (Number.isFinite(s.seed) ? s.seed : SEED) >>> 0,
});
export const generationOf = s => Math.round(num(s.generation, 0, GEN_MAX));

export const alleleA = ([D, H]) => D + H / 2;
export const hardyWeinberg = p => [p * p, 2 * p * (1 - p), (1 - p) * (1 - p)];

export function startOf(c) {
  return c.start === "hw" ? hardyWeinberg(c.p0) : [c.p0, 0, 1 - c.p0];
}

/** Next generation's newborn genotype frequencies. `random` is needed only when c.N > 0. */
export function next(f, c, random) {
  let [D, H, R] = f;
  if (c.sel > 0) {
    R *= 1 - c.sel;
    const w = D + H + R;
    if (w > 0) [D, H, R] = [D / w, H / w, R / w];
  }
  if (c.m > 0) {
    const mig = hardyWeinberg(c.pm);
    [D, H, R] = [D, H, R].map((x, i) => (1 - c.m) * x + c.m * mig[i]);
  }
  const z = c.randomMating ? hardyWeinberg(alleleA([D, H, R])) : [D + H / 4, H / 2, R + H / 4];
  if (!c.N) return z;
  const n = [0, 0, 0];
  for (let i = 0; i < c.N; i++) {
    const u = random();
    n[u < z[0] ? 0 : u < z[0] + z[1] ? 1 : 2]++;
  }
  return n.map(k => k / c.N);
}

let cache = { key: "", hist: [], random: null };
/** Genotype frequencies of generations 0 to the current one: [[AA, Aa, aa], ...]. */
export function history(s) {
  const c = settings(s);
  const key = JSON.stringify(c);
  if (cache.key !== key) cache = { key, hist: [startOf(c)], random: rng(c.seed) };
  const g = generationOf(s);
  while (cache.hist.length <= g) cache.hist.push(next(cache.hist.at(-1), c, cache.random));
  return cache.hist.slice(0, g + 1);
}

/** Genotype frequencies now. */
export const current = s => history(s).at(-1);

/** 1 if A is fixed, −1 if A is lost, 0 otherwise. */
export const fixation = ([D, H, R]) => (H === 0 && R === 0 ? 1 : H === 0 && D === 0 ? -1 : 0);

/** Move to a new seed and back to generation 0, for another random sample. */
export function reseed(s) {
  s.seed = (Math.imul(s.seed >>> 0, 1664525) + 1013904223) >>> 0;
  s.generation = 0;
}
