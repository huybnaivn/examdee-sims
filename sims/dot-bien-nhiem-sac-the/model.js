// Chromosome mutations.
//
// STRUCTURE. A chromosome is a string of gene letters with one "." for the centromere, e.g. "ABCDE.FGH".
// A segment is a run of neighbouring genes on chromosome 1 (NST 1), chosen by its first gene and its length.
//   deletion (mất đoạn)        ABCDE.FGH, BCD → AE.FGH           genes are lost
//   duplication (lặp đoạn)     ABCDE.FGH, BCD → ABCDBCDE.FGH     tandem repeat, genes are gained
//   inversion (đảo đoạn)       ABCDE.FGH, BCD → ADCBE.FGH        same genes, order reversed
//   translocation (chuyển đoạn) BCD moves to the end of NST 2: AE.FGH and MNOPQ.RBCD (non-homologous chromosomes)
// A segment that contains the centromere can only be inverted.
//
// NUMBER. A species with haploid number n. Aneuploidy: one pair has one chromosome fewer (2n − 1, thể một)
// or one more (2n + 1, thể ba). Polyploidy: every group has 3 (3n) or 4 (4n) chromosomes.

export const ORIGINAL = { chr1: "ABCDE.FGH", chr2: "MNOPQ.R" };
export const MAX_GENES = 12; // per chromosome, so the picture always fits

export const TYPE = { normal: 0, deletion: 1, duplication: 2, inversion: 3, translocation: 4, monosomy: 5, trisomy: 6, triploid: 7, tetraploid: 8 };

export const SPECIES = {
  human: { name: "Người", n: 23 },
  fly: { name: "Ruồi giấm", n: 4 },
  watermelon: { name: "Dưa hấu", n: 11 },
  datura: { name: "Cà độc dược", n: 12 },
};

export const NUM_TYPES = {
  "2n": { code: TYPE.normal, ploidy: 2, delta: 0, name: "Lưỡng bội bình thường" },
  "2n-1": { code: TYPE.monosomy, ploidy: 2, delta: -1, name: "Thể một" },
  "2n+1": { code: TYPE.trisomy, ploidy: 2, delta: 1, name: "Thể ba" },
  "3n": { code: TYPE.triploid, ploidy: 3, delta: 0, name: "Thể tam bội" },
  "4n": { code: TYPE.tetraploid, ploidy: 4, delta: 0, name: "Thể tứ bội" },
};

export const TARGETS = [
  { id: 1, label: "Hội chứng Down (thể ba NST 21)", species: "human", numType: "2n+1", pair: 21 },
  { id: 2, label: "Hội chứng Turner (chỉ có 1 NST giới tính X)", species: "human", numType: "2n-1", pair: 23 },
  { id: 3, label: "Dưa hấu tam bội không hạt", species: "watermelon", numType: "3n" },
  { id: 4, label: "Cà độc dược tứ bội", species: "datura", numType: "4n" },
];

export const initialState = () => ({
  view: "structure", // "structure" | "number"
  chr1: ORIGINAL.chr1,
  chr2: ORIGINAL.chr2,
  segStart: 2, // first gene of the chosen segment on NST 1, counted from 1
  segLen: 3, // genes in the segment
  lastType: 0, // TYPE code of the last structural mutation, 0 = none yet
  lastSeg: "", // genes of the segment it acted on
  species: "human",
  numType: "2n",
  pair: 21, // which pair is aneuploid (used by 2n − 1 and 2n + 1)
  target: 0, // id of the karyotype to reproduce, 0 = none
  solved: 0, // id of the target that has been reached, 0 while it is not
});

// ---------- structure ----------
const valid = text => typeof text === "string" && /^[A-Z]*\.[A-Z]*$/.test(text) && text.length >= 2 && text.length <= MAX_GENES + 1;

/** The two chromosomes of the state; anything that is not a well-formed chromosome falls back to the original. */
export const chromosomes = s => ({ chr1: valid(s.chr1) ? s.chr1 : ORIGINAL.chr1, chr2: valid(s.chr2) ? s.chr2 : ORIGINAL.chr2 });

export const genes = chr => chr.replace(".", "");

