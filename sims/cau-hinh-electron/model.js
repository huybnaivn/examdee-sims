// Electron configurations and orbital diagrams for Z = 1…36.
// Subshells are listed in Klechkowski (n + l) order, which is the filling order up to 4p.

export const MAX_Z = 36;
export const SUBSHELLS = [
  { n: 1, l: 0 },
  { n: 2, l: 0 },
  { n: 2, l: 1 },
  { n: 3, l: 0 },
  { n: 3, l: 1 },
  { n: 4, l: 0 },
  { n: 3, l: 2 },
  { n: 4, l: 1 },
];
const LETTERS = "spd";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const I4S = 5; // index of 4s in SUBSHELLS
const I3D = 6;

export const subName = sub => `${sub.n}${LETTERS[sub.l]}`;
export const boxesIn = sub => 2 * sub.l + 1;
/** Index of the first box of each subshell in the flat list of 18 boxes. */
export const FIRST_BOX = SUBSHELLS.map((_, i) => SUBSHELLS.slice(0, i).reduce((n, sub) => n + boxesIn(sub), 0));
export const BOX_COUNT = SUBSHELLS.reduce((n, sub) => n + boxesIn(sub), 0); // 18

// Symbol and name as used in the 2018 Vietnamese programme.
export const ELEMENTS = [
  ["H", "hydrogen"], ["He", "helium"], ["Li", "lithium"], ["Be", "beryllium"], ["B", "boron"], ["C", "carbon"],
  ["N", "nitrogen"], ["O", "oxygen"], ["F", "fluorine"], ["Ne", "neon"], ["Na", "sodium"], ["Mg", "magnesium"],
  ["Al", "aluminium"], ["Si", "silicon"], ["P", "phosphorus"], ["S", "sulfur"], ["Cl", "chlorine"], ["Ar", "argon"],
  ["K", "potassium"], ["Ca", "calcium"], ["Sc", "scandium"], ["Ti", "titanium"], ["V", "vanadium"], ["Cr", "chromium"],
  ["Mn", "manganese"], ["Fe", "iron"], ["Co", "cobalt"], ["Ni", "nickel"], ["Cu", "copper"], ["Zn", "zinc"],
  ["Ga", "gallium"], ["Ge", "germanium"], ["As", "arsenic"], ["Se", "selenium"], ["Br", "bromine"], ["Kr", "krypton"],
];

// One 4s electron moves to 3d: half-filled 3d⁵ (Cr) and filled 3d¹⁰ (Cu) are more stable.
export const EXCEPTIONS = { 24: "3d⁵ bán bão hoà bền hơn 3d⁴ 4s²", 29: "3d¹⁰ bão hoà bền hơn 3d⁹ 4s²" };

export const clampZ = z => Math.min(MAX_Z, Math.max(1, Math.round(Number(z)) || 1));

export const initialState = () => ({
  z: 26,
  mode: "view", // "view" | "practice"
  fill: "-".repeat(2 * BOX_COUNT), // the learner's diagram: two slots per box, each "-", "u" or "d"
  cursor: 1, // box chosen for the keyboard buttons, 1…18
  checked: false, // the learner pressed "Kiểm tra" on the current diagram
});

/** Electrons in each subshell, in SUBSHELLS order. `ideal` ignores the Cr and Cu exceptions. */
export function configuration(z, ideal = false) {
  let left = clampZ(z);
  const e = SUBSHELLS.map(sub => {
    const k = Math.min(left, 2 * boxesIn(sub));
    left -= k;
    return k;
  });
  if (!ideal && EXCEPTIONS[clampZ(z)]) {
    e[I4S] -= 1;
    e[I3D] += 1;
  }
  return e;
}

/** Configuration written by shell (3d before 4s), e.g. "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ 4s²". `core` electrons are skipped. */
export function configString(z, core = 0) {
  const coreE = configuration(core || 1).map(k => (core ? k : 0));
  const e = configuration(z);
  return SUBSHELLS.map((sub, i) => ({ sub, k: e[i], skip: coreE[i] === e[i] && coreE[i] > 0 }))
    .filter(x => x.k > 0 && !x.skip)
    .sort((a, b) => a.sub.n - b.sub.n || a.sub.l - b.sub.l)
    .map(x => subName(x.sub) + String(x.k).split("").map(d => SUP[d]).join(""))
    .join(" ");
}

/** Noble-gas shorthand, e.g. "[Ar] 3d⁶ 4s²". */
export function shortString(z) {
  z = clampZ(z);
  const core = [18, 10, 2].find(c => z > c);
  return core ? `[${ELEMENTS[core - 1][0]}] ${configString(z, core)}` : configString(z);
}

/** Unpaired electrons: a subshell with b boxes and k electrons has k (k ≤ b) or 2b − k unpaired (Hund). */
export const unpaired = z =>
  configuration(z).reduce((sum, k, i) => sum + (k <= boxesIn(SUBSHELLS[i]) ? k : 2 * boxesIn(SUBSHELLS[i]) - k), 0);

/** Block = the subshell that receives the last electron in the filling order. */
export function block(z) {
  const e = configuration(z, true);
  return LETTERS[SUBSHELLS[e.findLastIndex(k => k > 0)].l];
}
export const blockCode = z => LETTERS.indexOf(block(z)) + 1; // 1 = s, 2 = p, 3 = d

