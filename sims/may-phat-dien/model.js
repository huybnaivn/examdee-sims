// AC generator: a flat coil of N turns and area S turning at n rev/s in a uniform field B (Vật lí 12).
//
// With p pole pairs the flux through the coil goes through p cycles per revolution, so the angular
// frequency of the emf is ω = 2π·f with f = n·p. Taking the electrical angle α = ωt + φ between the
// coil's normal and B:
//   flux linkage   Φ = N·B·S·cos(ωt + φ)
//   emf            e = −dΦ/dt = E₀·sin(ωt + φ),  E₀ = N·B·S·ω
//   effective      E = E₀/√2
// With a commutator (DC generator) the brushes swap coil ends every half turn, so the output is |e|.
//
// Units: n in rev/s, S in cm² (converted to m²), B in T, φ in degrees, t in s, Φ in Wb, e in V.

export const initialState = () => ({
  n: 50, // rev/s (3000 rev/min)
  p: 1, // pole pairs
  turns: 100, // N
  area: 200, // cm²
  B: 0.2, // T
  phase: 0, // °, φ
  dc: false, // commutator instead of slip rings
  t: 0.003, // s, real time; opens with the coil at 54° so e, the lamp and the current are already visible
});

export const frequency = s => s.n * s.p; // Hz
export const omega = s => 2 * Math.PI * frequency(s); // rad/s, electrical
export const period = s => 1 / frequency(s); // s
export const fluxMax = s => s.turns * s.B * s.area * 1e-4; // Wb, N·B·S
export const E0 = s => fluxMax(s) * omega(s); // V
export const Eeff = s => E0(s) / Math.SQRT2; // V

const angle = (s, t) => omega(s) * t + (s.phase * Math.PI) / 180;
export const flux = (s, t = s.t) => fluxMax(s) * Math.cos(angle(s, t));
export const emf = (s, t = s.t) => E0(s) * Math.sin(angle(s, t));
/** What reaches the lamp: e through slip rings, |e| through a commutator. */
export const output = (s, t = s.t) => (s.dc ? Math.abs(emf(s, t)) : emf(s, t));

/** Mechanical angle of the coil (rad), the electrical angle divided by p. */
export const coilAngle = (s, t = s.t) => angle(s, t) / s.p;

/** Advance real time; wraps after a whole number of revolutions (about 1 s) so t stays small. */
export function step(s, dt) {
  const T = Math.max(1, Math.round(s.n)) / s.n;
  s.t = (((s.t + dt) % T) + T) % T; // also repairs a forged t (negative or huge)
  return s;
}
