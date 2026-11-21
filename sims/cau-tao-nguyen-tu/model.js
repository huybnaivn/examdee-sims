// Build an atom or ion from protons, neutrons and electrons, up to Z = 20.
// Element names follow the 2018 Vietnamese programme (IUPAC English names).

// [symbol, name, mass numbers of the stable isotopes]
export const ELEMENTS = [
  ["H", "Hydrogen", [1, 2]],
  ["He", "Helium", [3, 4]],
  ["Li", "Lithium", [6, 7]],
  ["Be", "Beryllium", [9]],
  ["B", "Boron", [10, 11]],
  ["C", "Carbon", [12, 13]],
  ["N", "Nitrogen", [14, 15]],
  ["O", "Oxygen", [16, 17, 18]],
  ["F", "Fluorine", [19]],
  ["Ne", "Neon", [20, 21, 22]],
  ["Na", "Sodium", [23]],
  ["Mg", "Magnesium", [24, 25, 26]],
  ["Al", "Aluminium", [27]],
  ["Si", "Silicon", [28, 29, 30]],
  ["P", "Phosphorus", [31]],
  ["S", "Sulfur", [32, 33, 34, 36]],
  ["Cl", "Chlorine", [35, 37]],
  ["Ar", "Argon", [36, 38, 40]],
  ["K", "Potassium", [39, 41]], // ⁴⁰K is radioactive
  ["Ca", "Calcium", [40, 42, 43, 44, 46]], // ⁴⁸Ca decays, extremely slowly
].map(([symbol, name, stable], i) => ({ z: i + 1, symbol, name, stable }));

export const MAX_Z = 20;
export const MAX_N = 28;
export const SHELL_CAPACITY = [2, 8, 8, 2]; // filling order used at school for Z ≤ 20

// Challenge targets: build exactly this many protons, neutrons and electrons.
export const TARGETS = [
  { id: "na-23-cation", label: "ion ²³Na⁺", z: 11, n: 12, e: 10 },
  { id: "c-12", label: "nguyên tử ¹²C", z: 6, n: 6, e: 6 },
  { id: "o-16-anion", label: "ion ¹⁶O²⁻", z: 8, n: 8, e: 10 },
  { id: "he-4", label: "nguyên tử ⁴He", z: 2, n: 2, e: 2 },
  { id: "mg-24-cation", label: "ion ²⁴Mg²⁺", z: 12, n: 12, e: 10 },
  { id: "cl-35-anion", label: "ion ³⁵Cl⁻", z: 17, n: 18, e: 18 },
  { id: "h-2", label: "nguyên tử ²H (deuterium)", z: 1, n: 1, e: 1 },
  { id: "al-27-cation", label: "ion ²⁷Al³⁺", z: 13, n: 14, e: 10 },
  { id: "c-14", label: "nguyên tử ¹⁴C (đồng vị phóng xạ)", z: 6, n: 8, e: 6 },
  { id: "ca-40-cation", label: "ion ⁴⁰Ca²⁺", z: 20, n: 20, e: 18 },
];

export const initialState = () => ({
  protons: 6,
  neutrons: 6,
  electrons: 6,
  challenge: false, // challenge mode on
  target: 0, // index into TARGETS
  solved: false, // the current target has been built
});

const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

export const elementByZ = z => ELEMENTS[z - 1] ?? null;
export const massNumber = (z, n) => z + n; // A = Z + N
export const netCharge = (z, e) => z - e; // in units of e
export const isStable = (z, n) => !!elementByZ(z)?.stable.includes(z + n);

/** Electrons per shell, innermost first, e.g. 11 → [2, 8, 1]. */
export function shells(electrons) {
  const out = [];
  let left = electrons;
  for (const cap of SHELL_CAPACITY) {
    if (left <= 0) break;
    out.push(Math.min(cap, left));
    left -= cap;
  }
  return out;
}

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const sup = n => String(n).replace(/\d/g, d => SUP[d]);

/** Charge as written on an ion: "" for 0, "+", "2+", "3−". */
export const chargeText = q => (q === 0 ? "" : `${Math.abs(q) > 1 ? Math.abs(q) : ""}${q > 0 ? "+" : "−"}`);

/** "Na", "Na⁺", "O²⁻". */
export const speciesSymbol = (symbol, q) =>
  q === 0 ? symbol : `${symbol}${Math.abs(q) > 1 ? sup(Math.abs(q)) : ""}${q > 0 ? "⁺" : "⁻"}`;

/** "atom" (neutral), "cation" (positive ion) or "anion" (negative ion). */
export const speciesKind = q => (q === 0 ? "atom" : q > 0 ? "cation" : "anion");

/** Everything the screen shows about the particle that has been built. */
export function describe(s) {
  const z = int(s.protons, 1, MAX_Z);
  const n = int(s.neutrons, 0, MAX_N);
  const e = int(s.electrons, 0, MAX_Z);
  const el = elementByZ(z);
  const charge = netCharge(z, e);
  const kind = speciesKind(charge);
  const species = speciesSymbol(el.symbol, charge);
  return {
    z,
    n,
    e,
    a: massNumber(z, n),
    symbol: el.symbol,
    name: el.name,
    charge,
    kind,
    species,
    kindLabel: kind === "atom" ? `Nguyên tử ${el.name.toLowerCase()}` : `${kind === "cation" ? "Cation" : "Anion"} ${species}`,
    shells: shells(e),
    stable: isStable(z, n),
  };
}

export const currentTarget = s => TARGETS[Math.abs(Math.round(Number(s.target) || 0)) % TARGETS.length];

export const matchesTarget = (s, t = currentTarget(s)) => {
  const d = describe(s);
  return d.z === t.z && d.n === t.n && d.e === t.e;
};

/**
 * Call after any change. Returns the target id when the current challenge has just been solved
 * (once per target), otherwise null.
 */
export function checkTarget(s) {
  if (!s.challenge || s.solved || !matchesTarget(s)) return null;
  s.solved = true;
  return currentTarget(s).id;
}

export function nextTarget(s) {
  s.target = (Math.abs(Math.round(Number(s.target) || 0)) + 1) % TARGETS.length;
  s.solved = false;
  return s;
}
