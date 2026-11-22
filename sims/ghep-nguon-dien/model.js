// A bank of identical cells (emf E, internal resistance r) driving one external resistor R.
// Volts, ohms, amperes, watts.

export const R_STEP = 0.05; // Ω, step of the R slider; "found the maximum" means the nearest position

export const initialState = () => ({
  mode: "mixed", // "series" | "parallel" | "mixed"
  n: 3, // cells in series in each row
  m: 2, // rows in parallel
  emf: 1.5, // V, one cell
  r: 0.5, // Ω, one cell
  R: 3, // Ω, external resistor
  showGraph: true,
  atMax: false, // R currently sits at the maximum-power position (so the goal fires once per arrival)
});

/** Shape of the bank: `rows` equal rows in parallel, each of `perRow` cells in series. */
export function shape(s) {
  return {
    perRow: s.mode === "parallel" ? 1 : s.n,
    rows: s.mode === "series" ? 1 : s.m,
  };
}

/** E_b = n·E, r_b = n·r/m (series: m = 1, parallel: n = 1). */
export function bank(s) {
  const { perRow, rows } = shape(s);
  return { perRow, rows, emf: perRow * s.emf, r: (perRow * s.r) / rows };
}

/** Ohm's law for the whole circuit with an arbitrary external resistance. */
export function solveAt(s, R) {
  const b = bank(s);
  const current = b.emf / (R + b.r); // I = E_b / (R + r_b)
  const voltage = current * R; // U = I·R = E_b − I·r_b
  return {
    emfBank: b.emf,
    rBank: b.r,
    current,
    voltage,
    power: voltage * current, // delivered to R
    efficiency: b.emf > 0 ? voltage / b.emf : 0, // H = U / E_b = R / (R + r_b)
    short: R <= 0,
    cellCurrent: current / b.rows, // through each cell
  };
}

export const solve = s => solveAt(s, Math.max(0, s.R));

/** Largest power the bank can deliver: P_max = E_b² / (4·r_b), reached when R = r_b. */
export const maxPower = s => bank(s).emf ** 2 / (4 * bank(s).r);

/** True when R is the slider position nearest to r_b. */
export const atMaxPower = s => s.R > 0 && Math.abs(s.R - bank(s).r) <= R_STEP / 2 + 1e-9;
