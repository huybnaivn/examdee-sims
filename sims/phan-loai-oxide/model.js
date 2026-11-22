// Oxides: classification by their reactions with water, an acid (dung dịch HCl) and a base (dung dịch NaOH).
// Names follow the 2018 programme (calcium oxide, copper(II) oxide, carbon dioxide, …).
// Equations are kept in plain ASCII ("Fe2O3 + 6HCl → 2FeCl3 + 3H2O") so they can be checked; pretty() adds subscripts.

export const CLASSES = ["basic", "acidic", "amphoteric", "neutral"]; // class code = index + 1
export const REAGENTS = ["water", "acid", "base"]; // reagent code = index + 1, bit = 1 << index

const ELEMENTS = {
  Ca: { name: "calcium", metal: true },
  Na: { name: "sodium", metal: true },
  Cu: { name: "copper", metal: true, multi: true }, // multi: has more than one valence, so the name carries it
  Fe: { name: "iron", metal: true, multi: true },
  Al: { name: "aluminium", metal: true },
  Zn: { name: "zinc", metal: true },
  C: { name: "carbon" },
  S: { name: "sulfur" },
  P: { name: "phosphorus" },
  N: { name: "nitrogen" },
};

// el: the other element, nE and nO: atoms of it and of oxygen in the formula, phase and colour of the pure oxide.
export const OXIDES = [
  { id: "CaO", el: "Ca", nE: 1, nO: 1, cls: "basic", phase: "solid", color: "white" },
  { id: "Na2O", el: "Na", nE: 2, nO: 1, cls: "basic", phase: "solid", color: "white" },
  { id: "CuO", el: "Cu", nE: 1, nO: 1, cls: "basic", phase: "solid", color: "black" },
  { id: "Fe2O3", el: "Fe", nE: 2, nO: 3, cls: "basic", phase: "solid", color: "brown" },
  { id: "CO2", el: "C", nE: 1, nO: 2, cls: "acidic", phase: "gas", color: "none" },
  { id: "SO2", el: "S", nE: 1, nO: 2, cls: "acidic", phase: "gas", color: "none" },
  { id: "P2O5", el: "P", nE: 2, nO: 5, cls: "acidic", phase: "solid", color: "white" },
  { id: "Al2O3", el: "Al", nE: 2, nO: 3, cls: "amphoteric", phase: "solid", color: "white" },
  { id: "ZnO", el: "Zn", nE: 1, nO: 1, cls: "amphoteric", phase: "solid", color: "white" },
  { id: "CO", el: "C", nE: 1, nO: 1, cls: "neutral", phase: "gas", color: "none" },
  { id: "NO", el: "N", nE: 1, nO: 1, cls: "neutral", phase: "gas", color: "none" },
];
export const N = OXIDES.length;
export const indexOf = id => Math.max(0, OXIDES.findIndex(o => o.id === id)); // unknown id: the first oxide
export const oxide = id => OXIDES[indexOf(id)];

const SUB = "₀₁₂₃₄₅₆₇₈₉";
/** Subscripts for the digits inside formulas; coefficients in front stay as they are. */
export const pretty = text => text.replace(/(?<=[A-Za-z)\]])\d+/g, d => [...d].map(c => SUB[c]).join(""));

// ---------- names ----------
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
const PREFIX = ["", "mono", "di", "tri", "tetra", "penta", "hexa", "hepta"];
/** Valence of the other element: oxygen has valence II, so nE · valence = 2 · nO. */
export const valence = id => (2 * oxide(id).nO) / oxide(id).nE;

/**
 * Metal oxide: tên kim loại (hóa trị, nếu kim loại có nhiều hóa trị) + oxide.
 * Non-metal oxide: (tiền tố số nguyên tử phi kim) tên phi kim + (tiền tố số nguyên tử oxygen) oxide;
 * "mono" is not written in front of the non-metal, and the "a" of a prefix is dropped before "oxide".
 */
export function name(id) {
  const o = oxide(id);
  const e = ELEMENTS[o.el];
  if (e.metal) return `${e.name}${e.multi ? `(${ROMAN[valence(id)]})` : ""} oxide`;
  return `${o.nE > 1 ? PREFIX[o.nE] : ""}${e.name} ${PREFIX[o.nO].replace(/[ao]$/, "")}oxide`;
}
/** The other accepted name of a non-metal oxide: tên phi kim (hóa trị) + oxide. Empty for metal oxides. */
export function valenceName(id) {
  const e = ELEMENTS[oxide(id).el];
  return e.metal ? "" : `${e.name}(${ROMAN[valence(id)]}) oxide`;
}

