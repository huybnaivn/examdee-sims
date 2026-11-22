import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENTS, SUBSHELLS, BOX_COUNT, FIRST_BOX, configuration, configString, shortString, unpaired, block, blockCode,
  period, valence, group, idealFill, checkFilling, cycleSlot, addArrow, clearBox, cleanFill, boxOf, initialState, valenceSubshells,
} from "./model.js";

// Ground-state configurations, written by shell as in the grade 10 textbook.
const AR = "1s² 2s² 2p⁶ 3s² 3p⁶";
const TABLE = {
  H: "1s¹", He: "1s²", Li: "1s² 2s¹", Be: "1s² 2s²", B: "1s² 2s² 2p¹", C: "1s² 2s² 2p²", N: "1s² 2s² 2p³",
  O: "1s² 2s² 2p⁴", F: "1s² 2s² 2p⁵", Ne: "1s² 2s² 2p⁶", Na: "1s² 2s² 2p⁶ 3s¹", Mg: "1s² 2s² 2p⁶ 3s²",
  Al: "1s² 2s² 2p⁶ 3s² 3p¹", Si: "1s² 2s² 2p⁶ 3s² 3p²", P: "1s² 2s² 2p⁶ 3s² 3p³", S: "1s² 2s² 2p⁶ 3s² 3p⁴",
  Cl: "1s² 2s² 2p⁶ 3s² 3p⁵", Ar: AR, K: `${AR} 4s¹`, Ca: `${AR} 4s²`, Sc: `${AR} 3d¹ 4s²`, Ti: `${AR} 3d² 4s²`,
  V: `${AR} 3d³ 4s²`, Cr: `${AR} 3d⁵ 4s¹`, Mn: `${AR} 3d⁵ 4s²`, Fe: `${AR} 3d⁶ 4s²`, Co: `${AR} 3d⁷ 4s²`,
  Ni: `${AR} 3d⁸ 4s²`, Cu: `${AR} 3d¹⁰ 4s¹`, Zn: `${AR} 3d¹⁰ 4s²`, Ga: `${AR} 3d¹⁰ 4s² 4p¹`, Ge: `${AR} 3d¹⁰ 4s² 4p²`,
  As: `${AR} 3d¹⁰ 4s² 4p³`, Se: `${AR} 3d¹⁰ 4s² 4p⁴`, Br: `${AR} 3d¹⁰ 4s² 4p⁵`, Kr: `${AR} 3d¹⁰ 4s² 4p⁶`,
};
const Z = sym => ELEMENTS.findIndex(e => e[0] === sym) + 1;

test("configurations of all 36 elements, including Cr and Cu", () => {
  assert.equal(ELEMENTS.length, 36);
  assert.equal(Object.keys(TABLE).length, 36);
  ELEMENTS.forEach(([sym], i) => {
    assert.equal(configString(i + 1), TABLE[sym], sym);
    assert.equal(configuration(i + 1).reduce((a, b) => a + b, 0), i + 1, `${sym} has Z electrons`);
  });
  assert.equal(shortString(Z("Cr")), "[Ar] 3d⁵ 4s¹");
  assert.equal(shortString(Z("Cu")), "[Ar] 3d¹⁰ 4s¹");
  assert.equal(shortString(Z("Na")), "[Ne] 3s¹");
  assert.equal(shortString(Z("Li")), "[He] 2s¹");
  assert.equal(shortString(Z("Ar")), "[Ne] 3s² 3p⁶");
  assert.equal(shortString(1), "1s¹");
});

test("subshells follow the n + l rule and hold 2(2l + 1) electrons", () => {
  for (let i = 1; i < SUBSHELLS.length; i++) {
    const a = SUBSHELLS[i - 1];
    const b = SUBSHELLS[i];
    assert.ok(a.n + a.l < b.n + b.l || (a.n + a.l === b.n + b.l && a.n < b.n));
  }
  assert.equal(BOX_COUNT, 18);
  assert.deepEqual(FIRST_BOX, [0, 1, 2, 5, 6, 9, 10, 15]);
  assert.deepEqual(configuration(36), [2, 2, 6, 2, 6, 2, 10, 6]);
});

