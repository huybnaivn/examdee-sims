// Periodic trends for Z = 1…36. Names follow the 2018 Vietnamese programme (IUPAC English names).
// Groups are written the Vietnamese-textbook way (IA…VIIIA, IB…VIIIB) with the 1–18 column alongside.

// [symbol, name, calculated atomic radius (pm), Pauling electronegativity, first ionisation energy (kJ/mol)]
// Radii are calculated (computed) radii, so every element including the noble gases is on one scale.
// Noble gases have no electronegativity in the school table (null).
const DATA = [
  ["H", "Hydrogen", 53, 2.2, 1312],
  ["He", "Helium", 31, null, 2372],
  ["Li", "Lithium", 167, 0.98, 520],
  ["Be", "Beryllium", 112, 1.57, 900],
  ["B", "Boron", 87, 2.04, 801],
  ["C", "Carbon", 67, 2.55, 1086],
  ["N", "Nitrogen", 56, 3.04, 1402],
  ["O", "Oxygen", 48, 3.44, 1314],
  ["F", "Fluorine", 42, 3.98, 1681],
  ["Ne", "Neon", 38, null, 2081],
  ["Na", "Sodium", 190, 0.93, 496],
  ["Mg", "Magnesium", 145, 1.31, 738],
  ["Al", "Aluminium", 118, 1.61, 578],
  ["Si", "Silicon", 111, 1.9, 787],
  ["P", "Phosphorus", 98, 2.19, 1012],
  ["S", "Sulfur", 88, 2.58, 1000],
  ["Cl", "Chlorine", 79, 3.16, 1251],
  ["Ar", "Argon", 71, null, 1521],
  ["K", "Potassium", 243, 0.82, 419],
  ["Ca", "Calcium", 194, 1.0, 590],
  ["Sc", "Scandium", 184, 1.36, 633],
  ["Ti", "Titanium", 176, 1.54, 659],
  ["V", "Vanadium", 171, 1.63, 651],
  ["Cr", "Chromium", 166, 1.66, 653],
  ["Mn", "Manganese", 161, 1.55, 717],
  ["Fe", "Iron", 156, 1.83, 763],
  ["Co", "Cobalt", 152, 1.88, 760],
  ["Ni", "Nickel", 149, 1.91, 737],
  ["Cu", "Copper", 145, 1.9, 746],
  ["Zn", "Zinc", 142, 1.65, 906],
  ["Ga", "Gallium", 136, 1.81, 579],
  ["Ge", "Germanium", 125, 2.01, 762],
  ["As", "Arsenic", 114, 2.18, 947],
  ["Se", "Selenium", 103, 2.55, 941],
  ["Br", "Bromine", 94, 2.96, 1140],
  ["Kr", "Krypton", 88, null, 1351],
];

export const MAX_Z = DATA.length;

// Metalloids are shown as their own class; everything else is metal, non-metal or noble gas.
const METALLOIDS = ["B", "Si", "Ge", "As"];
const NONMETALS = ["H", "C", "N", "O", "F", "P", "S", "Cl", "Se", "Br"];
const NOBLE = ["He", "Ne", "Ar", "Kr"];
export const CATEGORIES = { metal: "kim loại", metalloid: "á kim", nonmetal: "phi kim", noble: "khí hiếm" };

export const PROPERTIES = [
  { id: "radius", label: "Bán kính nguyên tử", short: "r", unit: "pm", digits: 0 },
  { id: "en", label: "Độ âm điện (Pauling)", short: "χ", unit: "", digits: 2 },
  { id: "ie", label: "Năng lượng ion hóa thứ nhất", short: "I₁", unit: "kJ/mol", digits: 0 },
  // No number measures metallic character directly: it is coloured by class and charted with χ
  // (the smaller χ, the stronger the metallic character).
  { id: "metal", label: "Tính kim loại", short: "χ", unit: "", digits: 2 },
];

// Filling order (Klechkowski) up to 4p, which is enough for Z ≤ 36.
const ORDER = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p"];
const CAP = { s: 2, p: 6, d: 10 };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const sup = n => String(n).replace(/\d/g, d => SUP[d]);

/** Subshells in filling order as [name, electrons]; Cr and Cu take one 4s electron into 3d. */
export function filling(z) {
  const out = [];
  let left = z;
  for (const sub of ORDER) {
    if (!left) break;
    const n = Math.min(CAP[sub[1]], left);
    out.push([sub, n]);
    left -= n;
  }
  if (z === 24 || z === 29) {
    out.find(([s]) => s === "4s")[1] = 1;
    out.find(([s]) => s === "3d")[1] += 1;
  }
  return out;
}

