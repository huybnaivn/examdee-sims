// Heat engine: n mol of ideal gas taken around a closed cycle on the p–V diagram.
// Units: V in litres, p in kPa, so p·V is in joules (1 kPa·L = 1 J). T in kelvin.
//
// "carnot": 1→2 isothermal expansion at T₁ (V from vMin to vMax), 2→3 adiabatic expansion to T₂,
//           3→4 isothermal compression at T₂, 4→1 adiabatic compression back to T₁.
// "rect":   1→2 isochoric heating at vMin, 2→3 isobaric expansion to vMax (reaching T₁),
//           3→4 isochoric cooling at vMax, 4→1 isobaric compression (back to T₂ at vMin).
//           T₁ and T₂ are the hottest and the coldest states of the cycle.

export const R = 8.314; // J/(mol·K)
export const N_MOL = 0.1; // mol of gas
export const GAMMA = { mono: 5 / 3, di: 7 / 5 }; // Cp/Cv: monatomic, diatomic
export const LEG_TIME = 1.5; // s of animation per process
export const LIMITS = { tHot: [400, 1000], tCold: [200, 390], vMin: [1, 4], vMax: [1.5, 8] };

export const initialState = () => ({
  cycle: "carnot",
  gas: "mono",
  tHot: 600, // K
  tCold: 300, // K
  vMin: 1.5, // L
  vMax: 4, // L
  phase: 0.6, // position in the cycle: leg index + fraction, 0 ≤ phase < 4
  cycles: 0, // completed cycles since the last change
});

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const nR = N_MOL * R; // J/K

/** Inputs, clamped (forged state must not break the model). */
function inputs(s) {
  const T1 = clamp(s.tHot, LIMITS.tHot);
  const T2 = Math.min(clamp(s.tCold, LIMITS.tCold), T1 - 10);
  const Va = clamp(s.vMin, LIMITS.vMin);
  const Vb = Math.max(clamp(s.vMax, LIMITS.vMax), Va + 0.5);
  return { T1, T2, Va, Vb, g: GAMMA[s.gas] ?? GAMMA.mono };
}

export const temperature = pt => (pt.p * pt.V) / nR;
export const carnotEfficiency = (T1, T2) => 1 - T2 / T1;

/** Work done BY the gas on one leg, J. */
function legWork(kind, a, b, g) {
  if (kind === "isoT") return nR * temperature(a) * Math.log(b.V / a.V);
  if (kind === "adia") return (a.p * a.V - b.p * b.V) / (g - 1); // = −ΔU
  if (kind === "isoP") return a.p * (b.V - a.V);
  return 0; // isoV
}

/** The whole cycle, or null when the chosen numbers cannot make one (rectangle with p_high ≤ p_low). */
export function cycle(s) {
  const { T1, T2, Va, Vb, g } = inputs(s);
  const at = (V, T) => ({ V, p: (nR * T) / V });
  let pts, kinds;
  if (s.cycle === "rect") {
    const pHi = (nR * T1) / Vb; // hottest state: (vMax, pHi)
    const pLo = (nR * T2) / Va; // coldest state: (vMin, pLo)
    if (!(pHi > pLo * 1.001)) return null;
    pts = [{ V: Va, p: pLo }, { V: Va, p: pHi }, { V: Vb, p: pHi }, { V: Vb, p: pLo }];
    kinds = ["isoV", "isoP", "isoV", "isoP"];
  } else {
    const k = (T1 / T2) ** (1 / (g - 1)); // adiabat: T·V^(γ−1) = const
    pts = [at(Va, T1), at(Vb, T1), at(Vb * k, T2), at(Va * k, T2)];
    kinds = ["isoT", "adia", "isoT", "adia"];
  }
  const cv = R / (g - 1); // molar heat capacity at constant volume
  const legs = kinds.map((kind, i) => {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const dU = N_MOL * cv * (temperature(b) - temperature(a));
    const W = legWork(kind, a, b, g);
    return { kind, a, b, g, dU, W, Q: dU + W };
  });
  const Q1 = legs.reduce((sum, l) => sum + Math.max(0, l.Q), 0);
  const Q2 = legs.reduce((sum, l) => sum + Math.max(0, -l.Q), 0);
  const W = legs.reduce((sum, l) => sum + l.W, 0);
  return { legs, pts, T1, T2, Q1, Q2, W, eta: W / Q1, carnot: carnotEfficiency(T1, T2) };
}

/** State of the gas a fraction u (0..1) along a leg. */
export function pointAt(leg, u) {
  const { kind, a, b, g } = leg;
  if (kind === "isoV") return { V: a.V, p: a.p + u * (b.p - a.p) };
  const V = a.V + u * (b.V - a.V);
  if (kind === "isoP") return { V, p: a.p };
  if (kind === "isoT") return { V, p: (a.p * a.V) / V };
  return { V, p: a.p * (a.V / V) ** g }; // adiabatic: p·V^γ = const
}

/** Advance the animation. Returns true when a cycle was just completed. */
export function step(s, dt) {
  const phase = (Number.isFinite(s.phase) ? s.phase : 0) + dt / LEG_TIME;
  s.phase = ((phase % 4) + 4) % 4;
  if (phase >= 4) {
    s.cycles = Math.max(0, Math.floor(s.cycles) || 0) + 1;
    return true;
  }
  return false;
}

/** Where the animation is: leg index and fraction along it. */
export function where(s) {
  const phase = ((s.phase % 4) + 4) % 4 || 0;
  const i = Math.min(3, Math.floor(phase));
  return { i, u: phase - i };
}