test("unpaired electrons", () => {
  const want = { H: 1, He: 0, C: 2, N: 3, O: 2, F: 1, Ne: 0, P: 3, Sc: 1, V: 3, Cr: 6, Mn: 5, Fe: 4, Co: 3, Ni: 2, Cu: 1, Zn: 0, As: 3, Kr: 0 };
  for (const [sym, n] of Object.entries(want)) assert.equal(unpaired(Z(sym)), n, sym);
  // the drawn diagram shows the same number of single arrows
  for (let z = 1; z <= 36; z++) {
    const fill = idealFill(z);
    let singles = 0;
    for (let b = 0; b < BOX_COUNT; b++) if (boxOf(fill, b) === "u-") singles++;
    assert.equal(singles, unpaired(z), `Z = ${z}`);
  }
});

test("block, period, group and valence electrons from the configuration", () => {
  const want = {
    H: ["s", 1, "IA", 1, 1], He: ["s", 1, "VIIIA", 18, 2], Na: ["s", 3, "IA", 1, 1], Mg: ["s", 3, "IIA", 2, 2],
    C: ["p", 2, "IVA", 14, 4], N: ["p", 2, "VA", 15, 5], Cl: ["p", 3, "VIIA", 17, 7], Ar: ["p", 3, "VIIIA", 18, 8],
    Ca: ["s", 4, "IIA", 2, 2], Sc: ["d", 4, "IIIB", 3, 3], Cr: ["d", 4, "VIB", 6, 6], Mn: ["d", 4, "VIIB", 7, 7],
    Fe: ["d", 4, "VIIIB", 8, 8], Co: ["d", 4, "VIIIB", 9, 9], Ni: ["d", 4, "VIIIB", 10, 10], Cu: ["d", 4, "IB", 11, 1],
    Zn: ["d", 4, "IIB", 12, 2], Ga: ["p", 4, "IIIA", 13, 3], Br: ["p", 4, "VIIA", 17, 7], Kr: ["p", 4, "VIIIA", 18, 8],
  };
  for (const [sym, [b, p, label, number, v]] of Object.entries(want)) {
    const z = Z(sym);
    assert.equal(block(z), b, `${sym} block`);
    assert.equal(period(z), p, `${sym} period`);
    assert.deepEqual(group(z), { number, label }, `${sym} group`);
    assert.equal(valence(z), v, `${sym} valence`);
  }
  assert.deepEqual([1, 5, 21].map(blockCode), [1, 2, 3]);
  // block counts in the first four periods: 2 + 2 + 2 + 2 s, 6 × 3 p, 10 d
  const blocks = ELEMENTS.map((_, i) => block(i + 1)).join("");
  assert.equal(blocks.replaceAll(/[^s]/g, "").length, 8);
  assert.equal(blocks.replaceAll(/[^p]/g, "").length, 18);
  assert.equal(blocks.replaceAll(/[^d]/g, "").length, 10);
  assert.deepEqual(valenceSubshells(Z("Fe")).map(i => SUBSHELLS[i].n * 10 + SUBSHELLS[i].l), [40, 32]);
  assert.deepEqual(valenceSubshells(Z("Cu")).map(i => SUBSHELLS[i].n * 10 + SUBSHELLS[i].l), [40]);
});

test("the textbook diagram passes the check for every element", () => {
  for (let z = 1; z <= 36; z++) assert.deepEqual(checkFilling(z, idealFill(z)), { ok: true, errors: [], electrons: z }, `Z = ${z}`);
  // all single electrons pointing down, or a pair drawn ↓↑, is the same physical state
  assert.ok(checkFilling(7, "ududd-d-d-" + "-".repeat(26)).ok);
  assert.ok(checkFilling(2, "du" + "-".repeat(34)).ok);
});

