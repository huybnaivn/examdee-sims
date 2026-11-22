// Continuous, line-emission and absorption spectra in the visible range. Wavelengths in nm.

export const VISIBLE = [380, 760]; // nm, limits of visible light as given in the textbook

// Brightest visible lines of each gas, in air, rounded to 0,1 nm (standard spectroscopic tables).
// Hydrogen: the four visible Balmer lines Hδ, Hγ, Hβ, Hα. Sodium: the yellow D doublet.
export const ELEMENTS = [
  { id: "H", name: "hiđrô", lines: [410.2, 434.0, 486.1, 656.3] },
  { id: "Na", name: "natri", lines: [589.0, 589.6] },
  { id: "Hg", name: "thủy ngân", lines: [404.7, 435.8, 546.1, 577.0, 579.1] },
  { id: "He", name: "heli", lines: [447.1, 471.3, 492.2, 501.6, 587.6, 667.8, 706.5] },
  { id: "Ne", name: "neon", lines: [585.2, 594.5, 609.6, 614.3, 626.6, 633.4, 640.2, 650.6, 667.8, 692.9, 703.2] },
];
export const SOURCES = ["lamp", ...ELEMENTS.map(e => e.id)]; // "lamp" = incandescent filament

export const initialState = () => ({
  mode: "emission", // "emission" | "absorption" | "unknown"
  source: "H", // emission mode: "lamp" or an element id
  gas: "Na", // absorption mode: the cool gas in front of the lamp
  guess: "H", // unknown mode: reference gas the learner compares with
  unknown: 2, // unknown mode: index into ELEMENTS of the gas to identify
  seed: 1, // drives the choice of the next unknown gas
  tries: 0, // checks made on the current unknown gas
  checked: false, // the current guess has been checked
  solved: false, // the current unknown gas has been identified
  showLabels: true,
});

export const element = id => ELEMENTS.find(e => e.id === id) ?? null;
export const linesOf = id => element(id)?.lines ?? [];

/** What the spectroscope shows for a hot source: a continuous band, or bright lines. */
export const emission = source => ({ continuous: source === "lamp", lines: linesOf(source) });

/** Dark lines when white light passes a cooler gas: the gas absorbs exactly what it can emit. */
export const absorptionLines = gas => linesOf(gas);

/** Number of lines of `a` that have a partner in `b` within `tol` nm. */
export const coincide = (a, b, tol = 0.25) => a.filter(x => b.some(y => Math.abs(x - y) <= tol)).length;

/** The preset whose line set is exactly the observed one (every line matched both ways), or null. */
export function identify(lines, tol = 0.25) {
  const hits = ELEMENTS.filter(e => lines.length > 0 && coincide(lines, e.lines, tol) === lines.length && coincide(e.lines, lines, tol) === e.lines.length);
  return hits.length === 1 ? hits[0].id : null;
}

// Colour names with the textbook boundaries (each lies inside the overlap the textbook gives).
const BANDS = [[430, "tím"], [455, "chàm"], [505, "lam"], [572, "lục"], [595, "vàng"], [645, "cam"], [760, "đỏ"]];
export const colourName = nm => (nm < VISIBLE[0] || nm > VISIBLE[1] ? "" : BANDS.find(([top]) => nm <= top)[1]);

// Approximate screen colour: straight lines between anchor colours, black outside the visible range.
const ANCHORS = [
  [380, 90, 0, 110],
  [440, 40, 0, 255],
  [490, 0, 215, 255],
  [510, 0, 255, 60],
  [580, 255, 240, 0],
  [645, 255, 0, 0],
  [700, 220, 0, 0],
  [760, 90, 0, 0],
];
export function wavelengthToRgb(nm) {
  if (!(nm >= VISIBLE[0] && nm <= VISIBLE[1])) return [0, 0, 0];
  const k = Math.max(1, ANCHORS.findIndex(a => a[0] >= nm));
  const [a, b] = [ANCHORS[k - 1], ANCHORS[k]];
  const t = (nm - a[0]) / (b[0] - a[0]);
  return [1, 2, 3].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
}

const index = s => Math.min(ELEMENTS.length - 1, Math.max(0, Math.round(Number(s.unknown) || 0)));
export const unknownElement = s => ELEMENTS[index(s)];

/** Check the learner's guess against the unknown gas. Mutates and returns { correct, matched, total }. */
export function check(s) {
  const target = unknownElement(s);
  const matched = coincide(target.lines, linesOf(s.guess));
  const correct = identify(target.lines) === s.guess;
  s.tries = Math.max(0, Math.round(Number(s.tries) || 0)) + 1;
  s.checked = true;
  s.solved = correct;
  return { correct, matched, total: target.lines.length };
}

/** Pick another unknown gas (never the same one twice in a row). Deterministic in `seed`. */
export function nextUnknown(s) {
  s.seed = (Math.imul((Number(s.seed) || 0) >>> 0, 1664525) + 1013904223) >>> 0;
  s.unknown = (index(s) + 1 + ((s.seed >>> 16) % (ELEMENTS.length - 1))) % ELEMENTS.length;
  s.tries = 0;
  s.checked = false;
  s.solved = false;
  return s;
}
