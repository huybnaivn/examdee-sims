// Photosynthesis of a water plant (rong đuôi chó) measured as O₂ bubbles per minute.
//
// Model: Blackman's law of limiting factors. Each factor sets a ceiling on the rate and the
// rate is the lowest ceiling:
//   light:       R_L = 0,6 × I × e(colour)        I in % of the lamp's full intensity (0–100)
//   CO₂:         R_C = 80 × C                     C = NaHCO₃ concentration in the water, % (0–1)
//   temperature: R_T = 70 × g(T)                  g = 1 at the optimum 30 °C, asymmetric bell:
//                g(T) = exp(−((T − 30)/14)²) for T ≤ 30, exp(−((T − 30)/7)²) above
//                (slow rise, sharp drop-off as enzymes of the Calvin cycle lose activity)
//   rate = min(R_L, R_C, R_T)   in bubbles of O₂ per minute
// e(colour) is the relative photosynthetic effectiveness of the light, from the absorption of
// chlorophyll: red 1,00; blue-violet 0,90; white 0,80; green 0,25 (green is mostly reflected).
// The constants are illustrative, chosen so a bench experiment gives tens of bubbles per minute.

export const T_OPT = 30; // °C
export const COLOURS = {
  white: { label: "Trắng", eff: 0.8, css: "#fff3b0" },
  red: { label: "Đỏ", eff: 1.0, css: "#ff5a4e" },
  blue: { label: "Xanh tím", eff: 0.9, css: "#6b5cff" },
  green: { label: "Xanh lục", eff: 0.25, css: "#3fcf6a" },
};
export const FACTORS = ["ánh sáng", "nồng độ CO₂", "nhiệt độ"];
export const RANGES = { light: [0, 100], co2: [0, 1], temp: [0, 50] };

export const initialState = () => ({
  light: 50, // % of full lamp intensity
  co2: 0.5, // % NaHCO₃
  temp: 25, // °C
  colour: "white",
  plot: "light", // variable on the x axis of the graph: "light" | "co2" | "temp"
});

const num = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
export const efficiency = colour => (COLOURS[colour] ?? COLOURS.white).eff;
export const tempFactor = T => Math.exp(-(((T - T_OPT) / (T <= T_OPT ? 14 : 7)) ** 2));

/** The three ceilings [light, CO₂, temperature], bubbles/min. */
export const ceilings = s => [
  0.6 * num(s.light, RANGES.light) * efficiency(s.colour),
  80 * num(s.co2, RANGES.co2),
  70 * tempFactor(num(s.temp, RANGES.temp)),
];

/** Rate of photosynthesis (bubbles of O₂ per minute) and the index of the limiting factor. */
export function rate(s) {
  const c = ceilings(s);
  const limiting = c.indexOf(Math.min(...c));
  return { rate: c[limiting], limiting };
}

/** Rate as `key` sweeps its range with the other settings held: [[x, rate], ...]. */
export function curve(s, key, n = 120) {
  const [lo, hi] = RANGES[key];
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = lo + ((hi - lo) * i) / n;
    return [x, rate({ ...s, [key]: x }).rate];
  });
}
