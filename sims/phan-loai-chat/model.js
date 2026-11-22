// Classifying samples of matter from their particles.
// A sample is a list of substances; each substance has a formula (atoms per formula unit).
//   one substance, one element        -> đơn chất
//   one substance, several elements   -> hợp chất (fixed ratio given by the formula)
//   several substances, evenly mixed  -> hỗn hợp đồng nhất
//   several substances, in clumps     -> hỗn hợp không đồng nhất

export const BINS = [
  { id: "don-chat", label: "Đơn chất", parent: "Chất tinh khiết" },
  { id: "hop-chat", label: "Hợp chất", parent: "Chất tinh khiết" },
  { id: "dong-nhat", label: "Đồng nhất", parent: "Hỗn hợp" },
  { id: "khong-dong-nhat", label: "Không đồng nhất", parent: "Hỗn hợp" },
];

// Drawing colours (a convention) and relative radius of each kind of atom.
export const ATOMS = {
  H: { color: "#ffffff", r: 0.7 },
  O: { color: "#e5484d", r: 1 },
  N: { color: "#2f6fed", r: 1 },
  Fe: { color: "#8c93a3", r: 1.2 },
  Na: { color: "#b497f5", r: 1 },
  Cl: { color: "#4cc38a", r: 1.2 },
  Si: { color: "#e0b872", r: 1.2 },
};

// Substances. `shape` places the atoms of one formula unit, in units of the atom radius.
// `ions`: the formula unit is drawn as separate ions (ionic compound), not as a molecule.
export const SUBSTANCES = {
  O2: { name: "oxygen", formula: "O₂", atoms: { O: 2 }, shape: [["O", -0.9, 0], ["O", 0.9, 0]] },
  N2: { name: "nitrogen", formula: "N₂", atoms: { N: 2 }, shape: [["N", -0.9, 0], ["N", 0.9, 0]] },
  Fe: { name: "sắt (iron)", formula: "Fe", atoms: { Fe: 1 }, shape: [["Fe", 0, 0]] },
  H2O: { name: "nước", formula: "H₂O", atoms: { H: 2, O: 1 }, shape: [["O", 0, 0], ["H", -1.2, 0.8], ["H", 1.2, 0.8]] },
  NaCl: { name: "sodium chloride", formula: "NaCl", atoms: { Na: 1, Cl: 1 }, ions: [["Na", "+"], ["Cl", "−"]] },
  // Sand is taken as silicon dioxide; one formula unit is drawn (the real solid is a network).
  SiO2: { name: "silicon dioxide", formula: "SiO₂", atoms: { Si: 1, O: 2 }, shape: [["Si", 0, 0], ["O", -1.9, 0], ["O", 1.9, 0]] },
};

// `layout`: "even" (particles of all kinds spread through the sample), "clumped" (each substance
// keeps to its own region) or "lattice" (regular solid). `parts` = [substance, formula units drawn].
export const SAMPLES = [
  { id: "oxygen", name: "Khí oxygen", fluid: true, layout: "even", parts: [["O2", 8]] },
  { id: "sat", name: "Sắt", fluid: false, layout: "lattice", parts: [["Fe", 16]] },
  { id: "nuoc", name: "Nước cất", fluid: true, layout: "even", parts: [["H2O", 12]] },
  { id: "muoi", name: "Muối ăn", fluid: false, layout: "lattice", parts: [["NaCl", 8]] },
  // Dry air is about 78 % nitrogen and 21 % oxygen by number of molecules; the other gases (≈ 1 %) are not drawn.
  { id: "khongkhi", name: "Không khí", fluid: true, layout: "even", parts: [["N2", 11], ["O2", 3]] },
  // 1 NaCl per 10 H₂O is about 24,5 % by mass, below saturation (≈ 26 % at 20 °C).
  { id: "nuocmuoi", name: "Nước muối", fluid: true, layout: "even", parts: [["H2O", 10], ["NaCl", 1]] },
  { id: "catsat", name: "Cát lẫn bột sắt", fluid: false, layout: "clumped", parts: [["SiO2", 6], ["Fe", 6]] },
  { id: "nuoccat", name: "Nước lẫn cát", fluid: true, layout: "clumped", parts: [["H2O", 8], ["SiO2", 5]] },
];