/** The chosen segment of NST 1, clamped to the genes that exist. start is 0-based. */
export function segment(s) {
  const { chr1 } = chromosomes(s);
  const at = [];
  [...chr1].forEach((ch, i) => ch !== "." && at.push(i));
  const start = Math.min(Math.max(Math.round(s.segStart) - 1 || 0, 0), at.length - 1);
  const len = Math.min(Math.max(Math.round(s.segLen) || 1, 1), at.length - start);
  const a = at[start];
  const b = at[start + len - 1] + 1;
  const text = chr1.slice(a, b);
  return { start, len, a, b, text, genes: genes(text), hasCentromere: text.includes(".") };
}

const cut = (chr, a, b) => chr.slice(0, a) + chr.slice(b);

export const deletion = (chr, a, b) => cut(chr, a, b);
export const duplication = (chr, a, b) => chr.slice(0, b) + chr.slice(a, b) + chr.slice(b);
export const inversion = (chr, a, b) => chr.slice(0, a) + [...chr.slice(a, b)].reverse().join("") + chr.slice(b);
/** Move chr1[a, b) to the end of chr2. Returns [chr1, chr2]. */
export const translocation = (chr1, chr2, a, b) => [cut(chr1, a, b), chr2 + chr1.slice(a, b)];

/** What the mutation would give: { chr1, chr2 }, or null when it is not possible for the chosen segment. */
export function mutated(s, type) {
  const { chr1, chr2 } = chromosomes(s);
  const seg = segment(s);
  const count = genes(chr1).length;
  if (type === TYPE.inversion) return seg.len > 1 ? { chr1: inversion(chr1, seg.a, seg.b), chr2 } : null;
  if (seg.hasCentromere) return null;
  if (type === TYPE.deletion) return seg.len < count ? { chr1: deletion(chr1, seg.a, seg.b), chr2 } : null;
  if (type === TYPE.duplication) return count + seg.len <= MAX_GENES ? { chr1: duplication(chr1, seg.a, seg.b), chr2 } : null;
  if (type === TYPE.translocation) {
    if (seg.len >= count || genes(chr2).length + seg.len > MAX_GENES) return null;
    const [c1, c2] = translocation(chr1, chr2, seg.a, seg.b);
    return { chr1: c1, chr2: c2 };
  }
  return null;
}

/** Apply a structural mutation to the chosen segment. Returns false (and changes nothing) if it is not possible. */
export function applyMutation(s, type) {
  const next = mutated(s, type);
  if (!next) return false;
  const seg = segment(s);
  Object.assign(s, next, { lastType: type, lastSeg: seg.genes });
  fitSegment(s);
  return true;
}

/** Keep the segment steppers inside the chromosome as it is now. */
export function fitSegment(s) {
  const seg = segment(s);
  s.segStart = seg.start + 1;
  s.segLen = seg.len;
  return s;
}

export function restore(s) {
  Object.assign(s, ORIGINAL, { lastType: 0, lastSeg: "" });
  return fitSegment(s);
}

// ---------- number ----------
const species = s => SPECIES[s.species] ?? SPECIES.human;
const numType = s => NUM_TYPES[s.numType] ?? NUM_TYPES["2n"];

export const haploid = s => species(s).n;
export const pairIndex = s => Math.min(Math.max(Math.round(s.pair) || 1, 1), haploid(s));

/** Number of chromosomes in each homologous group, pair 1 first. */
export function counts(s) {
  const t = numType(s);
  return Array.from({ length: haploid(s) }, (_, i) => t.ploidy + (i + 1 === pairIndex(s) ? t.delta : 0));
}

export const chromosomeCount = s => counts(s).reduce((sum, c) => sum + c, 0);
export const numCode = s => numType(s).code;
export const numName = s => numType(s).name;

/** "2n + 1 = 47" */
export function formula(s) {
  const key = NUM_TYPES[s.numType] ? s.numType : "2n";
  return `${key.replace("-", " − ").replace("+", " + ")} = ${chromosomeCount(s)}`;
}

export function matchesTarget(s) {
  const t = TARGETS.find(t => t.id === s.target);
  if (!t || t.species !== s.species || t.numType !== s.numType) return false;
  return t.pair == null || t.pair === pairIndex(s);
}
