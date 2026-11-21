// Resistance of a uniform wire, R = ρ·l/S, optionally at a temperature t: R = R₀(1 + α(t − t₀)).
// The wire is across an ideal source U with an ideal ammeter in series, so I = U/R.
// Lengths in m, cross-section in mm² (state) / m² (formulas), ρ in Ω·m, α in 1/K.

export const T0 = 20; // °C, temperature at which the resistivities below are given

// Resistivity at 20 °C and temperature coefficient, values as tabulated in school textbooks.
export const MATERIALS = [
  { key: "copper", name: "Đồng", rho: 1.7e-8, alpha: 4.3e-3, color: "#c8743a" },
  { key: "aluminium", name: "Nhôm", rho: 2.8e-8, alpha: 4.4e-3, color: "#a9b3c1" },
  { key: "iron", name: "Sắt", rho: 12.0e-8, alpha: 6.5e-3, color: "#5d6470" },
  { key: "nichrome", name: "Nicrom", rho: 1.1e-6, alpha: 0.4e-3, color: "#8c8f7a" },
  { key: "constantan", name: "Constantan", rho: 0.5e-6, alpha: 0.01e-3, color: "#b49a6e" },
];

export const initialState = () => ({
  material: "nichrome",
  length: 2, // m
  area: 0.5, // mm², cross-section S
  voltage: 3, // V
  useTemp: false, // take the temperature of the wire into account
  temperature: 20, // °C
});

export const materialIndex = s => Math.max(0, MATERIALS.findIndex(m => m.key === s.material));
export const materialOf = s => MATERIALS[materialIndex(s)];

/** R₀ = ρ·l/S at 20 °C, in Ω. */
export const resistance0 = (rho, length, areaMm2) => (rho * length) / (areaMm2 * 1e-6);

/** R = R₀(1 + α(t − t₀)). */
export const atTemperature = (r0, alpha, t) => r0 * (1 + alpha * (t - T0));

/** Everything shown: ρ, R₀, R (at the wire temperature when useTemp), I = U/R, wire diameter d (mm). */
export function solve(s) {
  const m = materialOf(s);
  const r0 = resistance0(m.rho, s.length, s.area);
  const t = s.useTemp ? s.temperature : T0;
  const r = atTemperature(r0, m.alpha, t);
  return { material: m, index: materialIndex(s), rho: m.rho, r0, r, t, current: s.voltage / r, diameter: Math.sqrt((4 * s.area) / Math.PI) };
}