export const period = z => Math.max(...SUBSHELLS.filter((_, i) => configuration(z)[i] > 0).map(sub => sub.n));

/** Electrons of subshell (n, l). */
const count = (z, n, l) => configuration(z)[SUBSHELLS.findIndex(sub => sub.n === n && sub.l === l)] ?? 0;

/**
 * Valence electrons. s and p blocks: the outer shell. d block: (n−1)d + ns,
 * except when 3d is full (Cu, Zn), where only the 4s electrons are counted (groups IB, IIB).
 */
export function valence(z) {
  const n = period(z);
  if (block(z) !== "d") return count(z, n, 0) + count(z, n, 1);
  const d = count(z, n - 1, 2);
  return d < 10 ? d + count(z, n, 0) : count(z, n, 0);
}

/** Group: `number` in the 1…18 numbering, `label` in the A/B numbering used in Vietnamese textbooks. */
export function group(z) {
  const n = period(z);
  const b = block(z);
  if (clampZ(z) === 2) return { number: 18, label: "VIIIA" }; // helium: 1s², placed with the noble gases
  if (b === "s") return { number: count(z, n, 0), label: `${ROMAN[count(z, n, 0)]}A` };
  if (b === "p") return { number: 12 + count(z, n, 1), label: `${ROMAN[2 + count(z, n, 1)]}A` };
  const t = count(z, n - 1, 2) + count(z, n, 0); // 3…12
  return { number: t, label: `${t <= 7 ? ROMAN[t] : t <= 10 ? "VIII" : ROMAN[t - 10]}B` };
}

/** Indices of the subshells that hold the valence electrons. */
export function valenceSubshells(z) {
  const n = period(z);
  const dFull = count(z, n - 1, 2) === 10;
  return SUBSHELLS.map((sub, i) => i).filter(i => {
    const sub = SUBSHELLS[i];
    if (!configuration(z)[i]) return false;
    return sub.n === n || (block(z) === "d" && sub.n === n - 1 && sub.l === 2 && !dFull);
  });
}

// ---------- orbital diagram ----------

/** A fill is 36 characters, two per box. Anything else (a forged state) reads as an empty diagram. */
export const cleanFill = fill => (typeof fill === "string" && /^[-ud]{36}$/.test(fill) ? fill : "-".repeat(2 * BOX_COUNT));
export const boxOf = (fill, box) => cleanFill(fill).slice(2 * box, 2 * box + 2);
const electronsIn = pair => pair.replaceAll("-", "").length;

/** The textbook diagram: one ↑ in every box of a subshell first (Hund), then the ↓ partners (Pauli). */
export function idealFill(z) {
  return configuration(z)
    .map((k, i) => {
      const b = boxesIn(SUBSHELLS[i]);
      return Array.from({ length: b }, (_, j) => (j < k ? "u" : "-") + (j < k - b ? "d" : "-")).join("");
    })
    .join("");
}

const setSlot = (fill, index, ch) => cleanFill(fill).slice(0, index) + ch + cleanFill(fill).slice(index + 1);
/** A click on one half of a box: empty → ↑ → ↓ → empty. */
export const cycleSlot = (fill, box, slot) => setSlot(fill, 2 * box + slot, { "-": "u", u: "d", d: "-" }[cleanFill(fill)[2 * box + slot]]);
/** Put an arrow in the first free slot of a box (no change when the box already holds two). */
export function addArrow(fill, box, ch) {
  const slot = boxOf(fill, box).indexOf("-");
  return slot < 0 ? cleanFill(fill) : setSlot(fill, 2 * box + slot, ch);
}
export const clearBox = (fill, box) => setSlot(setSlot(fill, 2 * box, "-"), 2 * box + 1, "-");

/**
 * Check a learner's diagram for element Z. Errors (each listed once):
 *  "count" – the number of electrons is not Z
 *  "pauli" – a box holds two electrons with the same spin
 *  "hund"  – a subshell has a pair while another of its boxes is empty, or its single electrons are not parallel
 *  "order" – right number of electrons, but not in the subshells of the ground-state configuration
 */
export function checkFilling(z, fill) {
  const errors = [];
  const want = configuration(z);
  const got = [];
  let pauli = false;
  let hund = false;
  SUBSHELLS.forEach((sub, i) => {
    const boxes = Array.from({ length: boxesIn(sub) }, (_, j) => boxOf(fill, FIRST_BOX[i] + j));
    got.push(boxes.reduce((n, pair) => n + electronsIn(pair), 0));
    if (boxes.some(pair => pair === "uu" || pair === "dd")) pauli = true;
    const singles = boxes.filter(pair => electronsIn(pair) === 1).map(pair => pair.replace("-", ""));
    const hasPair = boxes.some(pair => electronsIn(pair) === 2);
    const hasEmpty = boxes.some(pair => electronsIn(pair) === 0);
    if ((hasPair && hasEmpty) || new Set(singles).size > 1) hund = true;
  });
  const total = got.reduce((a, b) => a + b, 0);
  if (total !== clampZ(z)) errors.push("count");
  if (pauli) errors.push("pauli");
  if (hund) errors.push("hund");
  if (total === clampZ(z) && got.some((k, i) => k !== want[i])) errors.push("order");
  return { ok: errors.length === 0, errors, electrons: total };
}
