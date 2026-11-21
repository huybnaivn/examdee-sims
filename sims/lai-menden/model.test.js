import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, gametes, fuse, phenotype, phenotypeName, ratio, cross, expectedDominant,
  sample, observed, breed, clear, bredOf, MAX_OFFSPRING,
} from "./model.js";

const make = (mother, father, extra = {}) => ({
  ...initialState(),
  genes: mother.length / 2,
  motherA: mother.slice(0, 2),
  fatherA: father.slice(0, 2),
  motherB: mother.slice(2) || "Bb",
  fatherB: father.slice(2) || "Bb",
  bred: 0,
  ...extra,
});
const genotypeRatio = s => Object.fromEntries(cross(s).genotypes.map((g, i, all) => [g.genotype, ratio(all.map(x => x.count))[i]]));
const phenotypeRatio = s => Object.fromEntries(cross(s).phenotypes.map((p, i, all) => [p.key, ratio(all.map(x => x.count))[i]]));

test("gametes of each genotype", () => {
  assert.deepEqual(gametes("AA"), ["A"]);
  assert.deepEqual(gametes("Aa"), ["A", "a"]);
  assert.deepEqual(gametes("aa"), ["a"]);
  assert.deepEqual(gametes("AaBb"), ["AB", "Ab", "aB", "ab"]);
  assert.deepEqual(gametes("AABb"), ["AB", "Ab"]);
  assert.deepEqual(gametes("aaBb"), ["aB", "ab"]);
  assert.deepEqual(gametes("AaBB"), ["AB", "aB"]);
  assert.deepEqual(gametes("Aabb"), ["Ab", "ab"]);
  assert.deepEqual(gametes("AAbb"), ["Ab"]);
  assert.deepEqual(gametes("aabb"), ["ab"]);
});

test("zygotes are written with the dominant allele first", () => {
  assert.equal(fuse("a", "A"), "Aa");
  assert.equal(fuse("aB", "Ab"), "AaBb");
  assert.equal(fuse("ab", "ab"), "aabb");
});

test("phenotypes: complete and incomplete dominance", () => {
  assert.deepEqual(["AA", "Aa", "aa"].map(g => phenotype(g)), ["d", "d", "r"]);
  assert.deepEqual(["AA", "Aa", "aa"].map(g => phenotype(g, true)), ["d", "h", "r"]);
  // incomplete dominance applies to gene A only
  assert.equal(phenotype("AaBb", true), "hd");
  assert.equal(phenotype("aabb", true), "rr");
  assert.equal(phenotypeName("d"), "hoa tím");
  assert.equal(phenotypeName("hr", true), "hoa hồng, thân thấp");
});

test("monohybrid Aa × Aa: 1 AA : 2 Aa : 1 aa and 3 dominant : 1 recessive", () => {
  const s = make("Aa", "Aa");
  assert.deepEqual(genotypeRatio(s), { AA: 1, Aa: 2, aa: 1 });
  assert.deepEqual(phenotypeRatio(s), { d: 3, r: 1 });
  assert.equal(expectedDominant(s), 0.75);
  assert.deepEqual(cross(s).grid, [["AA", "Aa"], ["Aa", "aa"]]);
});

test("test cross Aa × aa: 1 Aa : 1 aa, and AA × aa is uniform", () => {
  const s = make("Aa", "aa");
  assert.deepEqual(genotypeRatio(s), { Aa: 1, aa: 1 });
  assert.deepEqual(phenotypeRatio(s), { d: 1, r: 1 });
  assert.deepEqual(genotypeRatio(make("AA", "aa")), { Aa: 1 });
  assert.equal(expectedDominant(make("AA", "aa")), 1);
  assert.equal(expectedDominant(make("aa", "aa")), 0);
});

test("dihybrid AaBb × AaBb: 9 : 3 : 3 : 1", () => {
  const s = make("AaBb", "AaBb");
  assert.deepEqual(phenotypeRatio(s), { dd: 9, dr: 3, rd: 3, rr: 1 });
  assert.deepEqual(genotypeRatio(s), { AABB: 1, AABb: 2, AAbb: 1, AaBB: 2, AaBb: 4, Aabb: 2, aaBB: 1, aaBb: 2, aabb: 1 });
  assert.equal(cross(s).total, 16);
  assert.equal(expectedDominant(s), 9 / 16);
  // dihybrid test cross: 1 : 1 : 1 : 1
  assert.deepEqual(phenotypeRatio(make("AaBb", "aabb")), { dd: 1, dr: 1, rd: 1, rr: 1 });
});

test("incomplete dominance: Aa × Aa gives 1 : 2 : 1 phenotypes", () => {
  const s = make("Aa", "Aa", { incomplete: true });
  assert.deepEqual(phenotypeRatio(s), { d: 1, h: 2, r: 1 });
  assert.equal(expectedDominant(s), 0.25);
  // with a second, completely dominant gene: (1 : 2 : 1)(3 : 1)
  assert.deepEqual(phenotypeRatio(make("AaBb", "AaBb", { incomplete: true })), { dd: 3, dr: 1, hd: 6, hr: 2, rd: 3, rr: 1 });
});

test("the seeded sample is deterministic and batches add up", () => {
  const a = make("AaBb", "AaBb");
  const b = make("AaBb", "AaBb");
  breed(a, 300);
  breed(b, 100);
  breed(b, 200);
  assert.deepEqual(sample(a), sample(b));
  assert.equal(Object.values(sample(a)).reduce((x, y) => x + y), 300);
  // a batch counts only its own offspring
  const first = observed(a, 0, 100);
  const rest = observed(a, 100, 300);
  for (const [key, n] of Object.entries(observed(a))) assert.equal((first[key] ?? 0) + (rest[key] ?? 0), n);
  // another seed gives another sample; only possible genotypes ever appear
  clear(b);
  assert.equal(b.bred, 0);
  breed(b, 300);
  assert.notDeepEqual(sample(a), sample(b));
  const possible = cross(a).genotypes.map(g => g.genotype);
  for (const g of Object.keys(sample(b))) assert.ok(possible.includes(g));
});

test("a large sample is close to the expected ratios", () => {
  const n = MAX_OFFSPRING;
  const within = (count, p) => assert.ok(Math.abs(count / n - p) < 4 * Math.sqrt((p * (1 - p)) / n), `${count}/${n} vs ${p}`);
  const mono = make("Aa", "Aa");
  const batch = breed(mono, n);
  assert.equal(batch.count, n);
  within(batch.observed * n, 0.75);
  within(sample(mono).Aa, 0.5);
  const di = make("AaBb", "AaBb");
  breed(di, n);
  const seen = observed(di);
  within(seen.dd, 9 / 16);
  within(seen.dr, 3 / 16);
  within(seen.rd, 3 / 16);
  within(seen.rr, 1 / 16);
  const testCross = make("Aa", "aa");
  breed(testCross, n);
  within(observed(testCross).d, 0.5);
});

test("the number of offspring is capped and a forged state is harmless", () => {
  const s = make("Aa", "Aa");
  breed(s, MAX_OFFSPRING);
  assert.equal(breed(s, 500).count, 0);
  assert.equal(s.bred, MAX_OFFSPRING);
  assert.equal(bredOf({ ...s, bred: -5 }), 0);
  assert.equal(bredOf({ ...s, bred: 1e12 }), MAX_OFFSPRING);
  assert.deepEqual(sample({ ...s, bred: -5 }), {});
  // an unknown genotype string falls back to the heterozygote
  assert.equal(cross({ ...s, motherA: "XY" }).mother, "Aa");
});
