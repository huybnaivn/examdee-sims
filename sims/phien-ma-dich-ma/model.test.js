import test from "node:test";
import assert from "node:assert/strict";
import {
  CODON_TABLE, STOP, PRESETS, transcribe, templateOf, anticodon, translate, mutate, classify, applyMutation, initialState, tidy,
} from "./model.js";

test("complementary pairing: A→U, T→A, G→C, C→G", () => {
  assert.equal(transcribe("ATGC"), "UACG");
  assert.equal(transcribe("TACAAACCCATT"), "AUGUUUGGGUAA");
  assert.equal(templateOf(transcribe("GATTACA")), "GATTACA");
  assert.equal(anticodon("AUG"), "UAC");
});

test("codon table: 64 codons, 20 amino acids, start AUG, three stop codons", () => {
  const codons = Object.keys(CODON_TABLE);
  assert.equal(codons.length, 64);
  assert.ok(codons.every(c => /^[UCAG]{3}$/.test(c)));
  assert.deepEqual(codons.filter(c => CODON_TABLE[c] === STOP).sort(), ["UAA", "UAG", "UGA"]);
  assert.equal(new Set(Object.values(CODON_TABLE).filter(a => a !== STOP)).size, 20);
  assert.equal(CODON_TABLE.AUG, "Met");
  assert.deepEqual(codons.filter(c => CODON_TABLE[c] === "Met"), ["AUG"]);
  assert.deepEqual(codons.filter(c => CODON_TABLE[c] === "Trp"), ["UGG"]);
  const count = aa => codons.filter(c => CODON_TABLE[c] === aa).length;
  assert.deepEqual([count("Leu"), count("Ser"), count("Arg"), count("Ile"), count("Gly")], [6, 6, 6, 3, 4]);
  const spot = { UUU: "Phe", GAG: "Glu", GUG: "Val", AAA: "Lys", CAU: "His", UGU: "Cys", GCC: "Ala", CCU: "Pro", ACU: "Thr", AAU: "Asn", GAU: "Asp", CAA: "Gln", UAU: "Tyr" };
  for (const [c, aa] of Object.entries(spot)) assert.equal(CODON_TABLE[c], aa, c);
});

test("reading frame starts at the first AUG and stops at a stop codon", () => {
  const t = translate("GGAUGAAAUAGCCCUGA");
  assert.equal(t.start, 2);
  assert.deepEqual(t.codons, ["AUG", "AAA", "UAG"]);
  assert.deepEqual(t.aminoAcids, ["Met", "Lys"]);
  assert.equal(t.stopped, true);
  // preset 3: a second AUG out of frame is not a start
  const p3 = translate(PRESETS[2].mrna);
  assert.deepEqual(p3.aminoAcids, ["Met", "His", "Gly", "Ile", "Ala"]);
  assert.equal(p3.stopped, true);
  // no stop codon: translation runs off the end, no start: nothing
  assert.deepEqual(translate("AUGUUUCC"), { start: 0, codons: ["AUG", "UUU"], aminoAcids: ["Met", "Phe"], stopped: false });
  assert.deepEqual(translate("CCCGGG").codons, []);
});

test("presets translate as described", () => {
  assert.deepEqual(translate(PRESETS[0].mrna).aminoAcids, ["Met", "Ala", "Ser", "Lys", "Trp"]);
  assert.deepEqual(translate(PRESETS[1].mrna).aminoAcids, ["Met", "Val", "His", "Leu", "Thr", "Pro", "Glu", "Glu", "Lys"]);
  for (const p of PRESETS) assert.equal(transcribe(p.template), p.mrna);
});

test("each mutation type is classified correctly", () => {
  const g = PRESETS[0].template; // mRNA CA AUG GCU UCA AAG UGG UAA CU
  const sub = (pos, base) => classify(g, mutate(g, "sub", pos, base), "sub");
  assert.equal(sub(11, "C"), 0); // UCA → UCG, still Ser: silent
  assert.equal(sub(1, "A"), 0); // before the start codon
  assert.equal(sub(7, "A"), 1); // GCU → GUU, Ala → Val: missense
  assert.equal(sub(12, "A"), 2); // AAG → UAG: nonsense
  assert.equal(sub(17, "T"), 2); // UGG → UGA: nonsense
  assert.equal(sub(4, "T"), 4); // AUG → AAG: start codon lost
  assert.equal(sub(18, "C"), 4); // UAA → GAA: stop codon lost
  assert.equal(sub(20, "C"), 0); // UAA → UAG, still a stop: silent
  assert.equal(classify(g, mutate(g, "ins", 8, "A"), "ins"), 3);
  assert.equal(classify(g, mutate(g, "del", 10, "A"), "del"), 3);
  assert.equal(classify(g, mutate(g, "del", 22, "A"), "del"), 0); // after the stop codon
  // sickle-cell: GAG → GUG, Glu → Val
  const hb = PRESETS[1].template;
  const hbs = mutate(hb, "sub", 22, "A");
  assert.equal(classify(hb, hbs, "sub"), 1);
  assert.equal(translate(transcribe(hbs)).aminoAcids[6], "Val");
});

test("mutate edits one nucleotide; applyMutation restarts expression and reports codes", () => {
  assert.equal(mutate("ATGC", "sub", 2, "C"), "ACGC");
  assert.equal(mutate("ATGC", "ins", 2, "C"), "ATCGC");
  assert.equal(mutate("ATGC", "del", 2, "C"), "AGC");
  const s = { ...initialState(), mutType: "sub", mutPos: 12, mutBase: "A" };
  assert.deepEqual(applyMutation(s), { type: 0, effect: 2 });
  assert.equal(s.tx, 0);
  s.mutBase = s.template[11];
  assert.equal(applyMutation(s), null); // same base: nothing to do
  const t = tidy({ ...initialState(), mutPos: 99, tx: -5, tl: 50 });
  assert.equal(t.mutPos, t.template.length);
  assert.equal(t.tx, 0);
  assert.equal(t.tl, 6);
});
