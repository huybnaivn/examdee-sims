// Galvanic cell: two metals, each in a 1 M solution of its own ions, joined by a KNO₃ salt bridge (Hóa học 12).
//
// The metal with the more negative standard electrode potential is the anode (negative pole, oxidised);
// the other is the cathode (positive pole, its ions are reduced):
//   E°pin = E°catot − E°anot  (always ≥ 0)
// Running the cell through an external resistance R (internal resistance and concentration changes
// neglected) passes I = E°pin / R; after t seconds n(e) = I·t / F, the anode loses n(e)/z·M and the cathode
// gains n(e)/z·M of its own metal.
//
// Units: E in V, R in Ω, t in s, I in A, charge in C, masses in g.

export const F = 96485; // C/mol

// Standard electrode potentials at 25 °C (V), the values used in the lesson; molar masses as school values.
export const METALS = [
  { id: "Mg", name: "Magie", E: -2.37, z: 2, M: 24, ion: "Mg²⁺", salt: "MgSO₄" },
  { id: "Zn", name: "Kẽm", E: -0.763, z: 2, M: 65, ion: "Zn²⁺", salt: "ZnSO₄" },
  { id: "Fe", name: "Sắt", E: -0.44, z: 2, M: 56, ion: "Fe²⁺", salt: "FeSO₄" },
  { id: "Cu", name: "Đồng", E: 0.34, z: 2, M: 64, ion: "Cu²⁺", salt: "CuSO₄" },
  { id: "Ag", name: "Bạc", E: 0.799, z: 1, M: 108, ion: "Ag⁺", salt: "AgNO₃" },
];

export const initialState = () => ({
  left: "Zn",
  right: "Cu",
  R: 10, // Ω, external resistance
  duration: 3600, // s, the run stops by itself after this time
  t: 0, // s the circuit has been closed in this run
});

export const metal = id => METALS.find(m => m.id === id) ?? METALS[0];
export const metalIndex = id => METALS.indexOf(metal(id));

/** Roles and emf. With identical electrodes there is no anode or cathode and E = 0. */
export function cell(s) {
  const L = metal(s.left);
  const R = metal(s.right);
  const same = L.id === R.id;
  const leftIsAnode = L.E <= R.E;
  const anode = leftIsAnode ? L : R;
  const cathode = leftIsAnode ? R : L;
  const emf = same ? 0 : cathode.E - anode.E;
  return { anode, cathode, emf, same, anodeSide: leftIsAnode ? "left" : "right", current: emf / Math.max(1e-9, s.R) };
}

const e = z => (z === 1 ? "e" : `${z}e`);
const k = n => (n === 1 ? "" : `${n}`);
export const anodeHalf = m => `${m.id} → ${m.ion} + ${e(m.z)}`;
export const cathodeHalf = m => `${m.ion} + ${e(m.z)} → ${m.id}`;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** Overall reaction balanced on electrons, e.g. "Zn + 2Ag⁺ → Zn²⁺ + 2Ag". */
export function overall(a, c) {
  const l = (a.z * c.z) / gcd(a.z, c.z);
  const na = l / a.z;
  const nc = l / c.z;
  return `${k(na)}${a.id} + ${k(nc)}${c.ion} → ${k(na)}${a.ion} + ${k(nc)}${c.id}`;
}

/** What has happened after t seconds of current. */
export function run(s, t = s.t) {
  const c = cell(s);
  const time = Math.min(Math.max(0, Number.isFinite(t) ? t : 0), 1e6);
  const q = c.current * time;
  const ne = q / F;
  return { ...c, q, ne, anodeLoss: c.same ? 0 : (ne / c.anode.z) * c.anode.M, cathodeGain: c.same ? 0 : (ne / c.cathode.z) * c.cathode.M };
}

/** Advance the run; returns true on the step that reaches the set duration. */
export function step(s, dt) {
  if (s.t >= s.duration) return false;
  s.t = Math.min(s.duration, Math.max(0, s.t) + dt);
  return s.t >= s.duration;
}
