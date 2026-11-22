// Charging by rubbing (nhiễm điện do cọ xát), qualitative model.
// Charge is counted in whole "units"; one unit stands for a very large number of electrons.
// Positive charge = the object has lost electrons. Only electrons move.

// Triboelectric order used here, from the end that gives up electrons most easily (becomes +)
// to the end that takes them most easily (becomes −):
//   thủy tinh, tóc, len, lụa, cao su (bóng bay), nhựa (thước nhựa).
// It agrees with the textbook cases: glass rubbed with silk is +, a plastic ruler rubbed with wool is −,
// a balloon rubbed on hair is −.
export const MATERIALS = {
  glass: { name: "Đũa thủy tinh", short: "đũa thủy tinh", rank: 0 },
  hair: { name: "Tóc", short: "tóc", rank: 1 },
  wool: { name: "Mảnh len", short: "mảnh len", rank: 2 },
  silk: { name: "Mảnh lụa", short: "mảnh lụa", rank: 3 },
  balloon: { name: "Bóng bay", short: "bóng bay", rank: 4 },
  ruler: { name: "Thước nhựa", short: "thước nhựa", rank: 5 },
};
export const ORDER = Object.keys(MATERIALS).sort((a, b) => MATERIALS[a].rank - MATERIALS[b].rank);
export const OBJECTS = ["ruler", "glass", "balloon"]; // things that are held and brought near
export const CLOTHS = ["wool", "silk", "hair"]; // things they are rubbed with
export const QMAX = 12; // the most charge one object can hold (units)
export const PAPER = 8; // paper bits on the table

export const initialState = () => ({
  scene: "rub", // "rub" | "paper" | "pair" | "electroscope"
  m1: "ruler", // material of object 1
  m2: "glass", // material of object 2
  cloth: "wool", // what objects are rubbed with
  q1: -6, // charge of object 1 (units); starts already rubbed twice with wool
  q2: 0,
  qc: 6, // charge of the cloth
  qe: 0, // charge of the electroscope
  use: 1, // which object (1 or 2) is used with the paper bits and the electroscope
  near: false, // pair scene: object 2 brought close to the hanging object 1
  guess: "", // prediction for the next rub: "" | "+" | "-"
  showOrder: false, // show the triboelectric order on screen
});

/** Electrons moved from material a to material b in one rub (negative: from b to a). */
export const electronsMoved = (a, b) => MATERIALS[b].rank - MATERIALS[a].rank;

/** Sign (+1, −1, 0) an object of material a gets when rubbed with b. */
export const signAfterRub = (a, b) => Math.sign(electronsMoved(a, b));

const cap = (n, ...charges) => {
  // shrink the transfer so no charge goes past ±QMAX
  for (const [q, dir] of charges) {
    const room = dir > 0 ? QMAX - q : QMAX + q;
    if (Math.abs(n) > room) n = Math.sign(n) * Math.max(0, room);
  }
  return n;
};

/** Rub object 1 or 2 with the cloth. Returns the charge the object gained (units). */
export function rub(s, which) {
  const key = which === 2 ? "q2" : "q1";
  const mat = which === 2 ? s.m2 : s.m1;
  const n0 = electronsMoved(mat, s.cloth); // > 0: the object gives electrons to the cloth
  const d = Math.sign(n0);
  const n = cap(n0, [s[key], d], [s.qc, -d]);
  s[key] += n;
  s.qc -= n;
  return n;
}

/** +1 attract, −1 repel, 0 nothing. A charged object also attracts a neutral one (by induction). */
export function interaction(qa, qb) {
  if (qa === 0 && qb === 0) return 0;
  if (qa === 0 || qb === 0) return 1;
  return qa * qb < 0 ? 1 : -1;
}

/** Relative strength of the pull or push (arbitrary units), for the swing of the hanging object. */
export const strength = (qa, qb) => (qa && qb ? Math.abs(qa * qb) : 0.25 * (qa * qa + qb * qb));

/** Paper bits lifted by an object with charge q; the sign does not matter. */
export const paperLifted = q => Math.min(PAPER, Math.floor(Math.max(0, Math.abs(q) - 1) / 1.25));

/** Electroscope leaf spread (degrees between the leaves): 0 when neutral, grows with |q|, levels off. */
export const leafAngle = q => (80 * Math.abs(q)) / (Math.abs(q) + 5);

/** Touch object `which` to the electroscope knob: they share the charge. Returns the charge passed. */
export function touchElectroscope(s, which) {
  const key = which === 2 ? "q2" : "q1";
  const total = s[key] + s.qe;
  const qe = Math.trunc(total / 2);
  const moved = qe - s.qe;
  s.qe = qe;
  s[key] = total - qe;
  return moved;
}

export const totalCharge = s => s.q1 + s.q2 + s.qc + s.qe;

/** Keep forged charges whole and inside ±QMAX, and `use` at 1 or 2. */
export function tidy(s) {
  for (const k of ["q1", "q2", "qc", "qe"]) s[k] = Math.max(-QMAX, Math.min(QMAX, Math.round(s[k]) || 0));
  s.use = s.use === 2 ? 2 : 1;
  if (!["", "+", "-"].includes(s.guess)) s.guess = "";
  return s;
}
