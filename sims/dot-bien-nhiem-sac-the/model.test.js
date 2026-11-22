import test from "node:test";
import assert from "node:assert/strict";
import {
  ORIGINAL, MAX_GENES, TYPE, SPECIES, NUM_TYPES, TARGETS, initialState, chromosomes, genes, segment,
  deletion, duplication, inversion, translocation, mutated, applyMutation, fitSegment, restore,
  haploid, pairIndex, counts, chromosomeCount, numCode, formula, matchesTarget,
} from "./model.js";

const sorted = text => [...genes(text)].sort().join("");
const withSeg = (segStart, segLen, extra = {}) => ({ ...initialState(), segStart, segLen, ...extra });

test("gene order after each structural mutation of segment BCD", () => {
  // string-level operations on ABCDE.FGH, segment at [1, 4)
  assert.equal(deletion("ABCDE.FGH", 1, 4), "AE.FGH");
  assert.equal(duplication("ABCDE.FGH", 1, 4), "ABCDBCDE.FGH");
  assert.equal(inversion("ABCDE.FGH", 1, 4), "ADCBE.FGH");
  assert.deepEqual(translocation("ABCDE.FGH", "MNOPQ.R", 1, 4), ["AE.FGH", "MNOPQ.RBCD"]);
  // through the state, as the buttons do it
  const run = type => {
    const s = initialState(); // segment = genes 2…4 = BCD
    assert.equal(segment(s).genes, "BCD");
    assert.ok(applyMutation(s, type));
    assert.equal(s.lastType, type);
    assert.equal(s.lastSeg, "BCD");
    return [s.chr1, s.chr2];
  };
  assert.deepEqual(run(TYPE.deletion), ["AE.FGH", "MNOPQ.R"]);
  assert.deepEqual(run(TYPE.duplication), ["ABCDBCDE.FGH", "MNOPQ.R"]);
  assert.deepEqual(run(TYPE.inversion), ["ADCBE.FGH", "MNOPQ.R"]);
  assert.deepEqual(run(TYPE.translocation), ["AE.FGH", "MNOPQ.RBCD"]);
});

test("inversion keeps the gene content, deletion loses it, duplication adds, translocation moves", () => {
  const before = chromosomes(initialState());
  const inv = mutated(initialState(), TYPE.inversion);
  assert.equal(sorted(inv.chr1), sorted(before.chr1));
  assert.notEqual(inv.chr1, before.chr1);
  const del = mutated(initialState(), TYPE.deletion);
  assert.equal(genes(del.chr1).length, genes(before.chr1).length - 3);
  for (const g of "BCD") assert.ok(!del.chr1.includes(g));
  const dup = mutated(initialState(), TYPE.duplication);
  assert.equal(genes(dup.chr1).length, genes(before.chr1).length + 3);
  assert.equal(dup.chr1.split("B").length - 1, 2);
  const tr = mutated(initialState(), TYPE.translocation);
  assert.equal(sorted(tr.chr1 + tr.chr2), sorted(before.chr1 + before.chr2)); // nothing lost from the cell
  assert.equal(genes(tr.chr2).length, genes(before.chr2).length + 3);
  // inverting twice restores the chromosome
  const s = initialState();
  applyMutation(s, TYPE.inversion);
  applyMutation(s, TYPE.inversion);
  assert.equal(s.chr1, ORIGINAL.chr1);
});

test("a segment containing the centromere can only be inverted", () => {
  const s = withSeg(4, 4); // D E . F G
  const seg = segment(s);
  assert.equal(seg.text, "DE.FG");
  assert.ok(seg.hasCentromere);
  assert.equal(mutated(s, TYPE.deletion), null);
  assert.equal(mutated(s, TYPE.duplication), null);
  assert.equal(mutated(s, TYPE.translocation), null);
  assert.equal(mutated(s, TYPE.inversion).chr1, "ABCGF.EDH"); // pericentric inversion
  assert.ok(!applyMutation(s, TYPE.deletion));
  assert.equal(s.chr1, ORIGINAL.chr1); // a refused mutation changes nothing
  assert.equal(s.lastType, 0);
});

test("limits: one gene cannot be inverted, a chromosome cannot grow past the limit or lose every gene", () => {
  assert.equal(mutated(withSeg(1, 1), TYPE.inversion), null);
  const s = withSeg(1, 4);
  assert.ok(applyMutation(s, TYPE.duplication)); // 8 + 4 = 12 genes still fits
  assert.equal(s.chr1, "ABCDABCDE.FGH");
  assert.equal(genes(s.chr1).length, MAX_GENES);
  assert.ok(!applyMutation(s, TYPE.duplication)); // no room for more
  assert.equal(mutated(withSeg(1, 5), TYPE.duplication), null); // 8 + 5 = 13 would not fit
  const big = withSeg(1, 5, { chr1: "ABCDEABCDE.FG" });
  assert.equal(mutated(big, TYPE.duplication), null);
  const tiny = withSeg(1, 3, { chr1: "ABC." });
  assert.equal(mutated(tiny, TYPE.deletion), null);
  assert.equal(mutated(tiny, TYPE.translocation), null);
});

