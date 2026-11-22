// X-linked recessive inheritance (one gene on the X chromosome, no allele on Y).
// A female genotype is two X alleles, dominant first: "AA", "Aa", "aa" (XᴬXᴬ, XᴬXᵃ, XᵃXᵃ).
// A male genotype is his single X allele: "A" or "a" (XᴬY, XᵃY).
// Allele a is recessive and causes the trait (red–green colour blindness or haemophilia A).
//
// Sampled offspring are a pure function of (seed, parents, born): child i always comes from the
// same draws, so a saved state replays exactly. Pedigrees are a pure function of pedSeed.

export const MAX_BORN = 5000;
export const FEMALES = ["AA", "Aa", "aa"];
export const MALES = ["A", "a"];

export const initialState = () => ({
  trait: "colour", // "colour" (mù màu đỏ – lục) or "haemo" (máu khó đông)
  mother: "Aa",
  father: "A",
  view: "cross", // "cross" (sơ đồ lai) or "pedigree" (phả hệ)
  batch: 100,
  seed: 1910,
  born: 200,
  pedSeed: 1,
  answer: "",
  attempts: 0,
  checked: false, // the current answer has been checked
  solved: false,
});

/** Seedable generator (mulberry32): numbers in [0, 1). */
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

const SUP = { A: "ᴬ", a: "ᵃ" };
/** "Aa" → "XᴬXᵃ", "a" → "XᵃY". */
export const write = g => (g.length === 2 ? `X${SUP[g[0]]}X${SUP[g[1]]}` : `X${SUP[g]}Y`);
export const gameteName = g => (g === "Y" ? "Y" : `X${SUP[g]}`);
export const isFemale = g => g.length === 2;
export const affected = g => (isFemale(g) ? g === "aa" : g === "a");
export const carrier = g => g === "Aa";

const female = g => (FEMALES.includes(g) ? g : "Aa");
const male = g => (MALES.includes(g) ? g : "A");
const zygote = (x1, x2) => (x1 <= x2 ? x1 + x2 : x2 + x1); // "A" < "a"

/** Child of a mother's X allele and a father's gamete ("A", "a" or "Y"). */
export const fuse = (fromMother, fromFather) => (fromFather === "Y" ? fromMother : zygote(fromMother, fromFather));

/** Gametes, punnett grid and the expected fractions within each sex. */
export function cross(motherIn, fatherIn) {
  const mother = female(motherIn);
  const father = male(fatherIn);
  const motherGametes = [...new Set(mother)];
  const fatherGametes = [father, "Y"];
  const grid = motherGametes.map(m => fatherGametes.map(f => fuse(m, f)));
  const daughters = { AA: 0, Aa: 0, aa: 0 };
  const sons = { A: 0, a: 0 };
  for (const m of motherGametes) {
    daughters[zygote(m, father)] += 1 / motherGametes.length;
    sons[m] += 1 / motherGametes.length;
  }
  return {
    mother,
    father,
    motherGametes,
    fatherGametes,
    grid, // grid[mother's gamete][father's gamete]; each cell has probability 1 / cells
    daughters, // fractions among daughters
    sons, // fractions among sons
    daughtersAffected: daughters.aa,
    daughtersCarrier: daughters.Aa,
    sonsAffected: sons.a,
    childrenAffected: (daughters.aa + sons.a) / 2, // sons and daughters equally likely
  };
}

/** Number of sampled children, safe against a forged state. */
export const bornOf = s => Math.min(MAX_BORN, Math.max(0, Math.floor(s.born) || 0));

/** Genotype counts of sampled children `from`..`to`−1: { AA, Aa, aa, A, a }. */
export function sample(s, from = 0, to = bornOf(s)) {
  const mother = female(s.mother);
  const father = male(s.father);
  const random = rng(s.seed);
  const counts = { AA: 0, Aa: 0, aa: 0, A: 0, a: 0 };
  for (let i = 0; i < to; i++) {
    const son = random() < 0.5;
    const m = mother[Math.floor(random() * 2)];
    if (i >= from) counts[fuse(m, son ? "Y" : father)]++;
  }
  return counts;
}

