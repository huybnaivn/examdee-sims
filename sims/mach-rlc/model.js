// Series RLC circuit driven by an AC source u = U√2·cos(ωt). U is the RMS (hiệu dụng) value.
// φ = φu − φi: φ > 0 the circuit is inductive (i lags u), φ < 0 capacitive (i leads u).

export const initialState = () => ({
  voltage: 100, // V, RMS
  frequency: 50, // Hz
  resistance: 40, // Ω
  inductance: 0.4, // H
  capacitance: 50, // µF
  useL: true,
  useC: true,
});

/** Everything the learner can read off, from the textbook formulas. */
export function solve(s) {
  const R = Math.max(1, s.resistance);
  const f = Math.max(1e-3, s.frequency);
  const L = Math.max(0, s.inductance);
  const C = Math.max(1e-3, s.capacitance) * 1e-6; // µF → F
  const omega = 2 * Math.PI * f;
  const zL = s.useL ? omega * L : 0;
  const zC = s.useC ? 1 / (omega * C) : 0;
  const x = zL - zC;
  const z = Math.sqrt(R * R + x * x);
  const current = s.voltage / z;
  const phi = Math.atan2(x, R); // rad, in (−π/2, π/2) since R > 0
  const cosPhi = R / z;
  const power = s.voltage * current * cosPhi; // = I²R
  const f0 = s.useL && s.useC && L > 0 ? 1 / (2 * Math.PI * Math.sqrt(L * C)) : NaN;
  return { R, omega, zL, zC, z, current, phi, cosPhi, power, f0, uR: current * R, uL: current * zL, uC: current * zC };
}

/** Resonance within `tol` of f₀ (relative). Needs both L and C in the circuit. */
export const atResonance = (s, tol = 0.01) => {
  const { f0 } = solve(s);
  return Number.isFinite(f0) && Math.abs(s.frequency - f0) <= tol * f0;
};

/** Instantaneous values at time t (s): u = U√2 cos ωt, i = I√2 cos(ωt − φ). */
export function instant(s, t) {
  const c = solve(s);
  return {
    u: s.voltage * Math.SQRT2 * Math.cos(c.omega * t),
    i: c.current * Math.SQRT2 * Math.cos(c.omega * t - c.phi),
  };
}