test("segment is clamped to the chromosome; forged chromosomes fall back to the original", () => {
  assert.equal(segment(withSeg(8, 6)).genes, "H");
  assert.equal(segment(withSeg(99, 99)).genes, "H");
  assert.equal(segment(withSeg(-5, 0)).genes, "A");
  assert.equal(segment(withSeg(NaN, NaN)).genes, "A");
  const s = fitSegment(withSeg(8, 6));
  assert.deepEqual([s.segStart, s.segLen], [8, 1]);
  for (const bad of ["", "ABC", "A.B.C", "<b>.x", "abc.d", "A".repeat(40) + ".B", 5]) {
    assert.deepEqual(chromosomes({ ...initialState(), chr1: bad, chr2: bad }), ORIGINAL);
  }
  const r = restore({ ...initialState(), chr1: "A.B", lastType: 3, lastSeg: "X", segStart: 2 });
  assert.equal(r.chr1, ORIGINAL.chr1);
  assert.equal(r.lastType, 0);
});

test("chromosome counts for each numerical type", () => {
  const human = { ...initialState(), species: "human", pair: 21 };
  assert.equal(chromosomeCount({ ...human, numType: "2n" }), 46);
  assert.equal(chromosomeCount({ ...human, numType: "2n-1" }), 45);
  assert.equal(chromosomeCount({ ...human, numType: "2n+1" }), 47); // Down: trisomy 21
  assert.equal(chromosomeCount({ ...human, numType: "3n" }), 69);
  assert.equal(chromosomeCount({ ...human, numType: "4n" }), 92);
  const down = counts({ ...human, numType: "2n+1" });
  assert.equal(down[20], 3);
  assert.equal(down.filter(c => c === 2).length, 22);
  const turner = counts({ ...human, numType: "2n-1", pair: 23 });
  assert.equal(turner[22], 1);
  assert.equal(formula({ ...human, numType: "2n+1" }), "2n + 1 = 47");
  assert.equal(formula({ ...human, numType: "2n-1" }), "2n − 1 = 45");
  assert.equal(formula({ ...human, numType: "3n" }), "3n = 69");
  assert.deepEqual(["2n", "2n-1", "2n+1", "3n", "4n"].map(numType => numCode({ ...human, numType })), [0, 5, 6, 7, 8]);
});

test("polyploids are whole multiples of n, aneuploids are not", () => {
  for (const [id, sp] of Object.entries(SPECIES)) {
    const s = { ...initialState(), species: id, pair: 1 };
    assert.equal(chromosomeCount({ ...s, numType: "2n" }), 2 * sp.n);
    assert.equal(chromosomeCount({ ...s, numType: "3n" }), 3 * sp.n);
    assert.equal(chromosomeCount({ ...s, numType: "4n" }), 4 * sp.n);
    assert.ok(counts({ ...s, numType: "3n" }).every(c => c === 3));
    assert.ok(counts({ ...s, numType: "4n" }).every(c => c === 4));
    assert.notEqual(chromosomeCount({ ...s, numType: "2n+1" }) % sp.n, 0);
    assert.notEqual(chromosomeCount({ ...s, numType: "2n-1" }) % sp.n, 0);
    assert.equal(counts(s).length, sp.n);
  }
  assert.equal(chromosomeCount({ ...initialState(), species: "watermelon", numType: "3n" }), 33);
  assert.equal(chromosomeCount({ ...initialState(), species: "datura", numType: "2n+1", pair: 3 }), 25);
  assert.equal(chromosomeCount({ ...initialState(), species: "fly", numType: "2n" }), 8);
});

test("pair and unknown values are clamped", () => {
  const fly = { ...initialState(), species: "fly", pair: 21, numType: "2n+1" };
  assert.equal(pairIndex(fly), 4);
  assert.equal(chromosomeCount(fly), 9);
  assert.equal(pairIndex({ ...fly, pair: -3 }), 1);
  assert.equal(haploid({ ...fly, species: "dragon" }), 23);
  assert.equal(chromosomeCount({ ...initialState(), numType: "9n" }), 46);
});

test("target karyotypes", () => {
  const s = { ...initialState(), target: 1, species: "human", numType: "2n+1", pair: 21 };
  assert.ok(matchesTarget(s));
  assert.equal(chromosomeCount(s), 47);
  assert.ok(!matchesTarget({ ...s, pair: 18 }));
  assert.ok(!matchesTarget({ ...s, numType: "2n-1" }));
  assert.ok(!matchesTarget({ ...s, target: 0 }));
  assert.ok(!matchesTarget(initialState()));
  assert.ok(matchesTarget({ ...s, target: 2, numType: "2n-1", pair: 23 }));
  assert.ok(matchesTarget({ ...s, target: 3, species: "watermelon", numType: "3n", pair: 5 })); // pair is irrelevant for polyploids
  assert.ok(matchesTarget({ ...s, target: 4, species: "datura", numType: "4n" }));
  for (const t of TARGETS) assert.ok(SPECIES[t.species] && NUM_TYPES[t.numType]);
});
