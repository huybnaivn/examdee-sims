import test from "node:test";
import assert from "node:assert/strict";
import { initialState, cells, counts, MITOSIS, MEIOSIS, gameteTypes, signature, answerOf, isRight, phaseOf, orientOf } from "./model.js";

const make = (type, n2, phase, extra = {}) => ({ ...initialState(), type, n2, phase, ...extra });
// per step: [number of cells, chromosomes per cell, đơn/kép, chromatids per cell, centromeres per cell]
const table = (type, n2) => (type === "meiosis" ? MEIOSIS : MITOSIS).map((_, phase) => {
  const cs = cells(make(type, n2, phase));
  const c = counts(cs[0]);
  for (const other of cs) assert.deepEqual(counts(other), c, "all cells of a step are alike");
  return [cs.length, c.chromosomes, c.kind, c.chromatids, c.centromeres];
});

test("mitosis: counts per cell at each phase (textbook table)", () => {
  for (const n2 of [4, 6, 8]) {
    assert.deepEqual(table("mitosis", n2), [
      [1, n2, "don", 0, n2], // kì trung gian, before replication: 2n đơn
      [1, n2, "kep", 2 * n2, n2], // after replication: 2n kép, 4n chromatids
      [1, n2, "kep", 2 * n2, n2], // kì đầu
      [1, n2, "kep", 2 * n2, n2], // kì giữa
      [1, 2 * n2, "don", 0, 2 * n2], // kì sau: 4n đơn
      [2, n2, "don", 0, n2], // kì cuối: 2 cells, 2n đơn each
    ]);
  }
});

test("meiosis: counts per cell at each phase (textbook table)", () => {
  for (const n2 of [4, 6, 8]) {
    const n = n2 / 2;
    assert.deepEqual(table("meiosis", n2), [
      [1, n2, "don", 0, n2],
      [1, n2, "kep", 2 * n2, n2],
      [1, n2, "kep", 2 * n2, n2], // kì đầu I
      [1, n2, "kep", 2 * n2, n2], // kì giữa I
      [1, n2, "kep", 2 * n2, n2], // kì sau I: 2n kép still in one cell
      [2, n, "kep", n2, n], // kì cuối I: n kép
      [2, n, "kep", n2, n], // kì đầu II
      [2, n, "kep", n2, n], // kì giữa II
      [2, n2, "don", 0, n2], // kì sau II: 2n đơn
      [4, n, "don", 0, n], // kì cuối II: n đơn
    ]);
  }
});

test("phase order", () => {
  assert.equal(MITOSIS.length, 6);
  assert.equal(MEIOSIS.length, 10);
  assert.deepEqual(MITOSIS.slice(2), ["Kì đầu", "Kì giữa", "Kì sau", "Kì cuối"]);
  assert.deepEqual(MEIOSIS.slice(2), ["Kì đầu I", "Kì giữa I", "Kì sau I", "Kì cuối I", "Kì đầu II", "Kì giữa II", "Kì sau II", "Kì cuối II"]);
  for (const list of [MITOSIS, MEIOSIS]) {
    assert.match(list[0], /trước khi nhân đôi/);
    assert.match(list[1], /sau khi nhân đôi/);
  }
  const layouts = MITOSIS.map((_, p) => cells(make("mitosis", 4, p))[0].layout);
  assert.deepEqual(layouts, ["interphase", "interphase", "prophase", "plate", "poles", "telophase"]);
  assert.equal(cells(make("meiosis", 4, 2))[0].layout, "synapsis");
  assert.equal(cells(make("meiosis", 4, 3))[0].layout, "plate2");
});

test("2 daughter cells after mitosis, 4 after meiosis", () => {
  for (const n2 of [4, 6, 8]) {
    const mit = cells(make("mitosis", n2, 5));
    const mei = cells(make("meiosis", n2, 9));
    assert.equal(mit.length, 2);
    assert.equal(mei.length, 4);
    // mitosis: daughters identical to the mother cell (one of every chromosome)
    assert.equal(signature(mit[0]), signature(mit[1]));
    assert.equal(signature(mit[0]), signature(cells(make("mitosis", n2, 0))[0]));
    // meiosis: one chromosome of each pair per gamete
    for (const g of mei) assert.deepEqual(g.chromosomes.map(c => c.pair).sort(), [...Array(n2 / 2).keys()]);
  }
});

test("meiosis I sends one homologue of every pair to each pole, as arranged", () => {
  const s = make("meiosis", 6, 4, { orient: 0b101 });
  const up = cells(s)[0].chromosomes.filter(c => c.pole === -1);
  assert.deepEqual(up.map(c => [c.pair, c.parent]).sort(), [[0, 1], [1, 0], [2, 1]]);
});

test("2ⁿ kinds of gametes without crossing over", () => {
  assert.equal(gameteTypes(4).size, 4);
  assert.equal(gameteTypes(6).size, 8);
  assert.equal(gameteTypes(8).size, 16);
  // without crossing over, the two gametes from one secondary cell are identical
  const g = cells(make("meiosis", 8, 9, { orient: 6 }));
  assert.equal(signature(g[0]), signature(g[1]));
  assert.equal(signature(g[2]), signature(g[3]));
  assert.notEqual(signature(g[0]), signature(g[2]));
});

test("crossing over on the largest pair gives recombinant chromatids and more gamete kinds", () => {
  const g = cells(make("meiosis", 4, 9, { crossing: true }));
  assert.equal(new Set(g.map(signature)).size, 4); // all four gametes differ
  const pair0 = g.map(c => c.chromosomes.find(x => x.pair === 0).chromatids[0]);
  assert.equal(pair0.filter(ct => ct.base !== ct.tip).length, 2); // two recombinants
  assert.equal(gameteTypes(4, true).size, 8);
  // crossing over does not change any count
  assert.deepEqual(counts(cells(make("meiosis", 4, 3, { crossing: true }))[0]), counts(cells(make("meiosis", 4, 3))[0]));
});

test("quiz answer and forged state", () => {
  assert.deepEqual(answerOf(make("mitosis", 8, 4)), { chromosomes: 16, kind: "don", chromatids: 0, centromeres: 16 });
  assert.ok(isRight(make("meiosis", 6, 5, { guess: 3, guessKind: "kep" })));
  assert.ok(!isRight(make("meiosis", 6, 5, { guess: 3, guessKind: "don" })));
  assert.equal(phaseOf(make("mitosis", 4, 99)), 5);
  assert.equal(phaseOf(make("mitosis", 4, -2)), 0);
  assert.equal(orientOf(make("meiosis", 4, 3, { orient: 255 })), 3);
  assert.equal(cells(make("mitosis", 7, 0))[0].chromosomes.length, 4); // unknown 2n falls back to 4
});
