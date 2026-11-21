// Parallel-plate capacitor, ideal (uniform field, no edge effects).
// Area S in cm², separation d in mm, voltages in V. solve() returns SI units: F, C, V, V/m, J.

export const EPS0 = 8.854e-12; // F/m
/** Relative permittivity ε of the dielectrics offered (typical textbook values). */
export const DIELECTRICS = { air: 1, paper: 2, mica: 6, glass: 7 };

export const initialState = () => ({
  area: 200, // cm²
  distance: 4, // mm
  dielectric: "air", // key of DIELECTRICS, or "custom"
  epsCustom: 4, // ε used when dielectric is "custom"
  voltage: 12, // V, battery
  connected: true, // battery connected to the plates
  charge: 0, // C, charge held on the plates while disconnected
});

/** Largest charge the controls can produce: ε = 10, S = 400 cm², d = 1 mm, U = 24 V. */
export const MAX_CHARGE = ((10 * EPS0 * 400e-4) / 1e-3) * 24;

export const epsilon = s => DIELECTRICS[s.dielectric] ?? s.epsCustom;

/** C = ε·ε₀·S/d, in farads. */
export const capacitance = s => (epsilon(s) * EPS0 * s.area * 1e-4) / (s.distance * 1e-3);

/**
 * Connected: U is the battery voltage and Q = C·U follows the capacitor.
 * Disconnected: Q stays what it was and U = Q/C.
 */
export function solve(s) {
  const C = capacitance(s);
  // charge has no control, so a restored state could carry any number: keep it physical.
  const held = Math.min(Math.max(s.charge, 0), MAX_CHARGE);
  const U = s.connected ? s.voltage : held / C;
  const Q = s.connected ? C * U : held;
  return { eps: epsilon(s), C, Q, U, E: U / (s.distance * 1e-3), W: (C * U * U) / 2 };
}

/** Connect or disconnect the battery. Disconnecting freezes the charge the plates have now. */
export function setConnected(s, connected) {
  if (!connected) s.charge = solve({ ...s, connected: true }).Q;
  s.connected = connected;
  return s;
}

/** Split a value in SI units into a readable number and prefix, e.g. 8.85e-11 -> { value: 88.5, prefix: "p" }. */
export function si(x) {
  const a = Math.abs(x);
  const steps = [["k", 1e3], ["", 1], ["m", 1e-3], ["µ", 1e-6], ["n", 1e-9]];
  const [prefix, f] = steps.find(([, f]) => a >= f) ?? (a === 0 ? ["", 1] : ["p", 1e-12]);
  return { value: x / f, prefix };
}

/** Charge one drawn sign stands for, in C: the smallest 1-2-5 step that needs at most `max` signs. */
export function signUnit(q, max) {
  for (let p = 1e-12; ; p *= 10) for (const m of [1, 2, 5]) if (p * m * max >= Math.abs(q)) return p * m;
}
