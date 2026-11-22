// Nuclear reactions, binding energy per nucleon and a fission chain reaction (Vật lí 12).
// Masses are ATOMIC masses in u (standard mass tables, rounded to 6 decimals). Because the charge
// number Z is conserved in every reaction handled here, the electron masses cancel and
// Δm of the atoms equals Δm of the nuclei.

export const U_MEV = 931.5; // MeV per u (1 u·c² = 931,5 MeV)
export const M_N = 1.008665; // u, neutron
export const M_H = 1.007825; // u, hydrogen-1 atom
export const FISSION_MEV = 200; // MeV released per U-235 fission, textbook round value

// react: offered in the reaction builder. Every nuclide with A ≥ 2 is a point of the binding-energy curve.
export const NUCLIDES = [
  { id: "n", sym: "n", A: 1, Z: 0, m: M_N, react: true, name: "neutron" },
  { id: "H1", sym: "H", A: 1, Z: 1, m: M_H, react: true, name: "proton" },
  { id: "H2", sym: "H", A: 2, Z: 1, m: 2.014102, react: true, name: "đơteri D" },
  { id: "H3", sym: "H", A: 3, Z: 1, m: 3.016049, react: true, name: "triti T" },
  { id: "He3", sym: "He", A: 3, Z: 2, m: 3.016029, react: true },
  { id: "He4", sym: "He", A: 4, Z: 2, m: 4.002603, react: true, name: "hạt α" },
  { id: "Li6", sym: "Li", A: 6, Z: 3, m: 6.015123, react: true },
  { id: "Li7", sym: "Li", A: 7, Z: 3, m: 7.016003, react: true },
  { id: "Be9", sym: "Be", A: 9, Z: 4, m: 9.012183, react: true },
  { id: "C12", sym: "C", A: 12, Z: 6, m: 12, react: true },
  { id: "N14", sym: "N", A: 14, Z: 7, m: 14.003074, react: true },
  { id: "O16", sym: "O", A: 16, Z: 8, m: 15.994915 },
  { id: "O17", sym: "O", A: 17, Z: 8, m: 16.999132, react: true },
  { id: "Ne20", sym: "Ne", A: 20, Z: 10, m: 19.99244 },
  { id: "Al27", sym: "Al", A: 27, Z: 13, m: 26.981538, react: true },
  { id: "Si28", sym: "Si", A: 28, Z: 14, m: 27.976927 },
  { id: "P30", sym: "P", A: 30, Z: 15, m: 29.978314, react: true },
  { id: "Ca40", sym: "Ca", A: 40, Z: 20, m: 39.962591 },
  { id: "Fe56", sym: "Fe", A: 56, Z: 26, m: 55.934936 },
  { id: "Ni62", sym: "Ni", A: 62, Z: 28, m: 61.928345 },
  { id: "Sr88", sym: "Sr", A: 88, Z: 38, m: 87.905612 },
  { id: "Kr92", sym: "Kr", A: 92, Z: 36, m: 91.926156, react: true },
  { id: "Sr94", sym: "Sr", A: 94, Z: 38, m: 93.915361, react: true },
  { id: "Sn120", sym: "Sn", A: 120, Z: 50, m: 119.902202 },
  { id: "Xe140", sym: "Xe", A: 140, Z: 54, m: 139.921646, react: true },
  { id: "Ba141", sym: "Ba", A: 141, Z: 56, m: 140.914411, react: true },
  { id: "W184", sym: "W", A: 184, Z: 74, m: 183.950931 },
  { id: "Pb208", sym: "Pb", A: 208, Z: 82, m: 207.976652 },
  { id: "U235", sym: "U", A: 235, Z: 92, m: 235.04393, react: true },
  { id: "U238", sym: "U", A: 238, Z: 92, m: 238.050788 },
];
export const nuclide = id => NUCLIDES.find(p => p.id === id) ?? null;
export const REACTANTS = NUCLIDES.filter(p => p.react);
export const CURVE = NUCLIDES.filter(p => p.A >= 2);

// Documented examples: a + b → c + d + extra·n
export const PRESETS = {
  dt: { a: "H2", b: "H3", c: "He4", d: "n", extra: 0 }, // 17,6 MeV
  dd: { a: "H2", b: "H2", c: "He3", d: "n", extra: 0 }, // 3,27 MeV
  pli: { a: "H1", b: "Li7", c: "He4", d: "He4", extra: 0 }, // 17,3 MeV
  an: { a: "He4", b: "N14", c: "O17", d: "H1", extra: 0 }, // −1,19 MeV, first artificial transmutation
  abe: { a: "He4", b: "Be9", c: "C12", d: "n", extra: 0 }, // 5,70 MeV, discovery of the neutron
  aal: { a: "He4", b: "Al27", c: "P30", d: "n", extra: 0 }, // −2,64 MeV, artificial radioactivity
  nli: { a: "n", b: "Li6", c: "H3", d: "He4", extra: 0 }, // 4,78 MeV
  fbk: { a: "n", b: "U235", c: "Ba141", d: "Kr92", extra: 3 }, // ≈ 173 MeV
  fxs: { a: "n", b: "U235", c: "Xe140", d: "Sr94", extra: 2 }, // ≈ 185 MeV
};

export const G_MAX = 12; // generations followed in the chain reaction
export const CAP = 5000; // fissions in one generation at which the run is stopped
export const NU = 2.5; // mean number of neutrons per fission in the model (2 or 3, equally likely)