/** Subshells in the order they are written (by shell, then s, p, d). */
export const written = z =>
  filling(z).sort(([a], [b]) => a[0] - b[0] || "spd".indexOf(a[1]) - "spd".indexOf(b[1]));

const text = subs => subs.map(([s, n]) => s + sup(n)).join("");

/** Full configuration, e.g. Fe → 1s²2s²2p⁶3s²3p⁶3d⁶4s². */
export const configuration = z => text(written(z));

/** Noble-gas shorthand, e.g. Fe → [Ar]3d⁶4s². */
export function shortConfiguration(z) {
  const core = [[18, "Ar"], [10, "Ne"], [2, "He"]].find(([cz]) => z > cz);
  if (!core) return configuration(z);
  const coreSubs = new Set(written(core[0]).map(([s]) => s));
  return `[${core[1]}]` + text(written(z).filter(([s, n]) => !coreSubs.has(s) || n !== CAP[s[1]]));
}

export const period = z => Math.max(...filling(z).map(([s]) => Number(s[0])));

/** Position in the table: { group "IIA", type "A" | "B", column 1–18, block "s" | "p" | "d" }. */
export function position(z) {
  const p = period(z);
  const subs = filling(z);
  const outer = subs.filter(([s]) => Number(s[0]) === p).reduce((a, [, n]) => a + n, 0);
  const d = subs.find(([s]) => s === "3d")?.[1] ?? 0;
  if (z >= 21 && z <= 30) {
    const v = d + outer; // (n−1)d + ns electrons
    const column = v;
    const group = v <= 7 ? `${ROMAN[v - 1]}B` : v <= 10 ? "VIIIB" : `${ROMAN[v - 11]}B`;
    return { group, type: "B", number: v <= 10 ? Math.min(v, 8) : v - 10, column, block: "d" };
  }
  if (z === 2) return { group: "VIIIA", type: "A", number: 8, column: 18, block: "s" };
  const column = outer <= 2 ? outer : outer + 10;
  return { group: `${ROMAN[outer - 1]}A`, type: "A", number: outer, column, block: outer <= 2 ? "s" : "p" };
}

export const ELEMENTS = DATA.map(([symbol, name, radius, en, ie], i) => {
  const z = i + 1;
  const category = NOBLE.includes(symbol) ? "noble" : METALLOIDS.includes(symbol) ? "metalloid" : NONMETALS.includes(symbol) ? "nonmetal" : "metal";
  return { z, symbol, name, radius, en, ie, category, period: period(z), ...position(z) };
});

export const element = z => ELEMENTS[Math.min(MAX_Z, Math.max(1, Math.round(Number(z) || 1))) - 1];

/** The number charted for a property (null where it is not defined). */
export const value = (el, prop) => (prop === "radius" ? el.radius : prop === "ie" ? el.ie : el.en);

// Lines that can be charted: the four periods and the eight A groups.
export const LINES = [
  ...[1, 2, 3, 4].map(p => ({ id: `p${p}`, label: `Chu kì ${p}`, period: p, group: 0 })),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(g => ({ id: `g${g}`, label: `Nhóm ${ROMAN[g - 1]}A`, period: 0, group: g })),
];
export const line = id => LINES.find(l => l.id === id) ?? LINES[2];

/** Elements of a line: a period left to right, or an A group top to bottom. */
export const lineElements = id => {
  const l = line(id);
  return l.period
    ? ELEMENTS.filter(e => e.period === l.period).sort((a, b) => a.column - b.column)
    : ELEMENTS.filter(e => e.type === "A" && e.number === l.group);
};

/** First and last defined value of a property along a line, for the result event. */
export function lineSummary(prop, id) {
  const values = lineElements(id).map(e => value(e, prop)).filter(v => v != null);
  return { first: values[0] ?? 0, last: values.at(-1) ?? 0, count: values.length };
}

export const range = prop => {
  const values = ELEMENTS.map(e => value(e, prop)).filter(v => v != null);
  return { min: Math.min(...values), max: Math.max(...values) };
};

export const initialState = () => ({
  prop: "radius", // property used for colouring: radius | en | ie | metal
  line: "p3", // charted line: p1…p4 (period) or g1…g8 (A group)
  z: 11, // selected element
});
