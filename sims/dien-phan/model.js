// Electrolysis of aqueous solutions (Hóa học 12, chương trình 2018).
// Amounts follow Faraday's law, n(e) = I·t / F; gas volumes are at standard conditions (25 °C, 1 bar).

export const F = 96485; // C/mol, Faraday constant
export const VM = 24.79; // L/mol, molar volume of a gas at 25 °C and 1 bar (điều kiện chuẩn)
export const A_CU = 64; // g/mol, school value for copper
export const VOLUME = 0.2; // L of solution

export const SETUPS = [
  { id: "cuso4-inert", label: "CuSO₄, điện cực trơ" },
  { id: "cuso4-copper", label: "CuSO₄, anode bằng đồng" },
  { id: "nacl-membrane", label: "NaCl, có màng ngăn" },
  { id: "nacl-open", label: "NaCl, không có màng ngăn" },
];

export const initialState = () => ({
  setup: "cuso4-inert",
  conc: 0.5, // mol/L of the salt at the start
  current: 2, // A
  duration: 1800, // s, the run stops by itself after this time
  t: 0, // s of electrolysis so far
});

/** Faraday's law: m = A·I·t / (n·F), in grams. */
export const faradayMass = (A, I, t, n) => (A * I * t) / (n * F);

/** Volume of a gas at standard conditions (L) from its amount (mol). */
export const gasVolume = mol => mol * VM;

const num = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

/**
 * Everything produced after `t` seconds. Amounts in mol, masses in g, volumes in L.
 * Stage 1 uses up the ion that is discharged first; stage 2 is electrolysis of water.
 */
export function electrolyze(s, t = s.t) {
  const setup = SETUPS.some(x => x.id === s.setup) ? s.setup : SETUPS[0].id;
  const conc = num(s.conc, 0, 10, 0);
  const I = num(s.current, 0, 100, 0);
  const time = num(t, 0, 1e6, 0);
  const q = I * time;
  const ne = q / F;
  const n0 = conc * VOLUME; // mol of salt at the start
  const r = { setup, q, ne, n0, stage: 1, cu: 0, cuDissolved: 0, h2: 0, o2: 0, cl2: 0, cl2Formed: 0, h2so4: 0, naoh: 0, naclo: 0, cuLeft: 0, clLeft: 0 };

  if (setup === "cuso4-inert") {
    // cathode: Cu²⁺ + 2e → Cu, then 2H₂O + 2e → H₂ + 2OH⁻; anode: 2H₂O → O₂ + 4H⁺ + 4e
    r.cu = Math.min(ne / 2, n0);
    r.h2 = (ne - 2 * r.cu) / 2;
    r.o2 = ne / 4;
    r.h2so4 = r.cu; // 2CuSO₄ + 2H₂O → 2Cu + O₂ + 2H₂SO₄
    r.cuLeft = n0 - r.cu;
    r.stage = ne > 2 * n0 ? 2 : 1;
  } else if (setup === "cuso4-copper") {
    // cathode: Cu²⁺ + 2e → Cu; anode: Cu → Cu²⁺ + 2e. The solution keeps its Cu²⁺.
    r.cu = ne / 2;
    r.cuDissolved = ne / 2;
    r.cuLeft = n0;
  } else {
    // cathode: 2H₂O + 2e → H₂ + 2OH⁻ (Na⁺ is not discharged in water); anode: 2Cl⁻ → Cl₂ + 2e, then water.
    const open = setup === "nacl-open";
    // Without a membrane, Cl₂ + 2NaOH → NaCl + NaClO + H₂O gives one Cl⁻ back per Cl₂, so Cl⁻ lasts twice as long.
    const eStage1 = open ? 2 * n0 : n0;
    const e1 = Math.min(ne, eStage1);
    r.h2 = ne / 2;
    r.cl2Formed = e1 / 2;
    r.o2 = (ne - e1) / 4;
    if (open) {
      r.naclo = r.cl2Formed;
      r.clLeft = n0 - e1 / 2;
    } else {
      r.cl2 = r.cl2Formed;
      r.naoh = e1;
      r.clLeft = n0 - e1;
    }
    r.stage = ne > eStage1 ? 2 : 1;
  }
  r.cathodeMass = r.cu * A_CU; // g gained by the cathode
  r.anodeMass = -r.cuDissolved * A_CU; // g gained by the anode (negative: it dissolves)
  r.gasCathode = gasVolume(r.h2);
  r.gasAnode = gasVolume(r.o2 + r.cl2);
  r.eCathode = 2 * r.cu + 2 * r.h2; // mol e taken at the cathode
  r.eAnode = 4 * r.o2 + 2 * r.cl2Formed + 2 * r.cuDissolved; // mol e given at the anode
  return r;
}

/** Species discharged at each electrode, and the half-reaction, for a setup and stage. */
export function discharged(setup, stage = 1) {
  const water = { cathode: { species: "H2O", eq: "2H₂O + 2e → H₂ + 2OH⁻" }, anode: { species: "H2O", eq: "2H₂O → O₂ + 4H⁺ + 4e" } };
  if (setup === "cuso4-copper") return { cathode: { species: "Cu2+", eq: "Cu²⁺ + 2e → Cu" }, anode: { species: "Cu", eq: "Cu → Cu²⁺ + 2e" } };
  if (setup === "cuso4-inert") return stage === 1 ? { cathode: { species: "Cu2+", eq: "Cu²⁺ + 2e → Cu" }, anode: water.anode } : water;
  return stage === 1 ? { cathode: water.cathode, anode: { species: "Cl-", eq: "2Cl⁻ → Cl₂ + 2e" } } : water;
}

/** Advance the run; returns true on the step that reaches the set duration. */
export function step(s, dt) {
  if (s.t >= s.duration) return false;
  s.t = Math.min(s.duration, s.t + dt);
  return s.t >= s.duration;
}
