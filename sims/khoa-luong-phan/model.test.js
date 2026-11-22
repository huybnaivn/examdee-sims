import test from "node:test";
import assert from "node:assert/strict";
import {
  ORGANISMS, FEATURES, PRESET, MAX_QUESTIONS, initialState, parseKey, analyze, identify, has,
  progress, answer, choose, nextOrganism, found, addQuestion, undo,
} from "./model.js";

const idx = id => ORGANISMS.findIndex(o => o.id === id);
const names = group => group.map(i => ORGANISMS[i].id);

test("characteristics table", () => {
  for (const f of FEATURES) assert.equal(f.has.length, ORGANISMS.length, f.id);
  const withFeature = id => ORGANISMS.filter((_, i) => has(id, i)).map(o => o.id);
  assert.deepEqual(withFeature("xuong"), ["ca-chep", "ech", "ran", "bo-cau", "meo", "doi"]);
  assert.deepEqual(withFeature("chan"), ["ech", "bo-cau", "meo", "doi", "buom", "cua"]);
  assert.deepEqual(withFeature("canh"), ["bo-cau", "doi", "buom"]);
  assert.deepEqual(withFeature("longvu"), ["bo-cau"]);
  assert.deepEqual(withFeature("longmao"), ["meo", "doi"]);
  assert.deepEqual(withFeature("vay"), ["ca-chep", "ran"]);
  assert.deepEqual(withFeature("mang"), ["ca-chep", "cua"]);
  // no two animals share every characteristic, so a key can always tell them apart
  const rows = ORGANISMS.map((_, i) => FEATURES.map(f => f.has[i]).join(""));
  assert.equal(new Set(rows).size, ORGANISMS.length);
});

test("following the preset key identifies every organism at its own leaf", () => {
  const a = analyze(PRESET);
  assert.equal(a.valid, true);
  assert.deepEqual(a.flagged, []);
  assert.equal(a.leaves.length, ORGANISMS.length);
  const ends = ORGANISMS.map((_, i) => identify(PRESET, i).path);
  assert.equal(new Set(ends).size, ORGANISMS.length);
  for (const leaf of a.leaves) assert.deepEqual(leaf.group, [ends.indexOf(leaf.path)]);
  assert.deepEqual(identify(PRESET, idx("doi")), { path: "yyy", features: ["xuong", "longmao", "canh"], steps: 3 });
  assert.deepEqual(identify(PRESET, idx("ran")).features, ["xuong", "longmao", "longvu", "chan", "mang"]);
  assert.equal(identify(PRESET, idx("ran")).path, "ynnnn");
  assert.equal(identify(PRESET, idx("cua")).path, "nn");
});

test("depth of a key is the largest number of questions for one organism", () => {
  assert.equal(analyze("").depth, 0);
  assert.equal(analyze(":xuong").depth, 1);
  assert.equal(analyze(PRESET).depth, 5);
  assert.equal(Math.max(...ORGANISMS.map((_, i) => identify(PRESET, i).steps)), 5);
  assert.equal(analyze(PRESET).nodes.length, 7); // n organisms need n − 1 splitting questions
});

test("a valid key separates all organisms; an unfinished one does not", () => {
  const other = ":canh;y:longvu;yn:longmao;n:chan;ny:xuong;nyy:longmao;nn:mang";
  const a = analyze(other);
  assert.equal(a.valid, true);
  assert.deepEqual(a.leaves.map(leaf => names(leaf.group)), [["bo-cau"], ["doi"], ["buom"], ["meo"], ["ech"], ["cua"], ["ca-chep"], ["ran"]]);
  assert.equal(a.depth, 4);
  const partial = analyze(":xuong;n:canh");
  assert.equal(partial.separated, false);
  assert.equal(partial.valid, false);
  assert.deepEqual(names(partial.next.group), ["ca-chep", "ech", "ran", "bo-cau", "meo", "doi"]);
  assert.equal(partial.next.path, "y");
});

test("a question that does not split its group is flagged", () => {
  const a = analyze(":xuong;n:xuong"); // the invertebrates all answer "không" again
  assert.deepEqual(a.flagged, ["n"]);
  assert.equal(a.valid, false);
  // separated but with a useless question is still not a valid key
  const padded = analyze(PRESET.replace("n:canh", "n:vay;nn:canh"));
  assert.equal(padded.separated, true);
  assert.deepEqual(padded.flagged, ["n"]);
  assert.equal(padded.valid, false);
  // asking again about a single organism splits nothing either
  assert.deepEqual(analyze(PRESET + ";yyy:chan").flagged, ["yyy"]);
});

test("answering: right answers advance, wrong ones are counted, the last one identifies", () => {
  const s = choose(initialState(), "ech"); // xương sống: có, lông mao: không, lông vũ: không, chân: có
  assert.equal(progress(s).feature, "xuong");
  assert.deepEqual(answer(s, false), { correct: false, identified: false, organism: 1, question: 1, steps: 4, mistakes: 1 });
  assert.equal(s.path, "");
  assert.equal(s.lastWrong, true);
  assert.equal(answer(s, true).correct, true);
  answer(s, false);
  answer(s, false);
  assert.deepEqual(answer(s, true), { correct: true, identified: true, organism: 1, question: 4, steps: 4, mistakes: 1 });
  assert.deepEqual(found(s), [false, true, false, false, false, false, false, false]);
  assert.equal(answer(s, true), null); // nothing left to ask
  for (let k = 0; k < ORGANISMS.length - 1; k++) {
    nextOrganism(s);
    assert.equal(found(s)[progress(s).organism], false);
    const { path } = identify(PRESET, progress(s).organism);
    for (const step of path) answer(s, step === "y");
  }
  assert.ok(found(s).every(Boolean));
});

test("building: questions go to the first unresolved group, undo removes the last one", () => {
  const s = { ...initialState(), mode: "build" };
  for (const f of ["xuong", "longmao", "canh", "longvu", "chan", "mang"]) {
    s.feature = f;
    assert.equal(addQuestion(s), true);
    assert.equal(analyze(s.key).valid, false);
  }
  s.feature = "canh";
  addQuestion(s);
  assert.equal(s.key, PRESET);
  assert.equal(analyze(s.key).valid, true);
  assert.equal(addQuestion(s), false); // nothing left to split
  undo(s);
  assert.deepEqual(names(analyze(s.key).next.group), ["buom", "cua"]);
  s.feature = "xuong"; // neither has a backbone
  addQuestion(s);
  assert.deepEqual(analyze(s.key).flagged, ["n"]);
});

test("forged keys and paths are harmless", () => {
  assert.equal(parseKey("zz:xuong;:nope;:xuong:1;;y;:xuong;:canh").size, 1);
  assert.equal(parseKey("zz:xuong;:nope;:xuong:1;;y;:xuong;:canh").get(""), "xuong");
  assert.ok(parseKey(Array.from({ length: 50 }, (_, i) => `${"y".repeat(i % 8)}:xuong`).join(";")).size <= MAX_QUESTIONS);
  assert.equal(analyze(null).leaves.length, 1);
  const s = { ...initialState(), organism: "nobody", path: "nnnnyy", foundMask: -1, mistakes: -3 };
  assert.equal(progress(s).done, 0);
  assert.equal(progress(s).organism, 0);
  assert.equal(found(s).length, ORGANISMS.length);
  assert.equal(answer(s, true).mistakes, 0);
});
