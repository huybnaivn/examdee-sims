import test from "node:test";
import assert from "node:assert/strict";
import { initialState, cross, sample, breed, clear, bornOf, write, fuse, pedigree, possible, check, FEMALES, MALES, MAX_BORN } from "./model.js";

test("notation", () => {
  assert.equal(write("Aa"), "XᴬXᵃ");
  assert.equal(write("a"), "XᵃY");
  assert.equal(fuse("a", "A"), "Aa");
  assert.equal(fuse("a", "Y"), "a");
});

// Expected fractions [daughters AA, Aa, aa | sons A, a] for every pair of parents.
const TABLE = {
  "AA×A": [1, 0, 0, 1, 0],
  "AA×a": [0, 1, 0, 1, 0],
  "Aa×A": [0.5, 0.5, 0, 0.5, 0.5],
  "Aa×a": [0, 0.5, 0.5, 0.5, 0.5],
  "aa×A": [0, 1, 0, 0, 1],
  "aa×a": [0, 0, 1, 0, 1],
};

test("offspring ratios for every parent combination", () => {
  for (const m of FEMALES)
    for (const f of MALES) {
      const c = cross(m, f);
      const got = [c.daughters.AA, c.daughters.Aa, c.daughters.aa, c.sons.A, c.sons.a];
      assert.deepEqual(got, TABLE[`${m}×${f}`], `${m} × ${f}`);
      assert.equal(c.childrenAffected, (c.daughtersAffected + c.sonsAffected) / 2);
      assert.equal(c.grid.length * c.grid[0].length, c.motherGametes.length * 2);
    }
});

test("a carrier mother and a normal father can have affected sons, never affected daughters", () => {
  const c = cross("Aa", "A");
  assert.equal(c.sonsAffected, 0.5);
  assert.equal(c.daughtersAffected, 0);
  assert.equal(c.childrenAffected, 0.25);
});

test("every daughter of an affected father is a carrier or affected", () => {
  for (const m of FEMALES) assert.equal(cross(m, "a").daughters.AA, 0, m);
});

test("the trait is never passed from father to son", () => {
  // a son's X comes from his mother: sons of AA mothers are never affected, whatever the father
  assert.equal(cross("AA", "a").sonsAffected, 0);
  for (const m of FEMALES) assert.deepEqual(cross(m, "a").sons, cross(m, "A").sons, m);
  // also in samples: no affected son of an AA mother and an affected father
  const counts = sample({ ...initialState(), mother: "AA", father: "a", born: 2000 });
  assert.equal(counts.a, 0);
  assert.equal(counts.AA, 0);
});

test("sampled ratios are within tolerance of the expected ones", () => {
  for (const m of FEMALES)
    for (const f of MALES) {
      const s = { ...initialState(), mother: m, father: f, born: MAX_BORN };
      const k = sample(s);
      const daughters = k.AA + k.Aa + k.aa;
      const sons = k.A + k.a;
      const c = cross(m, f);
      assert.ok(Math.abs(daughters / MAX_BORN - 0.5) < 0.03);
      // 4 standard errors of a proportion over ~2500 children ≈ 0.04
      assert.ok(Math.abs(k.a / sons - c.sonsAffected) < 0.04, `${m}×${f} sons`);
      assert.ok(Math.abs(k.Aa / daughters - c.daughtersCarrier) < 0.04, `${m}×${f} carriers`);
      assert.ok(Math.abs(k.aa / daughters - c.daughtersAffected) < 0.04, `${m}×${f} affected daughters`);
    }
});

test("sampling is reproducible and breeding only extends it", () => {
  const s = { ...initialState(), born: 0 };
  breed(s, 100);
  const first = sample(s);
  breed(s, 50);
  assert.equal(bornOf(s), 150);
  const part = sample(s, 0, 100);
  assert.deepEqual(part, first);
  clear(s);
  assert.equal(s.born, 0);
  assert.equal(bornOf({ born: -5 }), 0);
  assert.equal(bornOf({ born: 1e9 }), MAX_BORN);
});

test("pedigree: phenotypes follow the genotypes and the target is certain", () => {
  for (let seed = 0; seed < 60; seed++) {
    const p = pedigree(seed);
    assert.ok(p, `seed ${seed}`);
    const t = p.persons[p.target];
    assert.equal(t.sex, "f");
    assert.deepEqual(p.sets[p.target], [t.genotype]);
    // the true genotypes are always among the possible ones
    p.persons.forEach((x, i) => assert.ok(p.sets[i].includes(x.genotype), `${seed} ${x.id}`));
    // a daughter carries her father's X
    for (const x of p.persons) if (x.father != null && x.sex === "f") assert.ok(x.genotype.includes(p.persons[x.father].genotype));
  }
});

test("pedigree deduction: a normal woman with an affected son is a carrier", () => {
  const persons = [
    { sex: "m", affected: false },
    { sex: "f", affected: false },
    { sex: "m", affected: true, father: 0, mother: 1 },
  ];
  assert.deepEqual(possible(persons)[1], ["Aa"]);
  const daughterOfAffected = [{ sex: "m", affected: true }, { sex: "f", affected: false }, { sex: "f", affected: false, father: 0, mother: 1 }];
  assert.deepEqual(possible(daughterOfAffected)[2], ["Aa"]);
  assert.deepEqual(possible(daughterOfAffected)[1].sort(), ["AA", "Aa"]);
});

test("checking an answer", () => {
  const s = initialState();
  const p = pedigree(s.pedSeed);
  s.answer = p.persons[p.target].genotype === "Aa" ? "AA" : "Aa";
  assert.equal(check(s), false);
  s.answer = p.persons[p.target].genotype;
  assert.equal(check(s), true);
  assert.equal(s.attempts, 2);
});
