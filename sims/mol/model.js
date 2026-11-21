// Mol and the quantities tied to it (KHTN 8 / Hóa học 10, chương trình 2018).
// m = n·M, N = n·N_A, and for a gas at standard conditions (điều kiện chuẩn, 25 °C and 1 bar) V = n·24,79 L.
// Atomic masses are the rounded school values used in Vietnamese textbooks (Cl = 35,5).

export const NA = 6.022e23; // mol⁻¹, Avogadro constant as printed in the textbooks
export const VM = 24.79; // L/mol, molar volume of a gas at 25 °C and 1 bar

export const ATOMIC_MASS = { H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, S: 32, Cl: 35.5, Ca: 40, Fe: 56 };

// gas: a gas at 25 °C and 1 bar. particle: what one "hạt" of the substance is.
export const SUBSTANCES = [
  { id: "H2O", name: "Nước", gas: false, particle: "phân tử" },
  { id: "CO2", name: "Carbon dioxide", gas: true, particle: "phân tử" },
  { id: "NaCl", name: "Sodium chloride", gas: false, particle: "đơn vị NaCl" },
  { id: "O2", name: "Oxygen", gas: true, particle: "phân tử" },
  { id: "Fe", name: "Sắt", gas: false, particle: "nguyên tử" },
  { id: "C12H22O11", name: "Saccharose", gas: false, particle: "phân tử" },
  { id: "N2", name: "Nitrogen", gas: true, particle: "phân tử" },
  { id: "H2", name: "Hydrogen", gas: true, particle: "phân tử" },
  { id: "CH4", name: "Methane", gas: true, particle: "phân tử" },
  { id: "Ca(OH)2", name: "Calcium hydroxide", gas: false, particle: "đơn vị Ca(OH)₂" },
];

export const GIVEN = ["mass", "mol", "particles", "volume"];

// particles is kept in units of 10²³ so the slider has a sensible range.
export const initialState = () => ({ substance: "CO2", given: "mass", mass: 11, mol: 0.25, particles: 1.51, volume: 6.2 });

export const substanceById = id => SUBSTANCES.find(x => x.id === id) ?? SUBSTANCES[0];

const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const pretty = formula => formula.replace(/\d/g, d => SUB[d]);

/** "Ca(OH)2" -> { Ca: 1, O: 2, H: 2 }. Throws on anything that is not a formula. */
export function parseFormula(formula) {
  const stack = [{}];
  const add = (el, n) => {
    const top = stack[stack.length - 1];
    top[el] = (top[el] ?? 0) + n;
  };
  const token = /([A-Z][a-z]*)(\d*)|(\()|\)(\d*)/y;
  let m;
  let end = 0;
  while ((m = token.exec(formula))) {
    end = token.lastIndex;
    if (m[1]) add(m[1], Number(m[2] || 1));
    else if (m[3]) stack.push({});
    else {
      if (stack.length < 2) throw new Error(`Unbalanced ")" in ${formula}`);
      const group = stack.pop();
      if (!Object.keys(group).length) throw new Error(`Empty group in ${formula}`);
      for (const [el, n] of Object.entries(group)) add(el, n * Number(m[4] || 1));
    }
  }
  if (!formula || end !== formula.length || stack.length !== 1) throw new Error(`Bad formula: ${formula}`);
  return stack[0];
}

/** M in g/mol from the formula and the school atomic masses. */
export function molarMass(formula) {
  let M = 0;
  for (const [el, n] of Object.entries(parseFormula(formula))) {
    if (!(el in ATOMIC_MASS)) throw new Error(`No atomic mass for ${el}`);
    M += ATOMIC_MASS[el] * n;
  }
  return M;
}

/** Amount n (mol) from the one given quantity, or null when it cannot be done (a volume for a non-gas). */
export function molFrom(sub, given, value) {
  if (!Number.isFinite(value) || value < 0) return null;
  if (given === "mass") return value / molarMass(sub.id);
  if (given === "mol") return value;
  if (given === "particles") return value / NA; // value is a plain count here
  if (given === "volume") return sub.gas ? value / VM : null;
  return null;
}

/** All four quantities from n. volume is null for a substance that is not a gas at standard conditions. */
export const fromMol = (sub, n) => ({ mol: n, mass: n * molarMass(sub.id), particles: n * NA, volume: sub.gas ? n * VM : null });

/** Everything shown for a state: { sub, M, mol, mass, particles, volume } or { sub, M, error: "not-gas" }. */
export function convert(s) {
  const sub = substanceById(s.substance);
  const given = GIVEN.includes(s.given) ? s.given : "mass";
  const value = given === "particles" ? s.particles * 1e23 : s[given];
  const n = molFrom(sub, given, value);
  const M = molarMass(sub.id);
  if (n === null) return { sub, M, given, error: given === "volume" ? "not-gas" : "bad-value" };
  return { sub, M, given, ...fromMol(sub, n) };
}

/** [mantissa, exponent] with the mantissa rounded to `digits` significant figures, 1 ≤ mantissa < 10, for "6,022 × 10²³". */
export function sci(x, digits = 4) {
  if (!(x > 0) || !Number.isFinite(x)) return [0, 0];
  let e = Math.floor(Math.log10(x));
  let m = Number((x / 10 ** e).toPrecision(digits));
  if (m >= 10) [m, e] = [m / 10, e + 1];
  if (m < 1) [m, e] = [m * 10, e - 1];
  return [Number(m.toPrecision(digits)), e];
}

// Slider ranges of the four inputs; particles in units of 10²³.
export const LIMITS = { mass: [0, 500, 0.1], mol: [0, 20, 0.01], particles: [0, 100, 0.01], volume: [0, 500, 0.1] };

/**
 * After the learner sets the given quantity, move the other three sliders to the matching values
 * (rounded to their step, clamped to their range), so switching which quantity is given keeps the amount.
 * Does nothing when the conversion is refused.
 */
export function align(s) {
  const c = convert(s);
  if (c.error) return s;
  const target = { mass: c.mass, mol: c.mol, particles: c.particles / 1e23, volume: c.volume };
  for (const [key, [lo, hi, step]] of Object.entries(LIMITS)) {
    if (key === c.given || target[key] === null) continue;
    s[key] = Math.min(hi, Math.max(lo, Number((Math.round(target[key] / step) * step).toFixed(2))));
  }
  return s;
}

/**
 * The particle picture: one dot stands for `unit` particles, unit = 1, 2 or 5 × 10^k chosen so that
 * at most `max` dots are drawn. Returns { unit, count }.
 */
export function dotScale(N, max = 60) {
  if (!(N > 0) || !Number.isFinite(N)) return { unit: 0, count: 0 };
  const e = Math.floor(Math.log10(N / max));
  const unit = [1, 2, 5, 10].map(k => k * 10 ** e).find(u => N / u <= max + 1e-9); // 10·10^e always fits
  return { unit, count: Math.round(N / unit) };
}
