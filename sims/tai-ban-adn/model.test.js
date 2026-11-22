import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE, MIN_LENGTH, MAX_LENGTH, MAX_ROUNDS, FRAGMENT, SPEED, initialState, complement, hydrogenBonds,
  composition, templateOf, lengthOf, roundOf, roundsOf, fragmentsOf, duration, fork, daughters,
  replicate, generations, withOriginal, totals, timeOf, shownRound, commitProgress, step, restart, check,
} from "./model.js";

const SEQ = "TACGGCATTCAG";

test("complementary pairing: A–T and G–C", () => {
  assert.equal(complement("ATGC"), "TACG");
  assert.equal(complement(complement(BASE)), BASE);
  for (let i = 0; i < BASE.length; i++) assert.ok(["AT", "TA", "GC", "CG"].includes(BASE[i] + complement(BASE)[i]));
  // both daughters are copies of the parent: each new strand equals the parent's other strand
  const [first, second] = daughters(SEQ);
  assert.equal(first.made, complement(first.old));
  assert.equal(second.made, complement(second.old));
  assert.deepEqual([first.old, first.made], [SEQ, complement(SEQ)]);
  assert.deepEqual([second.made, second.old], [SEQ, complement(SEQ)]);
});

test("hydrogen bonds: 2 per A–T pair, 3 per G–C pair, H = 2A + 3G", () => {
  assert.deepEqual(["A", "T", "G", "C"].map(hydrogenBonds), [2, 2, 3, 3]);
  const c = composition(SEQ);
  assert.deepEqual(c, { pairs: 12, nucleotides: 24, A: 6, T: 6, G: 6, C: 6, hydrogen: 30 });
  assert.equal(c.hydrogen, [...SEQ].reduce((sum, b) => sum + hydrogenBonds(b), 0));
  assert.equal(c.hydrogen, 2 * c.A + 3 * c.G);
  assert.equal(c.A + c.T + c.G + c.C, c.nucleotides);
  for (let L = MIN_LENGTH; L <= MAX_LENGTH; L++) {
    const k = composition(templateOf({ length: L }));
    assert.equal(k.A, [...BASE.slice(0, L) + complement(BASE.slice(0, L))].filter(b => b === "A").length);
    assert.ok(k.A > 0 && k.G > 0);
  }
});

test("leading strand is continuous, lagging strand is made in Okazaki fragments joined later", () => {
  const T = duration(SEQ.length);
  assert.equal(fragmentsOf(12).length, 3);
  assert.deepEqual(fragmentsOf(10).map(f => f.len), [4, 4, 2]);
  assert.deepEqual(fork(SEQ, 0), { ...fork(SEQ, 0), unwound: 0, leading: 0, added: 0, hydrogen: 0, pieces: 0, complete: false });
  let seenPieces = 0;
  for (let t = 0; t <= T; t += 0.25) {
    const f = fork(SEQ, t);
    assert.ok(f.leading <= f.unwound, "polymerase stays behind helicase");
    for (const i of f.lagging) assert.ok(i < f.unwound, "only unwound template is copied");
    for (const frag of f.fragments) {
      // a fragment grows from the fork side towards the left: 5'→3' on the new strand
      const mine = f.lagging.filter(i => i >= frag.start && i < frag.start + frag.len);
      assert.deepEqual(mine, Array.from({ length: frag.made }, (_, k) => frag.start + frag.len - 1 - k));
      if (frag.joined) assert.equal(frag.made, frag.len);
    }
    seenPieces = Math.max(seenPieces, f.pieces);
  }
  assert.ok(seenPieces >= 2, "the lagging strand exists as separate fragments for a while");
  const mid = fork(SEQ, 11);
  assert.equal(mid.leading, 10);
  assert.deepEqual(mid.fragments.map(f => f.made), [4, 2, 0]);
  const end = fork(SEQ, T);
  assert.equal(end.complete, true);
  assert.equal(end.leading, 12);
  assert.equal(end.pieces, 1); // everything sealed into one strand
  assert.deepEqual(end.fragments.map(f => f.joined), [false, true, true]);
  assert.equal(fork(SEQ, 1e9).t, T);
});

test("one round uses N free nucleotides and forms 2H hydrogen bonds", () => {
  for (let L = MIN_LENGTH; L <= MAX_LENGTH; L++) {
    const seq = BASE.slice(0, L);
    const end = fork(seq, duration(L));
    assert.equal(end.added, composition(seq).nucleotides);
    assert.equal(end.hydrogen, 2 * composition(seq).hydrogen);
    assert.equal(fragmentsOf(L).length, Math.ceil(L / FRAGMENT));
  }
});

