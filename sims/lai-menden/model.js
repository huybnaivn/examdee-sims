// Mendelian crosses for one gene (A, a) or two independently assorting genes (A, a and B, b).
// A genotype is written gene by gene, dominant allele first: "Aa", "AaBb".
// Gene A may show incomplete dominance (the heterozygote Aa has an intermediate phenotype).
//
// Offspring are a pure function of (seed, parents, bred): offspring number i always comes from the
// same two draws of the generator, so a saved state replays exactly and breeding more only extends it.

export const MAX_OFFSPRING = 10000;
const SEED = 1865;

export const initialState = () => ({
  genes: 1, // 1 or 2 genes
  incomplete: false, // gene A: incomplete dominance
  motherA: "Aa",
  motherB: "Bb",
  fatherA: "Aa",
  fatherB: "Bb",
  batch: 100, // offspring per press of the button
  seed: SEED, // seed of the random generator
  bred: 100, // offspring bred so far with this seed
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

const PAIRS = [["AA", "Aa", "aa"], ["BB", "Bb", "bb"]];
const pair = (value, gene) => (PAIRS[gene].includes(value) ? value : PAIRS[gene][1]);

/** Genotype of "mother" or "father" for the number of genes in use. */
export const genotypeOf = (s, who) => pair(s[who + "A"], 0) + (s.genes === 2 ? pair(s[who + "B"], 1) : "");

/** Distinct gametes of a genotype; they are equally likely. "Aa" → ["A", "a"], "AaBB" → ["AB", "aB"]. */
export function gametes(genotype) {
  let out = [""];
  for (let i = 0; i < genotype.length; i += 2) {
    const alleles = [...new Set(genotype.slice(i, i + 2))];
    out = out.flatMap(g => alleles.map(a => g + a));
  }
  return out;
}

/** Zygote of two gametes, dominant allele written first: "aB" + "Ab" → "AaBb". */
export const fuse = (g1, g2) => [...g1].map((a, i) => (a <= g2[i] ? a + g2[i] : g2[i] + a)).join("");

/**
 * Phenotype key, one letter per gene: "d" dominant, "r" recessive,
 * "h" intermediate (heterozygote of gene A under incomplete dominance).
 */
export function phenotype(genotype, incomplete = false) {
  let key = "";
  for (let i = 0; i < genotype.length; i += 2) {
    const [x, y] = genotype.slice(i, i + 2);
    key += y === y.toUpperCase() ? "d" : x === x.toLowerCase() ? "r" : i === 0 && incomplete ? "h" : "d";
  }
  return key;
}

// Traits of the garden pea used on screen. Gene A: flower colour; gene B: stem height.
const TRAIT_A = { d: "tím", r: "trắng" };
const TRAIT_A_INCOMPLETE = { d: "đỏ", h: "hồng", r: "trắng" };
const TRAIT_B = { d: "cao", r: "thấp" };

/** Vietnamese name of a phenotype key: "hoa tím", "hoa hồng, thân thấp". */
export function phenotypeName(key, incomplete = false) {
  const flower = "hoa " + (incomplete ? TRAIT_A_INCOMPLETE : TRAIT_A)[key[0]];
  return key.length > 1 ? `${flower}, thân ${TRAIT_B[key[1]]}` : flower;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** Reduce counts to the smallest whole-number ratio: [4, 8, 4] → [1, 2, 1]. */
export const ratio = counts => counts.map(c => c / counts.reduce(gcd));

const ORDER = "dhr";
const byPhenotype = (a, b) => [...a.key].map((ch, i) => ORDER.indexOf(ch) - ORDER.indexOf(b.key[i])).find(d => d) ?? 0;

/**
 * The cross of the two parents: gametes, Punnett square and expected classes.
 * `genotypes` and `phenotypes` list each class with `count` cells of the square out of `total`.
 */
export function cross(s) {
  const mother = genotypeOf(s, "mother");
  const father = genotypeOf(s, "father");
  const gm = gametes(mother);
  const gf = gametes(father);
  const grid = gm.map(a => gf.map(b => fuse(a, b)));
  const genotypes = new Map();
  const phenotypes = new Map();
  for (const g of grid.flat()) {
    genotypes.set(g, (genotypes.get(g) ?? 0) + 1);
    const key = phenotype(g, s.incomplete);
    phenotypes.set(key, (phenotypes.get(key) ?? 0) + 1);
  }
  return {
    mother,
    father,
    motherGametes: gm,
    fatherGametes: gf,
    grid, // grid[row = mother's gamete][column = father's gamete]
    total: gm.length * gf.length,
    genotypes: [...genotypes].map(([genotype, count]) => ({ genotype, count })).sort((a, b) => (a.genotype < b.genotype ? -1 : 1)),
    phenotypes: [...phenotypes]
      .map(([key, count]) => ({ key, count, name: phenotypeName(key, s.incomplete) }))
      .sort(byPhenotype),
  };
}

/** The class that shows the dominant phenotype for every gene ("d" or "dd"). */
export const dominantKey = s => "d".repeat(s.genes === 2 ? 2 : 1);

/** Expected fraction of offspring with the dominant phenotype for every gene. */
export function expectedDominant(s) {
  const c = cross(s);
  return (c.phenotypes.find(p => p.key === dominantKey(s))?.count ?? 0) / c.total;
}

/** Number of offspring bred so far, safe against a forged state. */
export const bredOf = s => Math.min(MAX_OFFSPRING, Math.max(0, Math.floor(s.bred) || 0));

/** Genotype counts of offspring number `from` (inclusive) to `to` (exclusive): { Aa: 52, ... }. */
export function sample(s, from = 0, to = bredOf(s)) {
  const gm = gametes(genotypeOf(s, "mother"));
  const gf = gametes(genotypeOf(s, "father"));
  const random = rng(s.seed);
  const counts = {};
  for (let i = 0; i < to; i++) {
    const child = fuse(gm[Math.floor(random() * gm.length)], gf[Math.floor(random() * gf.length)]);
    if (i >= from) counts[child] = (counts[child] ?? 0) + 1;
  }
  return counts;
}

/** Phenotype counts of the same offspring: { d: 77, r: 23 }. */
export function observed(s, from = 0, to = bredOf(s)) {
  const counts = {};
  for (const [g, n] of Object.entries(sample(s, from, to))) {
    const key = phenotype(g, s.incomplete);
    counts[key] = (counts[key] ?? 0) + n;
  }
  return counts;
}

/** Breed `n` more offspring. Returns the batch: its size and its dominant-phenotype fraction. */
export function breed(s, n) {
  const from = bredOf(s);
  const to = Math.min(MAX_OFFSPRING, from + Math.max(0, Math.round(n) || 0));
  s.bred = to;
  const count = to - from;
  return {
    count,
    observed: count ? (observed(s, from, to)[dominantKey(s)] ?? 0) / count : 0,
    expected: expectedDominant(s),
  };
}

/** Discard the offspring and move to a new seed, so the next sample is a different one. */
export function clear(s) {
  s.bred = 0;
  s.seed = (Math.imul(s.seed >>> 0, 1664525) + 1013904223) >>> 0;
}