export const sampleOf = id => SAMPLES.find(sample => sample.id === id);
const key = id => `at_${id}`;

export const initialState = () => ({
  sel: "khongkhi", // sample shown in the zoom
  bin: BINS[0].id, // target group for the keyboard button
  ...Object.fromEntries(SAMPLES.map(sample => [key(sample.id), ""])), // at_<id>: bin id, "" = not sorted yet
});

/** Class of a sample, worked out from its particles only. */
export function classify(sample) {
  if (sample.parts.length > 1) return sample.layout === "clumped" ? "khong-dong-nhat" : "dong-nhat";
  return Object.keys(SUBSTANCES[sample.parts[0][0]].atoms).length === 1 ? "don-chat" : "hop-chat";
}

/** Where the learner put a sample: a bin id, or "" (also for a forged value). */
export const placedIn = (s, id) => (BINS.some(bin => bin.id === s[key(id)]) ? s[key(id)] : "");

/** Put a sample in a bin ("" takes it back out). Returns true when something changed. */
export function place(s, id, bin) {
  if (!sampleOf(id) || (bin !== "" && !BINS.some(b => b.id === bin))) return false;
  if (placedIn(s, id) === bin) return false;
  s[key(id)] = bin;
  return true;
}

export const isCorrect = (s, id) => placedIn(s, id) === classify(sampleOf(id));

export function score(s) {
  const placed = SAMPLES.filter(sample => placedIn(s, sample.id)).length;
  const correct = SAMPLES.filter(sample => isCorrect(s, sample.id)).length;
  return { total: SAMPLES.length, placed, correct, done: placed === SAMPLES.length, allCorrect: correct === SAMPLES.length };
}

// ---------- the particle picture ----------

export const ATOM = 0.062; // atom radius unit, as a fraction of the zoom radius

// Places for particle centres inside the unit disc, row by row (top to bottom).
function cells(n) {
  for (let d = 0.62; d > 0.2; d -= 0.02) {
    const out = [];
    for (let j = 0, y = -0.78; y <= 0.78; j++, y += d * 0.87) {
      for (let x = -0.78 + (j % 2) * (d / 2); x <= 0.78; x += d) if (Math.hypot(x, y) <= 0.78) out.push({ x, y });
    }
    if (out.length >= n) return { d, list: Array.from({ length: n }, (_, i) => out[Math.floor(((i + 0.5) * out.length) / n)]) };
  }
  throw new Error("too many particles");
}

/**
 * The particles drawn in the zoom: [{ sub, x, y, rot, atoms: [[element, dx, dy]], charge }].
 * x, y are in units of the zoom radius; dx, dy in units of ATOM. Deterministic for each sample.
 */
export function picture(sample) {
  let seed = 7 + 13 * SAMPLES.indexOf(sample);
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const parts = [];
  for (const [sub, units] of sample.parts) {
    const def = SUBSTANCES[sub];
    for (let u = 0; u < units; u++) {
      if (def.ions) for (const [el, charge] of def.ions) parts.push({ sub, atoms: [[el, 0, 0]], charge });
      else parts.push({ sub, atoms: def.shape, charge: "" });
    }
  }
  if (sample.layout === "lattice") {
    // 4 × 4 grid; neighbours alternate between the even and the odd entries of the list (Na⁺ / Cl⁻)
    const next = [0, 0];
    return Array.from({ length: 16 }, (_, k) => {
      const r = Math.floor(k / 4);
      const c = k % 4;
      const part = parts[2 * next[(r + c) % 2]++ + ((r + c) % 2)];
      return { ...part, x: (c - 1.5) * 0.36, y: (r - 1.5) * 0.36, rot: 0 };
    });
  }
  if (sample.layout === "even") {
    for (let i = parts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }
  }
  const { d, list } = cells(parts.length);
  const jitter = sample.fluid ? 0.16 * d : 0.05 * d;
  return parts.map((part, i) => ({
    ...part,
    x: list[i].x + (rnd() - 0.5) * 2 * jitter,
    y: list[i].y + (rnd() - 0.5) * 2 * jitter,
    rot: part.atoms.length > 1 ? rnd() * Math.PI * 2 : 0,
  }));
}
