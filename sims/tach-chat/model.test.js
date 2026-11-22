import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPONENTS, BOILING, MIXTURES, METHODS, CHALLENGE, RECOMMENDED, PLACES, initialState, apply, works, outcome, runSequence,
  distillTemp, analyse, progressOf, endOf, mixtureOf, methodOf,
} from "./model.js";

const M = METHODS.map(m => m.id); // loc, co-can, chiet, nam-cham, chung-cat

// Does the method separate the mixture (at least one substance collected on its own)?
//                      lọc  cô cạn chiết nam châm chưng cất
const TABLE = {
  "cat-nuoc":     [1, 1, 0, 0, 1],
  "muoi-nuoc":    [0, 1, 0, 0, 1],
  "dau-nuoc":     [0, 1, 1, 0, 1],
  "sat-luuhuynh": [0, 0, 0, 1, 0],
  "ruou-nuoc":    [0, 0, 0, 0, 1],
};

const total = (fractions, id) => fractions.reduce((sum, f) => sum + (f.comps[id] ?? 0), 0);
const at = (fractions, place) => Object.keys(fractions.find(f => f.place === place)?.comps ?? {}).sort();

test("method–mixture suitability table", () => {
  assert.deepEqual(MIXTURES.map(m => m.id), Object.keys(TABLE));
  for (const mixture of MIXTURES) {
    M.forEach((method, k) => assert.equal(outcome(mixture.id, method).works ? 1 : 0, TABLE[mixture.id][k], `${mixture.name} / ${method}`));
  }
});

test("the textbook method for each mixture works and is the one marked as recommended", () => {
  assert.deepEqual(RECOMMENDED, { "cat-nuoc": "loc", "muoi-nuoc": "co-can", "dau-nuoc": "chiet", "sat-luuhuynh": "nam-cham", "ruou-nuoc": "chung-cat" });
  for (const mixture of MIXTURES) {
    for (const method of M) {
      const o = outcome(mixture.id, method);
      assert.equal(o.recommended, RECOMMENDED[mixture.id] === method);
      if (o.recommended) assert.ok(o.works, mixture.name);
    }
  }
});

test("what ends up where", () => {
  const f = (mixture, method) => outcome(mixture, method).fractions;
  assert.deepEqual(at(f("cat-nuoc", "loc"), "giay-loc"), ["cat"]);
  assert.deepEqual(at(f("cat-nuoc", "loc"), "nuoc-loc"), ["nuoc"]);
  assert.deepEqual(at(f("muoi-nuoc", "loc"), "nuoc-loc"), ["muoi", "nuoc"]); // a solution passes through the paper
  assert.deepEqual(at(f("muoi-nuoc", "co-can"), "bat"), ["muoi"]);
  assert.deepEqual(at(f("muoi-nuoc", "co-can"), "hoi"), ["nuoc"]);
  assert.deepEqual(at(f("muoi-nuoc", "chung-cat"), "binh-hung"), ["nuoc"]);
  assert.deepEqual(at(f("muoi-nuoc", "chung-cat"), "binh-cau"), ["muoi"]);
  assert.deepEqual(at(f("dau-nuoc", "chiet"), "lop-duoi"), ["nuoc"]); // water is denser than oil
  assert.deepEqual(at(f("dau-nuoc", "chiet"), "lop-tren"), ["dau"]);
  assert.ok(COMPONENTS.dau.density < COMPONENTS.nuoc.density);
  assert.deepEqual(at(f("sat-luuhuynh", "nam-cham"), "nam-cham"), ["sat"]);
  assert.deepEqual(at(f("sat-luuhuynh", "nam-cham"), "giay"), ["luuhuynh"]);
  assert.deepEqual(at(f("ruou-nuoc", "co-can"), "hoi"), ["ethanol", "nuoc"]); // both boil away: nothing collected
  assert.deepEqual(at(f("ruou-nuoc", "chiet"), "pheu"), ["ethanol", "nuoc"]); // one layer
  assert.deepEqual(at(f("ruou-nuoc", "chung-cat"), "binh-hung"), ["ethanol"]);
  for (const mixture of MIXTURES) for (const method of M) for (const fr of f(mixture.id, method)) assert.ok(PLACES[fr.place], fr.place);
});