/** Sample `n` more children; returns the batch size. */
export function breed(s, n) {
  const from = bornOf(s);
  s.born = Math.min(MAX_BORN, from + Math.max(0, Math.round(n) || 0));
  return s.born - from;
}

/** Discard the sample and move to a new seed. */
export function clear(s) {
  s.born = 0;
  s.seed = (Math.imul(s.seed >>> 0, 1664525) + 1013904223) >>> 0;
}

// ---------- pedigree ----------
// Fixed shape: I-1 ♂ × I-2 ♀ have II-2 ♀ and II-3 ♂; II-2 marries II-1 ♂ (from outside the family);
// they have 3 or 4 children in generation III. Founders: I-1, I-2, II-1.

const pick = (r, list, weights) => {
  let x = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((x -= weights[i]) < 0) return list[i];
  return list.at(-1);
};

function family(r) {
  const p = [
    { id: "I-1", gen: 1, sex: "m" },
    { id: "I-2", gen: 1, sex: "f" },
    { id: "II-1", gen: 2, sex: "m" },
    { id: "II-2", gen: 2, sex: "f", father: 0, mother: 1 },
    { id: "II-3", gen: 2, sex: "m", father: 0, mother: 1 },
  ];
  const kids = 3 + (r() < 0.5 ? 1 : 0);
  for (let i = 0; i < kids; i++) p.push({ id: `III-${i + 1}`, gen: 3, sex: r() < 0.5 ? "m" : "f", father: 2, mother: 3 });
  p[0].genotype = pick(r, MALES, [1, 1]);
  p[1].genotype = pick(r, FEMALES, [3, 6, 1]); // carriers made common so the trait shows up
  p[2].genotype = pick(r, MALES, [2, 1]);
  for (const x of p.slice(3)) {
    const m = p[x.mother].genotype[Math.floor(r() * 2)];
    x.genotype = fuse(m, x.sex === "m" ? "Y" : p[x.father].genotype);
  }
  for (const x of p) x.affected = affected(x.genotype);
  return p;
}

/**
 * For each person, the genotypes consistent with every phenotype in the pedigree and with
 * X-linked transmission (a daughter gets her father's X, a son gets his X from his mother).
 */
export function possible(persons) {
  const options = persons.map(x =>
    x.sex === "m" ? [x.affected ? "a" : "A"] : x.affected ? ["aa"] : ["AA", "Aa"]
  );
  const sets = persons.map(() => new Set());
  const g = [];
  const fits = i => {
    const x = persons[i];
    if (x.father == null) return true;
    const mum = g[x.mother];
    return x.sex === "m" ? mum.includes(g[i]) : [...mum].some(m => zygote(m, g[x.father]) === g[i]);
  };
  const walk = i => {
    if (i === persons.length) return g.forEach((v, j) => sets[j].add(v));
    for (const v of options[i]) {
      g[i] = v;
      if (fits(i)) walk(i + 1);
    }
  };
  walk(0); // parents always come before their children in the list
  return sets.map(set => [...set]);
}

/**
 * The pedigree for a seed, with one woman whose genotype follows with certainty from the
 * phenotypes (`target`). Heterozygous women are preferred: they are the interesting deduction.
 */
export function pedigree(seed) {
  const base = Math.max(0, Math.floor(seed) || 0);
  let fallback = null;
  for (let k = 0; k < 200; k++) {
    const persons = family(rng(base * 7919 + k));
    const sets = possible(persons);
    const sure = persons.map((x, i) => i).filter(i => persons[i].sex === "f" && sets[i].length === 1);
    const target = sure.find(i => sets[i][0] === "Aa");
    if (target != null) return { persons, sets, target };
    if (!fallback && sure.length && persons.some(x => x.affected)) fallback = { persons, sets, target: sure[0] };
  }
  return fallback; // never reached in practice; see the test over many seeds
}

/** Check the learner's answer against the hidden genotype. */
export function check(s) {
  const p = pedigree(s.pedSeed);
  s.attempts = Math.min(999, (s.attempts || 0) + 1);
  s.checked = true;
  s.solved = s.answer === p.persons[p.target].genotype;
  return s.solved;
}
