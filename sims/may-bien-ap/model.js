// Ideal transformer (no losses) and power transmission over a resistive line (cos φ = 1).

export const LINE_POWER = 500e3; // W, power the station sends, fixed

export const initialState = () => ({
  part: "transformer", // which panel the controls (and a small stage) show: "transformer" | "line"
  u1: 220, // V, primary voltage (RMS)
  n1: 1000, // primary turns
  n2: 500, // secondary turns
  load: 55, // Ω, resistance of the load on the secondary
  lineR: 10, // Ω, total resistance of the line (both wires)
  lineU: 10, // kV, transmission voltage at the station
});

/** U₁/U₂ = N₁/N₂ and U₁I₁ = U₂I₂ (ideal). */
export function transformer(s) {
  const n1 = Math.max(1, s.n1);
  const n2 = Math.max(1, s.n2);
  const load = Math.max(1e-3, s.load);
  const u2 = (s.u1 * n2) / n1;
  const i2 = u2 / load;
  const p2 = u2 * i2;
  const i1 = p2 / s.u1; // = i2·N₂/N₁
  const kind = n2 > n1 ? "step-up" : n2 < n1 ? "step-down" : "none";
  return { ratio: n1 / n2, u2, i2, p2, i1, p1: s.u1 * i1, kind };
}

/** Line loss P_hp = R·P²/U², efficiency H = (P − P_hp)/P. */
export function transmission(s, power = LINE_POWER) {
  const u = Math.max(1e-3, s.lineU) * 1e3; // kV → V
  const r = Math.max(0, s.lineR);
  const current = power / u;
  const loss = Math.min(power, r * current * current); // = R·P²/U², never more than is sent
  const efficiency = (power - loss) / power;
  return { power, current, loss, delivered: power - loss, efficiency, drop: current * r };
}