/** Wrong names offered next to the right ones in the naming practice. */
export const WRONG_NAMES = ["copper(I) oxide", "iron(II) oxide", "sulfur trioxide", "phosphorus pentoxide", "dinitrogen monoxide", "dialuminium trioxide", "calcium monoxide", "disodium oxide", "carbon oxide"];
export const NAME_OPTIONS = [...OXIDES.map(o => name(o.id)), ...WRONG_NAMES].sort();

// ---------- reactions ----------
// [equation, observation, look] — look: solution "clear" | "blue" | "yellow"; left "" | "solid" | "gas"; litmus (water only).
const DISSOLVES = { solution: "clear", left: "" };
const SINKS = { solution: "clear", left: "solid" };
const ESCAPES = { solution: "clear", left: "gas" };
const SALT = "tạo muối và nước";
const REACTIONS = {
  CaO: {
    water: ["CaO + H2O → Ca(OH)2", "Phản ứng mạnh, tỏa nhiều nhiệt, tạo Ca(OH)₂ ít tan (nước vôi hơi đục). Quỳ tím hóa xanh.", DISSOLVES],
    acid: ["CaO + 2HCl → CaCl2 + H2O", `Chất rắn tan hết, tỏa nhiệt, tạo dung dịch không màu: ${SALT}.`, DISSOLVES],
  },
  Na2O: {
    water: ["Na2O + H2O → 2NaOH", "Chất rắn tan hết, tỏa nhiệt, tạo dung dịch base. Quỳ tím hóa xanh.", DISSOLVES],
    acid: ["Na2O + 2HCl → 2NaCl + H2O", `Chất rắn tan hết, tỏa nhiệt, tạo dung dịch không màu: ${SALT}.`, DISSOLVES],
  },
  CuO: {
    acid: ["CuO + 2HCl → CuCl2 + H2O", `Bột màu đen tan dần, tạo dung dịch màu xanh lam: ${SALT}.`, { solution: "blue", left: "" }],
  },
  Fe2O3: {
    acid: ["Fe2O3 + 6HCl → 2FeCl3 + 3H2O", `Bột màu nâu đỏ tan dần, tạo dung dịch màu vàng nâu: ${SALT}.`, { solution: "yellow", left: "" }],
  },
  CO2: {
    water: ["CO2 + H2O ⇌ H2CO3", "Khí tan một phần trong nước, tạo dung dịch acid yếu. Quỳ tím hóa đỏ nhạt.", DISSOLVES],
    base: ["CO2 + 2NaOH → Na2CO3 + H2O", `Khí bị dung dịch NaOH hấp thụ: ${SALT}.`, DISSOLVES],
  },
  SO2: {
    water: ["SO2 + H2O ⇌ H2SO3", "Khí tan trong nước, tạo dung dịch acid. Quỳ tím hóa đỏ.", DISSOLVES],
    base: ["SO2 + 2NaOH → Na2SO3 + H2O", `Khí bị dung dịch NaOH hấp thụ: ${SALT}.`, DISSOLVES],
  },
  P2O5: {
    water: ["P2O5 + 3H2O → 2H3PO4", "Chất rắn tan, tỏa nhiệt, tạo dung dịch acid. Quỳ tím hóa đỏ.", DISSOLVES],
    base: ["P2O5 + 6NaOH → 2Na3PO4 + 3H2O", `Chất rắn tan trong dung dịch NaOH: ${SALT}.`, DISSOLVES],
  },
  Al2O3: {
    acid: ["Al2O3 + 6HCl → 2AlCl3 + 3H2O", `Bột trắng tan dần, tạo dung dịch không màu: ${SALT}.`, DISSOLVES],
    base: ["Al2O3 + 2NaOH → 2NaAlO2 + H2O", `Bột trắng tan dần trong dung dịch NaOH: ${SALT}.`, DISSOLVES],
  },
  ZnO: {
    acid: ["ZnO + 2HCl → ZnCl2 + H2O", `Bột trắng tan dần, tạo dung dịch không màu: ${SALT}.`, DISSOLVES],
    base: ["ZnO + 2NaOH → Na2ZnO2 + H2O", `Bột trắng tan dần trong dung dịch NaOH: ${SALT}.`, DISSOLVES],
  },
  CO: {},
  NO: {},
};
const REAGENT_NAME = { water: "nước", acid: "HCl", base: "NaOH" };

