import test from "node:test";
import assert from "node:assert/strict";
import {
  ORGANS, ENZYMES, PLACEABLE, TOTAL, initialState, newMeal, normalize, step, run,
  organAt, position, enzymesIn, worksAt, digested, absorbed, matched, matchCount,
} from "./model.js";

const organ = id => ORGANS.find(o => o.id === id);
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const END = { mouth: 1 / 60, stomach: 1 / 60 + 4, small: 1 / 60 + 8 };
const quiz = places => ({ ...initialState(), mode: "quiz", ...places });
const CORRECT = { pAmylase: "mieng", pPepsin: "da-day", pMaltase: "ruot-non", pTrypsin: "ruot-non", pLipase: "ruot-non" };

test("enzyme – organ – substrate table", () => {
  const table = Object.fromEntries(ENZYMES.map(e => [e.id, `${e.organ}: ${e.from} -> ${e.to}`]));
  assert.deepEqual(table, {
    "amylase-nuoc-bot": "mieng: starch -> maltose",
    pepsin: "da-day: protein -> peptide",
    "amylase-tuy": "ruot-non: starch -> maltose",
    maltase: "ruot-non: maltose -> glucose",
    trypsin: "ruot-non: protein -> peptide",
    peptidase: "ruot-non: peptide -> amino",
    lipase: "ruot-non: lipid -> glyFat",
  });
  assert.deepEqual(enzymesIn(initialState(), organ("ruot-gia")), []); // no digestive enzyme in the large intestine
  assert.deepEqual(enzymesIn(initialState(), organ("ruot-non")).map(e => e.id), ["amylase-tuy", "maltase", "trypsin", "peptidase", "lipase"]);
});

test("pH of each organ, and every enzyme works at the pH of its own organ", () => {
  assert.deepEqual(ORGANS.map(o => [o.id, o.pH]), [["mieng", 7.2], ["da-day", 2], ["ruot-non", 8], ["ruot-gia", 6.5]]);
  for (const e of ENZYMES) assert.ok(worksAt(e, organ(e.organ)), e.id);
  const pepsin = ENZYMES.find(e => e.id === "pepsin");
  assert.equal(worksAt(pepsin, organ("ruot-non")), false); // acid enzyme, alkaline organ
  for (const e of ENZYMES.filter(e => e.organ === "ruot-non")) assert.equal(worksAt(e, organ("da-day")), false);
});

test("time in each organ", () => {
  assert.deepEqual(ORGANS.map(o => o.hours), [1 / 60, 4, 4, 15]);
  near(TOTAL, 23 + 1 / 60, 1e-9);
  assert.equal(organAt(0).id, "mieng");
  assert.equal(organAt(1).id, "da-day");
  assert.equal(organAt(5).id, "ruot-non");
  assert.equal(organAt(10).id, "ruot-gia");
  assert.equal(organAt(TOTAL).id, "ruot-gia");
  near(position(END.mouth + 1).frac, 0.25, 1e-9);
  // the animation gives each organ its own number of seconds
  const s = step(initialState(), ORGANS[0].seconds + ORGANS[1].seconds / 2);
  near(s.t, END.mouth + 2, 1e-6);
});

test("final products: glucose, amino acid, glycerol + fatty acids; mass is conserved", () => {
  const s = initialState();
  const sums = () => [
    s.starch + s.maltose + s.glucose + s.absGlucose,
    s.protein + s.peptide + s.amino + s.absAmino,
    s.lipid + s.glyFat + s.absGlyFat,
    s.water + s.absWaterSmall + s.absWaterLarge,
  ];
  for (const until of [END.mouth, 2, END.stomach, 6, END.small, TOTAL]) {
    run(s, until);
    for (const sum of sums()) near(sum, 1, 1e-9);
  }
  assert.equal(s.t, TOTAL);
  const d = digested(s);
  for (const key of ["starch", "protein", "lipid"]) assert.ok(d[key] > 0.99, `${key} ${d[key]}`);
  for (const key of ["starch", "maltose", "protein", "peptide", "lipid"]) assert.ok(s[key] < 0.005, key);
});

test("mouth and stomach only start the job: nothing is fully digested before its enzymes have acted", () => {
  const s = run(initialState(), END.mouth);
  near(s.maltose, 0.05); // salivary amylase turns a small part of the starch into maltose
  assert.deepEqual(digested(s), { starch: 0, protein: 0, lipid: 0 });
  run(s, END.stomach);
  near(s.maltose, 0.05); // no amylase works in the acid stomach
  near(s.peptide, 0.15); // pepsin cuts part of the protein into peptides
  assert.equal(s.lipid, 1);
  assert.deepEqual(digested(s), { starch: 0, protein: 0, lipid: 0 });
  run(s, END.stomach + 0.5);
  const d = digested(s);
  assert.ok(d.starch > 0 && d.protein > 0 && d.lipid > 0);
});

test("a missing or misplaced enzyme leaves its nutrient undigested", () => {
  const none = run(quiz({}));
  near(none.maltose, 1); // pancreatic amylase alone stops at maltose
  assert.deepEqual(digested(none), { starch: 0, protein: 0, lipid: 0 });
  const noMaltase = run(quiz({ ...CORRECT, pMaltase: "none" }));
  assert.equal(digested(noMaltase).starch, 0);
  assert.ok(digested(noMaltase).protein > 0.99);
  const lipaseInStomach = run(quiz({ ...CORRECT, pLipase: "da-day" })); // wrong pH: inactive
  assert.equal(digested(lipaseInStomach).lipid, 0);
  assert.equal(enzymesIn(lipaseInStomach, organ("da-day")).find(e => e.id === "lipase").active, false);
  const trypsinInStomach = run(quiz({ ...CORRECT, pTrypsin: "da-day" })); // only pepsin's 15 % reaches peptidase
  near(digested(trypsinInStomach).protein, 0.15);
  const right = run(quiz(CORRECT));
  assert.deepEqual(digested(right), digested(run(initialState())));
});

test("absorption happens mostly in the small intestine", () => {
  const s = run(initialState(), END.stomach);
  assert.deepEqual(absorbed(s), { starch: 0, protein: 0, lipid: 0, water: 0 });
  run(s, END.small);
  const small = absorbed(s);
  for (const key of ["starch", "protein", "lipid"]) assert.ok(small[key] > 0.99, `${key} ${small[key]}`);
  near(s.absWaterSmall, 0.9);
  run(s);
  const end = absorbed(s);
  for (const key of ["starch", "protein", "lipid"]) near(end[key], small[key], 1e-12); // nothing more in the large intestine
  near(s.absWaterLarge, 0.09);
  assert.ok(s.absWaterSmall > 5 * s.absWaterLarge);
});

test("matching enzymes to organs", () => {
  assert.equal(matchCount(quiz({})), 0);
  assert.equal(matched(quiz({ ...CORRECT, pPepsin: "ruot-non" })), false);
  assert.equal(matchCount(quiz({ ...CORRECT, pPepsin: "ruot-non" })), PLACEABLE.length - 1);
  assert.equal(matched(quiz(CORRECT)), true);
});

test("a forged state is clamped, and a new meal starts over", () => {
  const s = normalize({ ...initialState(), t: -5, starch: 9, lipid: -2, water: "x" });
  assert.deepEqual([s.t, s.starch, s.lipid, s.water], [0, 1, 0, 0]);
  assert.equal(normalize({ ...initialState(), t: 1e9 }).t, TOTAL);
  const done = run(initialState());
  newMeal(done);
  assert.deepEqual(done, initialState());
});