test("boiling points for distillation come from the documented table", () => {
  // °C at 1 atm
  assert.equal(BOILING.nuoc, 100);
  assert.equal(BOILING.ethanol, 78.3);
  assert.equal(BOILING.luuhuynh, 444.6);
  assert.equal(BOILING.sat, 2862);
  assert.equal(BOILING.muoi, 1465);
  for (const [id, c] of Object.entries(COMPONENTS)) assert.equal(BOILING[id], c.bp);
  // the liquid with the lower boiling point is the distillate, and the thermometer shows that temperature
  assert.ok(BOILING.ethanol < BOILING.nuoc);
  assert.equal(distillTemp(mixtureOf("ruou-nuoc").comps), 78.3);
  assert.equal(distillTemp(mixtureOf("muoi-nuoc").comps), 100);
  assert.equal(distillTemp(mixtureOf("dau-nuoc").comps), 100);
  assert.equal(distillTemp(mixtureOf("sat-luuhuynh").comps), null);
  assert.match(outcome("ruou-nuoc", "chung-cat").note, /78,3 °C/);
  for (const mixture of [...MIXTURES, CHALLENGE]) {
    const fr = apply("chung-cat", mixture.comps).fractions.find(x => x.place === "binh-hung");
    if (!fr) continue;
    const [id] = Object.keys(fr.comps);
    for (const other of analyse(mixture.comps).liquids) assert.ok(BOILING[id] <= BOILING[other]);
  }
});

test("mass of every component is conserved by every method", () => {
  for (const mixture of [...MIXTURES, CHALLENGE]) {
    for (const method of M) {
      const { fractions } = apply(method, mixture.comps);
      for (const [id, mass] of Object.entries(mixture.comps)) assert.equal(total(fractions, id), mass, `${mixture.name} / ${method} / ${id}`);
      assert.equal(fractions.reduce((n, f) => n + Object.keys(f.comps).length, 0), Object.keys(mixture.comps).length, "no component in two places");
    }
  }
  for (const a of M) {
    for (const b of M) {
      const { final } = runSequence(a, b);
      for (const [id, mass] of Object.entries(CHALLENGE.comps)) assert.equal(total(final, id), mass, `${a} → ${b} / ${id}`);
    }
  }
});

test("challenge: filter first, then evaporate (or distil)", () => {
  const ok = [];
  for (const a of M) for (const b of M) if (runSequence(a, b).success) ok.push(`${a} > ${b}`);
  assert.deepEqual(ok, ["loc > co-can", "loc > chung-cat"]);
  const r = runSequence("loc", "co-can");
  assert.deepEqual(at(r.final, "giay-loc"), ["cat"]);
  assert.deepEqual(at(r.final, "bat"), ["muoi"]);
  assert.deepEqual(at(r.final, "hoi"), ["nuoc"]);
  assert.deepEqual(r.steps[1].input, { muoi: 10, nuoc: 100 }); // step 2 works on the filtrate
  // the reverse order leaves sand and salt mixed in the dish, and a dry solid cannot be filtered
  const wrong = runSequence("co-can", "loc");
  assert.equal(wrong.success, false);
  assert.deepEqual(wrong.steps[1].input, { cat: 20, muoi: 10 });
  assert.deepEqual(at(wrong.final, "giay-loc"), ["cat", "muoi"]);
  // distilling as step 2 also recovers the water
  assert.deepEqual(at(runSequence("loc", "chung-cat").final, "binh-hung"), ["nuoc"]);
});

test("works() needs two fractions and one pure collected fraction", () => {
  assert.equal(works([{ place: "bat", comps: { cat: 1 } }]), false);
  assert.equal(works([{ place: "hoi", comps: { nuoc: 1 } }, { place: "bat", comps: { cat: 1, muoi: 1 } }]), false);
  assert.equal(works([{ place: "hoi", comps: { nuoc: 1 } }, { place: "bat", comps: { muoi: 1 } }]), true);
});

test("state helpers tolerate forged values", () => {
  const s = initialState();
  assert.equal(endOf(s), 1);
  assert.equal(progressOf({ ...s, progress: -3 }), 0);
  assert.equal(progressOf({ ...s, progress: 99 }), 1);
  assert.equal(progressOf({ ...s, mode: "challenge", progress: 99 }), 2);
  assert.equal(progressOf({ ...s, progress: "x" }), 0);
  assert.equal(mixtureOf("???").id, "cat-nuoc");
  assert.equal(methodOf("???").id, "loc");
  assert.equal(runSequence(s.step1, s.step2).success, false); // the starting sequence is not the answer
});