/** What happens when the oxide is put into the reagent: { reacts, equation, observation, solution, left, litmus }. */
export function test(id, reagent) {
  const o = oxide(id);
  if (!REAGENTS.includes(reagent)) reagent = "water";
  const hit = REACTIONS[o.id][reagent];
  // litmus only goes into the water test: blue for a base, red for an acid
  const litmus = reagent !== "water" ? "" : !hit ? "purple" : o.cls === "basic" ? "blue" : "red";
  if (hit) return { reacts: true, equation: hit[0], observation: hit[1], ...hit[2], litmus };
  let observation;
  let look = o.phase === "gas" ? ESCAPES : SINKS;
  if (reagent === "water") {
    observation = o.phase === "gas" ? "Khí hầu như không tan, thoát ra khỏi nước. Quỳ tím không đổi màu." : "Chất rắn không tan, lắng xuống đáy cốc. Quỳ tím không đổi màu.";
  } else if (REACTIONS[o.id].water) {
    // it meets the water of the solution, not the acid or the base
    observation = `Không phản ứng với ${REAGENT_NAME[reagent]}; chỉ tác dụng với nước có trong dung dịch.`;
    look = DISSOLVES;
  } else {
    observation = o.phase === "gas" ? `Không phản ứng với ${REAGENT_NAME[reagent]}; khí thoát ra khỏi dung dịch.` : `Không phản ứng với ${REAGENT_NAME[reagent]}; chất rắn không tan.`;
  }
  return { reacts: false, equation: "", observation, ...look, litmus };
}
export const reacts = (id, reagent) => test(id, reagent).reacts;

/**
 * The class that the acid and base tests point to:
 * acid only → oxide base, base only → oxide acid, both → oxide lưỡng tính, neither → oxide trung tính.
 */
export function classify(id) {
  const a = reacts(id, "acid");
  const b = reacts(id, "base");
  return a && b ? "amphoteric" : a ? "basic" : b ? "acidic" : "neutral";
}
export const classCode = cls => CLASSES.indexOf(cls) + 1;

// ---------- learner progress, kept as strings of one digit per oxide so the state stays flat ----------
/** Untrusted string -> N digits, each 0..max. */
export const marks = (str, max) => Array.from({ length: N }, (_, i) => (/^\d$/.test(String(str ?? "")[i] ?? "") && +str[i] <= max ? +str[i] : 0));

export const initialState = () => ({
  oxide: "CuO",
  reagent: "acid", // the test whose details are shown
  tested: "00200000000", // per oxide, bits: 1 nước, 2 acid, 4 base — CuO has been put into HCl already
  classes: "0".repeat(N), // per oxide, the learner's class code 1..4, 0 = not classified
  named: "0".repeat(N), // per oxide, 1 = named correctly
  guess: "", // class chosen in the list, "" = none
  name: "", // name chosen in the list, "" = none
  attempts: 0, // classifications confirmed so far
});

export const wasTested = (s, id, reagent) => (marks(s.tested, 7)[indexOf(id)] & (1 << REAGENTS.indexOf(reagent))) !== 0;
/** Classifying needs the acid test and the base test of that oxide. */
export const canClassify = (s, id = s.oxide) => wasTested(s, id, "acid") && wasTested(s, id, "base");

export function runTest(s, reagent) {
  if (!REAGENTS.includes(reagent)) return null;
  const m = marks(s.tested, 7);
  m[indexOf(s.oxide)] |= 1 << REAGENTS.indexOf(reagent);
  s.tested = m.join("");
  s.reagent = reagent;
  return test(s.oxide, reagent);
}

export function progress(s) {
  const m = marks(s.classes, 4);
  const correct = m.filter((code, i) => code === classCode(OXIDES[i].cls)).length;
  return { classified: m.filter(Boolean).length, correct, all: correct === N, named: marks(s.named, 1).filter(Boolean).length };
}

/** Put the current oxide into the chosen class. Returns { code, correct, completed } or null when not allowed. */
export function confirmClass(s) {
  const code = classCode(s.guess);
  if (!code || !canClassify(s)) return null;
  const before = progress(s).all;
  const m = marks(s.classes, 4);
  const i = indexOf(s.oxide);
  m[i] = code;
  s.classes = m.join("");
  s.attempts = Math.max(0, Math.floor(Number.isFinite(s.attempts) ? s.attempts : 0)) + 1;
  return { code, correct: code === classCode(OXIDES[i].cls), completed: !before && progress(s).all };
}

/** Check the chosen name of the current oxide; the valence name of a non-metal oxide is not in the list. */
export function checkName(s) {
  const right = s.name === name(s.oxide);
  if (right) {
    const m = marks(s.named, 1);
    m[indexOf(s.oxide)] = 1;
    s.named = m.join("");
  }
  return right;
}
