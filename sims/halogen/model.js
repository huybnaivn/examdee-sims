// Group VIIA, the halogens: properties table and displacement of halides. Pure logic, no DOM.
//
// Radii (nm) and Pauling electronegativities are the values of the Vietnamese grade 10 textbook table
// (older edition); see the sim's report for which numbers are unverified against the 2018 books.

export const HALOGENS = [
  { sym: "F", name: "fluorine", Z: 9, state: "khí", colour: "lục nhạt", swatch: "#dfe9a6", radius: 0.064, chi: 3.98, mp: -220, bp: -188 },
  { sym: "Cl", name: "chlorine", Z: 17, state: "khí", colour: "vàng lục", swatch: "#c8d84a", radius: 0.099, chi: 3.16, mp: -101, bp: -34 },
  { sym: "Br", name: "bromine", Z: 35, state: "lỏng", colour: "nâu đỏ", swatch: "#8e2a12", radius: 0.114, chi: 2.96, mp: -7, bp: 59 },
  { sym: "I", name: "iodine", Z: 53, state: "rắn", colour: "tím đen", swatch: "#3b2347", radius: 0.133, chi: 2.66, mp: 114, bp: 184 },
];

// Halogen water added in the experiment (index into HALOGENS) and its colour in water.
export const REAGENTS = [1, 2, 3];
export const WATER_COLOUR = { 1: [215, 225, 150, 0.35], 2: [235, 160, 40, 0.55], 3: [150, 85, 30, 0.6] }; // pale yellow-green, yellow-orange, brown
export const COLOUR_NAME = { 1: "vàng lục nhạt", 2: "vàng cam", 3: "nâu" };
// Halide solutions KX (index of X in HALOGENS). All are colourless.
export const HALIDES = [1, 2, 3];

export const PAIRS = []; // the six off-diagonal cells of the 3 × 3 grid, [halogen, halide]
for (const h of REAGENTS) for (const x of HALIDES) if (h !== x) PAIRS.push([h, x]);
export const predKey = (h, x) => `p${HALOGENS[h].sym}${HALOGENS[x].sym}`;

export const initialState = () => {
  const s = {
    tab: "props", // "props" (cards and trends) or "exp" (displacement)
    halogen: 1, // halogen water added (1 Cl₂, 2 Br₂, 3 I₂)
    halide: 2, // halide solution KX (1 KCl, 2 KBr, 3 KI)
    added: false,
    progress: 0, // 0–1 animation progress after adding
    done: "000000000", // 3 × 3 grid of tried pairs, row = halogen, column = halide: "0" not tried, "1" tried
    practice: false, // show the prediction controls
    score: -1, // correct predictions out of 6 at the last check, −1 not checked
  };
  for (const [h, x] of PAIRS) s[predKey(h, x)] = "?";
  return s;
};

/** A halogen oxidises (displaces) only the halides below it in the group. */
export const reacts = (h, x) => h < x;

/** Balanced equation in ASCII, or null when there is no reaction. */
export const equation = (h, x) => (reacts(h, x) ? `${HALOGENS[h].sym}2 + 2K${HALOGENS[x].sym} -> 2K${HALOGENS[h].sym} + ${HALOGENS[x].sym}2` : null);

/** Colour of the tube after adding: the freed halogen when there is a reaction, else the added halogen water. */
export const resultColour = (h, x) => WATER_COLOUR[reacts(h, x) ? x : h];

const cell = (h, x) => (h - 1) * 3 + (x - 1);
/** Which grid cells have been tried. A forged string is read as "not tried". */
export const tried = (s, h, x) => typeof s.done === "string" && /^[01]{9}$/.test(s.done) && s.done[cell(h, x)] === "1";
export function markTried(s, h, x) {
  const d = typeof s.done === "string" && /^[01]{9}$/.test(s.done) ? [...s.done] : [..."000000000"];
  d[cell(h, x)] = "1";
  s.done = d.join("");
}

/** Number of the six predictions that are right ("yes" = reacts). */
export const score = s => PAIRS.filter(([h, x]) => s[predKey(h, x)] === (reacts(h, x) ? "yes" : "no")).length;
export const allPredicted = s => PAIRS.every(([h, x]) => s[predKey(h, x)] !== "?");

/** Advance the adding animation. Returns true when it has just finished. */
export function step(s, dt) {
  if (!s.added) return false;
  const before = s.progress;
  s.progress = Math.min(1, Math.max(0, s.progress) + dt / 2.5);
  return before < 1 && s.progress >= 1;
}

export const sub = t => t.replace(/->/g, "→").replace(/([A-Za-z)])(\d+)/g, (_, a, d) => a + [...d].map(c => "₀₁₂₃₄₅₆₇₈₉"[c]).join(""));