const pad = s => s + "-".repeat(36 - s.length);

test("Pauli: two electrons with the same spin in one box are rejected", () => {
  assert.deepEqual(checkFilling(2, pad("uu")).errors, ["pauli"]);
  assert.deepEqual(checkFilling(2, pad("dd")).errors, ["pauli"]);
  assert.ok(checkFilling(4, pad("uduu")).errors.includes("pauli"));
});

test("Hund: pairing before every box has one electron, or antiparallel singles, is rejected", () => {
  // carbon 2p²: paired in one box
  assert.deepEqual(checkFilling(6, pad("udud" + "ud----")).errors, ["hund"]);
  // nitrogen 2p³: one single electron flipped
  assert.deepEqual(checkFilling(7, pad("udud" + "u-d-u-")).errors, ["hund"]);
  // oxygen 2p⁴: two pairs and an empty box
  assert.deepEqual(checkFilling(8, pad("udud" + "udud--")).errors, ["hund"]);
  // correct oxygen
  assert.ok(checkFilling(8, pad("udud" + "udu-u-")).ok);
  // iron 3d⁶ as three pairs
  const fe = idealFill(26);
  const bad = fe.slice(0, 20) + "ududud----" + fe.slice(30);
  assert.deepEqual(checkFilling(26, bad).errors, ["hund"]);
});

test("electron count and filling order are checked, with the Cr and Cu exceptions", () => {
  assert.deepEqual(checkFilling(3, pad("ud")).errors, ["count"]);
  assert.equal(checkFilling(3, pad("ud")).electrons, 2);
  // lithium with the third electron in 2p instead of 2s
  assert.deepEqual(checkFilling(3, pad("ud" + "--" + "u-")).errors, ["order"]);
  // potassium: 4s before 3d
  const ar = idealFill(18).slice(0, 18);
  assert.ok(checkFilling(19, pad(ar + "u-")).ok);
  assert.deepEqual(checkFilling(19, pad(ar + "--" + "u-")).errors, ["order"]);
  // chromium: 3d⁴ 4s² is not the ground state, 3d⁵ 4s¹ is
  assert.deepEqual(checkFilling(24, pad(ar + "ud" + "u-u-u-u---")).errors, ["order"]);
  assert.ok(checkFilling(24, pad(ar + "u-" + "u-u-u-u-u-")).ok);
  // copper: 3d⁹ 4s² rejected, 3d¹⁰ 4s¹ accepted
  assert.deepEqual(checkFilling(29, pad(ar + "ud" + "ududududu-")).errors, ["order"]);
  assert.ok(checkFilling(29, pad(ar + "u-" + "ududududud")).ok);
});

test("editing helpers and forged fills", () => {
  const empty = initialState().fill;
  assert.equal(empty.length, 36);
  assert.equal(cycleSlot(empty, 0, 0).slice(0, 2), "u-");
  assert.equal(cycleSlot(cycleSlot(empty, 0, 1), 0, 1).slice(0, 2), "-d");
  assert.equal(cycleSlot(cycleSlot(cycleSlot(empty, 3, 0), 3, 0), 3, 0), empty);
  assert.equal(addArrow(addArrow(empty, 1, "u"), 1, "d").slice(2, 4), "ud");
  assert.equal(addArrow(pad("ud"), 0, "u"), pad("ud")); // full box: unchanged
  assert.equal(clearBox(pad("ud"), 0), empty);
  for (const forged of [null, 5, "", "x".repeat(36), "u".repeat(35), {}]) {
    assert.equal(cleanFill(forged), empty);
    assert.equal(checkFilling(1, forged).ok, false);
  }
  assert.equal(configString(-5), "1s¹");
  assert.equal(configString(1e9), TABLE.Kr);
});
