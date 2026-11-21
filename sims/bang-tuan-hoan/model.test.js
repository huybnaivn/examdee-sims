import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENTS, element, filling, configuration, shortConfiguration, period, position, lineElements, lineSummary, value } from "./model.js";

test("data table lookups", () => {
  assert.equal(ELEMENTS.length, 36);
  assert.deepEqual([element(26).symbol, element(26).en, element(26).ie, element(26).radius], ["Fe", 1.83, 763, 156]);
  assert.equal(element(11).ie, 496);
  assert.equal(element(17).radius, 79);
  assert.equal(element(9).en, 3.98);
  assert.equal(element(36).en, null);
  assert.equal(element(99).symbol, "Kr"); // clamped
  assert.equal(element(0).symbol, "H");
});

test("electron configuration follows the filling order", () => {
  for (const e of ELEMENTS) assert.equal(filling(e.z).reduce((a, [, n]) => a + n, 0), e.z);
  assert.equal(configuration(1), "1s¹");
  assert.equal(configuration(11), "1s²2s²2p⁶3s¹");
  assert.equal(configuration(19), "1s²2s²2p⁶3s²3p⁶4s¹");
  assert.equal(configuration(21), "1s²2s²2p⁶3s²3p⁶3d¹4s²"); // 4s fills before 3d, written by shell
  assert.equal(configuration(26), "1s²2s²2p⁶3s²3p⁶3d⁶4s²");
  assert.equal(configuration(35), "1s²2s²2p⁶3s²3p⁶3d¹⁰4s²4p⁵");
  assert.deepEqual(filling(26).map(([s]) => s), ["1s", "2s", "2p", "3s", "3p", "4s", "3d"]);
  assert.equal(shortConfiguration(26), "[Ar]3d⁶4s²");
  assert.equal(shortConfiguration(31), "[Ar]3d¹⁰4s²4p¹");
  assert.equal(shortConfiguration(3), "[He]2s¹");
});

test("Cr and Cu are exceptions: half-filled and filled 3d", () => {
  assert.equal(configuration(24), "1s²2s²2p⁶3s²3p⁶3d⁵4s¹");
  assert.equal(configuration(29), "1s²2s²2p⁶3s²3p⁶3d¹⁰4s¹");
  assert.equal(shortConfiguration(24), "[Ar]3d⁵4s¹");
  assert.equal(shortConfiguration(29), "[Ar]3d¹⁰4s¹");
  assert.equal(configuration(25), "1s²2s²2p⁶3s²3p⁶3d⁵4s²");
  assert.equal(configuration(30), "1s²2s²2p⁶3s²3p⁶3d¹⁰4s²");
});

test("period and group from Z", () => {
  const where = z => [period(z), position(z).group, position(z).column];
  assert.deepEqual(where(1), [1, "IA", 1]);
  assert.deepEqual(where(2), [1, "VIIIA", 18]);
  assert.deepEqual(where(8), [2, "VIA", 16]);
  assert.deepEqual(where(13), [3, "IIIA", 13]);
  assert.deepEqual(where(19), [4, "IA", 1]);
  assert.deepEqual(where(21), [4, "IIIB", 3]);
  assert.deepEqual(where(24), [4, "VIB", 6]);
  assert.deepEqual(where(26), [4, "VIIIB", 8]);
  assert.deepEqual(where(28), [4, "VIIIB", 10]);
  assert.deepEqual(where(29), [4, "IB", 11]);
  assert.deepEqual(where(30), [4, "IIB", 12]);
  assert.deepEqual(where(31), [4, "IIIA", 13]);
  assert.deepEqual(where(36), [4, "VIIIA", 18]);
  // every cell of the 4-row grid is used once
  assert.equal(new Set(ELEMENTS.map(e => `${e.period}-${e.column}`)).size, 36);
});

const mainGroupRow = p => ELEMENTS.filter(e => e.period === p && e.type === "A" && e.category !== "noble");
const decreasing = xs => xs.every((x, i) => i === 0 || x < xs[i - 1]);
const increasing = xs => xs.every((x, i) => i === 0 || x > xs[i - 1]);

test("radius decreases across a period and increases down a group (main groups)", () => {
  for (const p of [2, 3, 4]) assert.ok(decreasing(mainGroupRow(p).map(e => e.radius)), `period ${p}`);
  for (let g = 1; g <= 8; g++) assert.ok(increasing(lineElements(`g${g}`).map(e => e.radius)), `group ${g}`);
});

test("electronegativity increases across a period and decreases down a group (main groups)", () => {
  for (const p of [2, 3, 4]) assert.ok(increasing(mainGroupRow(p).map(e => e.en)), `period ${p}`);
  for (const g of [1, 2, 5, 6, 7]) { // IA, IIA, VA, VIA, VIIA
    const els = lineElements(`g${g}`).filter(e => e.symbol !== "H"); // H stands apart from the alkali metals
    assert.ok(decreasing(els.map(e => e.en)), `group ${g}`);
  }
  // Known exceptions in the data, from the filled 3d shell: Ga > Al and Ge > Si.
  assert.ok(element(31).en > element(13).en && element(32).en > element(14).en);
  // but the top of each group is still the most electronegative
  for (const g of [3, 4]) assert.equal(lineSummary("en", `g${g}`).first, Math.max(...lineElements(`g${g}`).map(e => e.en)));
});

test("first ionisation energy: lower down a group, higher at the end of a period", () => {
  for (const g of [1, 2, 4, 5, 6, 7, 8]) {
    const els = lineElements(`g${g}`).filter(e => e.symbol !== "H");
    assert.ok(decreasing(els.map(e => e.ie)), `group ${g}`);
  }
  for (const p of [2, 3, 4]) {
    const row = lineElements(`p${p}`);
    assert.equal(Math.max(...row.map(e => e.ie)), row.at(-1).ie); // noble gas highest
    assert.equal(Math.min(...row.map(e => e.ie)), row[0].ie); // alkali metal lowest
  }
  // the textbook exceptions are in the data: Be > B, N > O, Mg > Al, P > S
  assert.ok(element(4).ie > element(5).ie && element(7).ie > element(8).ie);
  assert.ok(element(12).ie > element(13).ie && element(15).ie > element(16).ie);
});

test("line summary skips undefined values", () => {
  assert.deepEqual(lineSummary("en", "p2"), { first: 0.98, last: 3.98, count: 7 });
  assert.deepEqual(lineSummary("radius", "g1"), { first: 53, last: 243, count: 4 });
  assert.equal(value(element(26), "metal"), 1.83);
  assert.equal(lineElements("p4").length, 18);
});
