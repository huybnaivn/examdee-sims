// Chất điện li và độ dẫn điện (Hóa học 11, CT 2018). Pure logic.
//
// Conductivity model (documented, simplified):
//   κ = Σ cᵢ·λ°ᵢ + κ(nước)   – Kohlrausch's independent migration at infinite dilution, i.e. interionic
//   effects are ignored, so κ is overestimated at high concentration (≈ 15–30 % at 0,1–1 mol/L).
//   λ°ᵢ: limiting molar ionic conductivity at 25 °C, S·cm²/mol. With c in mol/L, κ [S/m] = 0,1·Σ cᵢλ°ᵢ.
//   Weak acid: α from Kₐ = C·α²/(1 − α) (water's own H⁺ ignored).
// Tester circuit: 6 V source, bulb 6 V – 3 W (R = 12 Ω, taken as constant), electrodes with cell
// constant d/A = 1 cm / 20 cm² = 5 m⁻¹, so R(dung dịch) = 5/κ. Brightness = P(đèn) / 3 W.

export const LAMBDA = { "H+": 349.6, "OH-": 199.1, "Na+": 50.1, "Cl-": 76.3, "Ca2+": 119.0, "CH3COO-": 40.9 };
export const KA_ACETIC = 1.75e-5; // CH₃COOH, 25 °C (pKₐ ≈ 4,76)
export const KAPPA_WATER = 5.5e-6; // S/m, pure water at 25 °C ([H⁺] = [OH⁻] = 10⁻⁷ mol/L)
export const U = 6; // V
export const R_BULB = 12; // Ω
export const P_RATED = (U * U) / R_BULB; // 3 W
export const CELL_CONSTANT = 5; // m⁻¹

// kind: "strong" (phân li hoàn toàn, →), "weak" (phân li một phần, ⇌), "none" (chất không điện li)
export const SOLUTIONS = [
  { id: "nacl", name: "Dung dịch NaCl", formula: "NaCl", kind: "strong", ions: [["Na+", 1], ["Cl-", 1]] },
  { id: "hcl", name: "Dung dịch HCl", formula: "HCl", kind: "strong", ions: [["H+", 1], ["Cl-", 1]] },
  { id: "naoh", name: "Dung dịch NaOH", formula: "NaOH", kind: "strong", ions: [["Na+", 1], ["OH-", 1]] },
  { id: "cacl2", name: "Dung dịch CaCl₂", formula: "CaCl2", kind: "strong", ions: [["Ca2+", 1], ["Cl-", 2]] },
  { id: "ch3cooh", name: "Dung dịch CH₃COOH", formula: "CH3COOH", kind: "weak", ka: KA_ACETIC, ions: [["CH3COO-", 1], ["H+", 1]] },
  { id: "saccarose", name: "Dung dịch saccharose", formula: "C12H22O11", kind: "none", ions: [] },
  { id: "ethanol", name: "Dung dịch ethanol", formula: "C2H5OH", kind: "none", ions: [] },
  { id: "water", name: "Nước cất", formula: "H2O", kind: "water", ions: [] },
];
export const solutionIndex = id => Math.max(0, SOLUTIONS.findIndex(x => x.id === id));
export const solutionById = id => SOLUTIONS[solutionIndex(id)];

export const LOG_C_MIN = -3;
export const LOG_C_MAX = 0;
export const initialState = () => ({ solution: "ch3cooh", logC: -1 });
/** Concentration in mol/L from the slider (log scale), clamped against forged state. */
export const concentration = s => 10 ** Math.min(LOG_C_MAX, Math.max(LOG_C_MIN, Number.isFinite(s.logC) ? s.logC : -1));

/** Degree of dissociation α (0..1). Weak acid: positive root of C·α² + Kₐ·α − Kₐ = 0. */
export function alpha(sol, C) {
  if (sol.kind === "strong") return 1;
  if (sol.kind !== "weak" || C <= 0) return 0;
  return (-sol.ka + Math.sqrt(sol.ka * sol.ka + 4 * sol.ka * C)) / (2 * C);
}

/** Ions per formula unit, e.g. CaCl₂ → 3. */
export const ionsPerUnit = sol => sol.ions.reduce((n, [, k]) => n + k, 0);

/** Molar concentration of each ion from the solute (mol/L). */
export const ionConcentrations = (sol, C) => sol.ions.map(([ion, k]) => ({ ion, c: k * alpha(sol, C) * C }));

/** Conductivity κ in S/m (model above). */
export const conductivity = (sol, C) => 0.1 * ionConcentrations(sol, C).reduce((k, { ion, c }) => k + c * LAMBDA[ion], 0) + KAPPA_WATER;

/** The tester: solution resistance, current, bulb power and brightness (0..1). */
export function tester(sol, C) {
  const kappa = conductivity(sol, C);
  const rSol = CELL_CONSTANT / kappa;
  const current = U / (R_BULB + rSol);
  const power = current * current * R_BULB;
  return { kappa, rSol, current, power, brightness: power / P_RATED };
}

export function measure(s) {
  const sol = solutionById(s.solution);
  const C = sol.kind === "water" ? 0 : concentration(s);
  return { sol, C, alpha: alpha(sol, C), ...tester(sol, C) };
}

// ---------- text ----------
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const SUP = { "+": "⁺", "-": "⁻", 2: "²", 3: "³" };
export const pretty = f => f.replace(/\d/g, d => SUB[d]);
/** "Ca2+" → "Ca²⁺", "CH3COO-" → "CH₃COO⁻" */
export const ionText = ion => {
  const m = ion.match(/^(.*?)(\d?)([+-])$/);
  return pretty(m[1]) + (m[2] ? SUP[m[2]] : "") + SUP[m[3]];
};
export function equation(sol) {
  if (sol.kind === "none") return `${pretty(sol.formula)}: không phân li ra ion (chất không điện li)`;
  if (sol.kind === "water") return "H₂O ⇌ H⁺ + OH⁻ (điện li rất yếu, coi như không dẫn điện)";
  const right = sol.ions.map(([ion, k]) => `${k > 1 ? k : ""}${ionText(ion)}`).join(" + ");
  return `${pretty(sol.formula)} ${sol.kind === "strong" ? "→" : "⇌"} ${right}`;
}
