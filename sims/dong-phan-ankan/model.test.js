import test from "node:test";
import assert from "node:assert/strict";
import { initialState, analyse, isomers, adjacency, canonical, nameTree, addCarbon, addBond, removeCarbon, record, sanitize, formula } from "./model.js";

const NAMES = {
  1: ["methane"],
  2: ["ethane"],
  3: ["propane"],
  4: ["butane", "2-methylpropane"],
  5: ["pentane", "2-methylbutane", "2,2-dimethylpropane"],
  6: ["hexane", "2-methylpentane", "3-methylpentane", "2,2-dimethylbutane", "2,3-dimethylbutane"],
  7: [
    "heptane", "2-methylhexane", "3-methylhexane", "2,2-dimethylpentane", "2,3-dimethylpentane",
    "2,4-dimethylpentane", "3,3-dimethylpentane", "3-ethylpentane", "2,2,3-trimethylbutane",
  ],
};

test("isomer counts of CnH2n+2 are 1, 1, 1, 2, 3, 5, 9", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(n => isomers(n).length), [1, 1, 1, 2, 3, 5, 9]);
});

test("IUPAC names of every isomer up to C7", () => {
  for (const [n, names] of Object.entries(NAMES)) assert.deepEqual(isomers(+n).map(i => i.name), names);
});

test("every isomer has 2n + 2 hydrogens", () => {
  for (let n = 1; n <= 7; n++) for (const iso of isomers(n)) assert.equal(iso.adj.reduce((h, a) => h + 4 - a.length, 0), 2 * n + 2);
});

test("canonical form: two drawings of one isomer agree, different isomers differ", () => {
  // 2-methylbutane numbered two ways, and 3-methylhexane drawn from either end
  const a = adjacency(5, [[0, 1], [1, 2], [2, 3], [1, 4]]);
  const b = adjacency(5, [[4, 3], [3, 2], [2, 0], [2, 1]]);
  assert.equal(canonical(a), canonical(b));
  assert.equal(nameTree(b).name, "2-methylbutane");
  const pentane = adjacency(5, [[0, 1], [1, 2], [2, 3], [3, 4]]);
  assert.notEqual(canonical(a), canonical(pentane));
  const left = adjacency(7, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6]]);
  const right = adjacency(7, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 6]]);
  assert.equal(canonical(left), canonical(right));
  assert.equal(nameTree(left).name, "3-methylhexane");
  assert.equal(nameTree(right).name, "3-methylhexane");
});

test("a skeleton on the grid is analysed, named and counted once", () => {
  const s = initialState();
  const a = analyse(s.atoms, s.bonds);
  assert.equal(a.ok, true);
  assert.equal(a.name, "2-methylbutane");
  assert.equal(a.H, 12);
  assert.equal(formula(a.n, a.H), "C₅H₁₂");
  assert.equal(a.id, 2);
  // the same isomer drawn elsewhere is a duplicate
  const t = { ...initialState(), atoms: [], bonds: [], found: [] };
  for (const [x, y] of [[0, 4], [1, 4], [2, 4], [3, 4], [3, 3]]) addCarbon(t, x, y);
  for (const [i, j] of [[0, 1], [1, 2], [2, 3], [2, 4]]) addBond(t, i, j);
  assert.equal(record(t).isNew, true);
  assert.equal(record(t).isNew, false);
  assert.deepEqual(t.found, [2]);
});

test("rings, over-bonded carbons and loose carbons are rejected", () => {
  const ring = { atoms: [[0, 0], [1, 0], [1, 1]], bonds: [[0, 1], [1, 2], [2, 0]] };
  assert.equal(analyse(ring.atoms, ring.bonds).error, "ring");
  const star = { atoms: [[1, 1], [0, 0], [1, 0], [2, 0], [0, 1], [2, 1]], bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] };
  assert.equal(analyse(star.atoms, star.bonds).error, "valence");
  assert.deepEqual(analyse(star.atoms, star.bonds).over, [0]);
  assert.equal(analyse([[0, 0], [3, 3]], []).error, "disconnected");
  assert.equal(analyse([], []).error, "empty");
});

test("edits: at most 7 carbons, bonds only between touching cells, removal reindexes bonds", () => {
  const s = { ...initialState(), atoms: [], bonds: [] };
  for (let x = 0; x < 8; x++) addCarbon(s, x, 0);
  assert.equal(s.atoms.length, 7);
  assert.equal(addCarbon(s, 0, 0), -1);
  assert.equal(addBond(s, 0, 2), false);
  assert.equal(addBond(s, 0, 1), true);
  assert.equal(addBond(s, 1, 0), false);
  addBond(s, 1, 2);
  removeCarbon(s, 0);
  assert.deepEqual(s.bonds, [[0, 1]]);
});

test("sanitize drops forged skeletons", () => {
  const base = initialState();
  assert.deepEqual(sanitize({ atoms: [[0, 0], [0, 0]] }, base), {});
  assert.deepEqual(sanitize({ atoms: [[0, 0], [5, 0]], bonds: [[0, 1], [0, 9]] }, base), { atoms: [[0, 0], [5, 0]], bonds: [] });
  assert.deepEqual(sanitize({ target: 99, found: [1, 1, 50, -2] }, base), { target: 7, found: [1] });
});