export const initialState = () => ({
  mode: "reaction", // "reaction" | "curve" | "chain"
  preset: "dt",
  ...PRESETS.dt,
  nuclide: "Fe56",
  k: 1.3,
  n0: 20,
  seed: 1,
  gens: G_MAX, // generations shown so far (0 = only the first fissions)
});

/** Load an example with its last product left for the learner to find. */
export function loadPreset(s) {
  const p = PRESETS[s.preset];
  if (p) Object.assign(s, p, { d: "?" });
  return s;
}

const extraOf = s => Math.min(3, Math.max(0, Math.round(Number(s.extra) || 0)));

/** The particle that would close the reaction a + b → c + X + extra·n: its A, Z and table id (or null). */
export function missing(s) {
  const [a, b, c] = [s.a, s.b, s.c].map(nuclide);
  if (!a || !b || !c) return { A: NaN, Z: NaN, id: null };
  const A = a.A + b.A - c.A - extraOf(s);
  const Z = a.Z + b.Z - c.Z;
  return { A, Z, id: NUCLIDES.find(p => p.react && p.A === A && p.Z === Z)?.id ?? null };
}

/** Sums of A and Z on both sides. `complete` is false while the last product is unknown. */
export function balance(s) {
  const [a, b, c, d] = [s.a, s.b, s.c, s.d].map(nuclide);
  const complete = !!(a && b && c && d);
  const k = extraOf(s);
  const left = { A: (a?.A ?? 0) + (b?.A ?? 0), Z: (a?.Z ?? 0) + (b?.Z ?? 0) };
  const right = { A: (c?.A ?? 0) + (d?.A ?? 0) + k, Z: (c?.Z ?? 0) + (d?.Z ?? 0) };
  return { left, right, complete, okA: complete && left.A === right.A, okZ: complete && left.Z === right.Z, ok: complete && left.A === right.A && left.Z === right.Z };
}

/** Masses before and after (u), Δm (u) and W = Δm·c² (MeV; > 0 released). null unless A and Z are conserved. */
export function energy(s) {
  if (!balance(s).ok) return null;
  const [a, b, c, d] = [s.a, s.b, s.c, s.d].map(nuclide);
  const before = a.m + b.m;
  const after = c.m + d.m + extraOf(s) * M_N;
  return { before, after, dm: before - after, W: (before - after) * U_MEV };
}

/** Mass defect (u), binding energy (MeV) and binding energy per nucleon (MeV/nucleon). */
export function binding(p) {
  const dm = p.Z * M_H + (p.A - p.Z) * M_N - p.m;
  return { dm, W: dm * U_MEV, perNucleon: (dm * U_MEV) / p.A };
}
export const mostStable = () => CURVE.reduce((best, p) => (binding(p).perNucleon > binding(best).perNucleon ? p : best));

// ---------- chain reaction ----------
export const classify = k => (Math.abs(k - 1) < 1e-3 ? "critical" : k < 1 ? "subcritical" : "supercritical");
export const expected = (k, n0, g) => n0 * k ** g;
export const gensOf = s => Math.min(G_MAX, Math.max(0, Math.round(Number(s.gens) || 0)));
export const nextSeed = seed => (Math.imul((Number(seed) || 0) >>> 0, 1664525) + 1013904223) >>> 0;

let memo = { key: "", value: null };
/**
 * Fissions per generation, counts[0] = n0. Each fission frees 2 or 3 neutrons (mean NU); each neutron
 * causes one more fission with probability k/NU, so one fission leads to k fissions on average.
 * Fully determined by (seed, k, n0). Stops when the chain dies out, after G_MAX generations, or when a
 * generation passes CAP (`capped`).
 */
export function runChain(seed, k, n0) {
  const key = `${seed}|${k}|${n0}`;
  if (memo.key === key) return memo.value;
  // mulberry32: a different generator from nextSeed, so consecutive seeds give unrelated runs
  let state = (Number(seed) || 0) >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = Math.imul(state ^ (state >>> 15), state | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 2 ** 32;
  };
  const p = Math.min(1, Math.max(0, (Number(k) || 0) / NU));
  const counts = [Math.min(CAP, Math.max(0, Math.round(Number(n0) || 0)))];
  let capped = false;
  while (counts.length <= G_MAX && counts.at(-1) > 0 && !capped) {
    let next = 0;
    for (let i = 0; i < counts.at(-1); i++) {
      const neutrons = rand() < 0.5 ? 2 : 3;
      for (let j = 0; j < neutrons; j++) if (rand() < p) next++;
    }
    counts.push(next);
    capped = next > CAP;
  }
  memo = { key, value: { counts, capped } };
  return memo.value;
}

/** What the learner sees after `gens` generations: counts so far, total fissions, whether the run is over. */
export function chainView(s) {
  const run = runChain(s.seed, s.k, s.n0);
  const last = run.counts.length - 1;
  const g = Math.min(gensOf(s), last);
  const counts = run.counts.slice(0, g + 1);
  return { counts, all: run.counts, generations: g, fissions: counts.reduce((a, b) => a + b, 0), done: g >= last, capped: run.capped && g >= last };
}

export const GEN_TIME = 0.5; // s of animation per generation
/** Advance the chain animation. Returns true on the step that finishes the run. */
export function step(s, dt) {
  if (chainView(s).done) return false;
  s._clock = (s._clock || 0) + dt;
  if (s._clock < GEN_TIME) return false;
  s._clock = 0;
  s.gens = gensOf(s) + 1;
  return chainView(s).done;
}