test("nucleotides used over n rounds: N(2ⁿ − 1), by type A(2ⁿ − 1) and G(2ⁿ − 1)", () => {
  assert.deepEqual(totals(SEQ, 0), { molecules: 1, withOriginal: 1, allNew: 0, nucleotidesUsed: 0, usedA: 0, usedG: 0, hydrogenBroken: 0, hydrogenTotal: 30 });
  assert.deepEqual(totals(SEQ, 3), { molecules: 8, withOriginal: 2, allNew: 6, nucleotidesUsed: 168, usedA: 42, usedG: 42, hydrogenBroken: 210, hydrogenTotal: 240 });
  for (let n = 1; n <= MAX_ROUNDS; n++) {
    const t = totals(SEQ, n);
    assert.equal(t.nucleotidesUsed, 24 * (2 ** n - 1));
    assert.equal(2 * t.usedA + 2 * t.usedG, t.nucleotidesUsed);
    // each round doubles the molecules, every existing molecule taking N free nucleotides
    assert.equal(t.nucleotidesUsed - totals(SEQ, n - 1).nucleotidesUsed, 24 * 2 ** (n - 1));
  }
});

test("semi-conservative: every molecule keeps one old strand and gets one new strand", () => {
  let molecules = [[0, 0]];
  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const before = molecules.flat();
    molecules = replicate(molecules, r);
    for (const [old, made] of molecules) {
      assert.ok(old < r, "one strand comes from the parent molecule");
      assert.equal(made, r, "the other is new");
    }
    // no old strand is lost or copied: the parents' strands are exactly the daughters' old strands
    assert.deepEqual(molecules.map(m => m[0]), before);
    assert.deepEqual(generations(r), molecules);
  }
  // strand census after 5 rounds: 2 original strands, 2^r strands made in round r
  const strands = generations(5).flat();
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(r => strands.filter(g => g === r).length), [2, 2, 4, 8, 16, 32]);
});

test("after n rounds there are 2ⁿ molecules and exactly 2 contain an original strand", () => {
  assert.equal(generations(0).length, 1);
  assert.equal(withOriginal(0), 1);
  for (let n = 1; n <= MAX_ROUNDS; n++) {
    assert.equal(generations(n).length, 2 ** n);
    assert.equal(withOriginal(n), 2);
    for (const m of generations(n)) assert.ok(m.filter(g => g === 0).length <= 1); // never both original strands together
  }
  assert.equal(generations(99).length, 2 ** MAX_ROUNDS);
});

test("animation: a round is counted once at 100 %, and it stops after n rounds", () => {
  const s = { ...initialState(), rounds: 2, progress: 0 };
  let finished = 0;
  let seconds = 0;
  while (seconds < 60) {
    if (step(s, 1 / 120)) {
      finished++;
      assert.equal(s.progress, 100);
      assert.equal(shownRound(s), s.round);
      if (finished === 1) assert.ok(Math.abs(seconds - duration(12) / SPEED) < 0.05);
    }
    seconds += 1 / 120;
  }
  assert.equal(finished, 2);
  assert.equal(s.round, 2);
  assert.equal(step(s, 1), false);
  assert.equal(timeOf(s), duration(12));
  // dragging the progress slider to the end counts the round too, but only while rounds remain
  const d = { ...initialState(), rounds: 1, progress: 100 };
  assert.equal(shownRound({ ...d, progress: 40 }), 1);
  assert.equal(commitProgress(d), true);
  assert.equal(commitProgress(d), false);
  assert.equal(d.round, 1);
  assert.deepEqual(restart(d), { ...initialState(), rounds: 1, progress: 0 });
});

test("prediction and forged state", () => {
  const s = { ...initialState(), rounds: 4, guess: 16 };
  assert.equal(check(s), false);
  assert.equal(s.verdict, "wrong");
  s.guess = 2;
  assert.equal(check(s), true);
  assert.equal(s.verdict, "right");
  const forged = { length: 1e9, rounds: -4, round: 77, progress: 1e6 };
  assert.deepEqual([lengthOf(forged), roundsOf(forged), roundOf(forged)], [MAX_LENGTH, 1, 1]);
  assert.equal(timeOf(forged), duration(MAX_LENGTH));
  assert.equal(lengthOf({ length: "x" }), MIN_LENGTH);
});
