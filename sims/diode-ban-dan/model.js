// Semiconductor diode: I–U characteristic (Shockley equation) in a DC circuit E – R – D,
// and rectification of a sine voltage with a constant-voltage-drop (piecewise) model.
// Volts, amperes, ohms, seconds.

export const VT = 0.026; // thermal voltage kT/q at about 27 °C (V)
export const I_REF = 0.01; // the threshold U_ng is defined as the voltage where I = 10 mA (A)
export const I_ON = 0.001; // the diode counts as "conducting" from 1 mA (A)

// Illustrative table, typical values for small diodes and 5 mm LEDs (not datasheet values).
// uth: threshold voltage U_ng (V), n: ideality factor of the Shockley equation.
export const DIODES = {
  si: { name: "Điốt silic (Si)", uth: 0.7, n: 1, color: "#6b7890" },
  ge: { name: "Điốt gemani (Ge)", uth: 0.3, n: 1, color: "#8a6d3b" },
  red: { name: "LED đỏ", uth: 1.8, n: 2, color: "#e5484d" },
  yellow: { name: "LED vàng", uth: 2.0, n: 2, color: "#e0a800" },
  green: { name: "LED xanh lục", uth: 2.2, n: 2, color: "#1f9d6b" },
  blue: { name: "LED xanh lam", uth: 3.0, n: 2, color: "#2f6fed" },
  white: { name: "LED trắng", uth: 3.1, n: 2, color: "#9aa7bd" },
};

export const initialState = () => ({
  mode: "dc", // "dc": source E in series with R and the diode; "ac": sine source and rectifier
  diode: "si", // key of DIODES
  emf: 2, // V, DC source (negative = reverse bias)
  resistance: 100, // Ω, series resistor in DC mode
  rectifier: "half", // "half": one diode; "full": four-diode bridge
  amplitude: 10, // V, peak of the sine source
  phase: 0.3, // fraction of a period shown, 0..1
});

const type = s => DIODES[s.diode] ?? DIODES.si;

/** Saturation current chosen so that I(uth) = I_REF. */
export const saturation = d => I_REF / Math.expm1(d.uth / (d.n * VT));

/** Shockley equation I = Is·(e^(U/(n·VT)) − 1). Breakdown is not modelled. */
export function current(d, u) {
  return saturation(d) * Math.expm1(Math.min(u, d.uth + 1.5) / (d.n * VT));
}

/** Operating point of E – R – D: solves E = U + R·I(U) by bisection (the left side grows with U). */
export function operatingPoint(s) {
  const d = type(s);
  const E = s.emf;
  const R = Math.max(1, s.resistance);
  let lo = Math.min(E, 0);
  let hi = Math.max(E, 0);
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (mid + R * current(d, mid) > E) hi = mid;
    else lo = mid;
  }
  const u = (lo + hi) / 2;
  const i = current(d, u);
  return { u, i, uR: E - u, conducting: i >= I_ON };
}

/** Source voltage at phase x (fraction of a period). */
export const source = (s, x) => s.amplitude * Math.sin(2 * Math.PI * x);

/**
 * Rectifier output across the load, constant-drop model: a conducting diode has voltage uth,
 * a blocked one carries no current. Half-wave: one diode. Full-wave bridge: two diodes in series
 * conduct in each half-cycle, so u_out = |u| − 2·uth.
 */
export function rectified(s, u) {
  const drop = type(s).uth;
  if (s.rectifier === "full") return Math.max(0, Math.abs(u) - 2 * drop);
  return Math.max(0, u - drop);
}

/** Which diodes conduct at source voltage u. Half: [D]; bridge: [D1, D2, D3, D4]. */
export function conducting(s, u) {
  const on = rectified(s, u) > 0;
  if (s.rectifier !== "full") return [on];
  return [on && u > 0, on && u < 0, on && u < 0, on && u > 0];
}

/** Average output voltage over one period (numerical, 2000 samples). */
export function averageOutput(s) {
  const n = 2000;
  let sum = 0;
  for (let k = 0; k < n; k++) sum += rectified(s, source(s, (k + 0.5) / n));
  return sum / n;
}

export const PERIOD = 2; // s on screen for one cycle of the source (slowed down; a real mains cycle is 0,02 s)

export function step(s, dt) {
  // phase has no control, so a forged value is wrapped back into 0..1 here
  if (s.mode === "ac") s.phase = (((s.phase + dt / PERIOD) % 1) + 1) % 1;
  return s;
}
