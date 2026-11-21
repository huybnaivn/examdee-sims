// Isotopes and average atomic mass.
//   Ā = Σ (isotope mass × abundance in %) / 100
// Isotope masses in amu and natural abundances in % of atoms (representative terrestrial values).

export const TOLERANCE = 0.01; // amu: the learner's mix "matches" the natural average within this
export const SAMPLE = 100; // atoms drawn
export const KEYS = ["p1", "p2", "p3"];
const UNIT = 0.5; // % step of the sliders; percentages are kept on this grid

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const ELEMENTS = [
  { id: "H", name: "Hydrogen", z: 1, isotopes: [{ a: 1, mass: 1.007825, abundance: 99.9885 }, { a: 2, mass: 2.014102, abundance: 0.0115 }] },
  { id: "B", name: "Boron", z: 5, isotopes: [{ a: 10, mass: 10.012937, abundance: 19.9 }, { a: 11, mass: 11.009305, abundance: 80.1 }] },
  { id: "C", name: "Carbon", z: 6, isotopes: [{ a: 12, mass: 12, abundance: 98.93 }, { a: 13, mass: 13.003355, abundance: 1.07 }] },
  {
    id: "Mg",
    name: "Magnesium",
    z: 12,
    isotopes: [{ a: 24, mass: 23.985042, abundance: 78.99 }, { a: 25, mass: 24.985837, abundance: 10 }, { a: 26, mass: 25.982593, abundance: 11.01 }],
  },
  { id: "Cl", name: "Chlorine", z: 17, isotopes: [{ a: 35, mass: 34.968853, abundance: 75.76 }, { a: 37, mass: 36.965903, abundance: 24.24 }] },
  { id: "Cu", name: "Copper", z: 29, isotopes: [{ a: 63, mass: 62.929598, abundance: 69.15 }, { a: 65, mass: 64.92779, abundance: 30.85 }] },
  { id: "Br", name: "Bromine", z: 35, isotopes: [{ a: 79, mass: 78.918338, abundance: 50.69 }, { a: 81, mass: 80.91629, abundance: 49.31 }] },
];

export const elementById = id => ELEMENTS.find(e => e.id === id) ?? ELEMENTS[0];
export const isotopesOf = s => elementById(s.element).isotopes;

/**
 * Share `total` whole units among the weights by the largest-remainder method:
 * everyone gets the whole part of their exact share, the units left over go to the largest remainders.
 * Equal shares when all weights are zero.
 */
export function apportion(weights, total) {
  const w = weights.map(x => (x > 0 ? x : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  const exact = w.map(x => (sum ? (x / sum) * total : total / w.length));
  const out = exact.map(x => Math.floor(x + 1e-9));
  const order = exact.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let left = total - out.reduce((a, b) => a + b, 0);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length][1]]++;
  return out;
}

/** Average atomic mass from isotope masses and percentages. */
export const averageMass = (masses, percents) => masses.reduce((sum, m, i) => sum + m * percents[i], 0) / 100;

/** Two isotopes: the percentages [x₁, x₂] that give the average Ā, from x₁·m₁ + (100 − x₁)·m₂ = 100·Ā. */
export function abundancesFromAverage(m1, m2, average) {
  const x1 = (100 * (m2 - average)) / (m2 - m1);
  return [x1, 100 - x1];
}

export const initialState = () => ({
  element: "Cl",
  custom: false, // false: natural abundances; true: the learner sets the percentages
  p1: 50, // % of each isotope in the learner's mix (always summing to 100)
  p2: 50,
  p3: 0,
  matched: false, // the learner's mix has hit the natural average
});

/** Percentages shown and used right now: natural, or the learner's mix forced onto the grid and to a sum of 100. */
export function percentages(s) {
  const iso = isotopesOf(s);
  if (!s.custom) return iso.map(x => x.abundance);
  return apportion(iso.map((_, i) => clamp(s[KEYS[i]], 0, 100)), 100 / UNIT).map(u => u * UNIT);
}

export const naturalAverage = s => averageMass(isotopesOf(s).map(x => x.mass), isotopesOf(s).map(x => x.abundance));
export const currentAverage = s => averageMass(isotopesOf(s).map(x => x.mass), percentages(s));
export const matches = s => Math.abs(currentAverage(s) - naturalAverage(s)) <= TOLERANCE;
/** Number of atoms of each isotope in the sample of 100. */
export const sampleCounts = s => apportion(percentages(s), SAMPLE);

/** Set isotope `index` to `value` % and rescale the others in proportion so the total stays 100. */
export function setPercent(s, index, value) {
  const n = isotopesOf(s).length;
  if (!(index >= 0 && index < n)) return s;
  const units = KEYS.slice(0, n).map(k => clamp(s[k], 0, 100) / UNIT);
  const mine = Math.round(clamp(value, 0, 100) / UNIT);
  const others = [...units.keys()].filter(i => i !== index);
  const shares = apportion(others.map(i => units[i]), 100 / UNIT - mine);
  others.forEach((i, j) => (units[i] = shares[j]));
  units[index] = mine;
  KEYS.forEach((k, i) => (s[k] = i < n ? units[i] * UNIT : 0));
  return s;
}

/** An even mix to start "tự pha" from. */
export function resetMix(s) {
  const n = isotopesOf(s).length;
  const even = apportion(Array(n).fill(1), 100 / UNIT);
  KEYS.forEach((k, i) => (s[k] = i < n ? even[i] * UNIT : 0));
  s.matched = false;
  return s;
}
