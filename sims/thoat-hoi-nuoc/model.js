// Transpiration of a leafy shoot measured with a potometer. A simple, documented model (not a fitted one):
//
//   opening       a = L / (L + 25)                   L: light, % of full sunlight; a = 0 in the dark (stomata closed)
//   vapour gap    D = e_s(T) · (1 − RH)              e_s(T) = 0,6108·exp(17,27·T / (T + 237,3)) kPa (Tetens)
//   boundary      g_b = 0,5·√(v + 0,25)              v: wind speed, m/s (wind thins the still air layer over the leaf)
//   each surface  g = 1 / (1/(f·a) + 1/g_b)          f: share of the stomata on that surface, upper 0,25, lower 0,75
//   rate          E = 8 · D · Σ g   (mm³/phút)       over the surfaces not covered with vaseline
//
// Water lost through the cuticle is ignored, so E = 0 when the stomata are closed. The shoot is assumed to take up
// as much water as it transpires, so the bubble in the capillary moves x = E·t / S, S the tube cross-section.

export const TUBE_DIAMETER = 1; // mm
export const TUBE_AREA = Math.PI * (TUBE_DIAMETER / 2) ** 2; // mm²
export const TUBE_LENGTH = 150; // mm of scale
export const MINUTES_PER_SECOND = 0.5; // simulated minutes per real second
export const SHARE = { upper: 0.25, lower: 0.75 };
export const RANGES = { light: [0, 100], temperature: [10, 40], humidity: [20, 100], wind: [0, 5] };

export const initialState = () => ({
  light: 80, // %
  temperature: 25, // °C
  humidity: 60, // %
  wind: 1, // m/s
  cover: "none", // none | upper | lower | both
  period: 5, // minutes
  t: 2.5, // minutes since the bubble was reset
  quiz: false,
  qLight: 50,
  qTemperature: 20,
  qHumidity: 80,
  qWind: 1,
  answer: "light",
});

export const saturation = T => 0.6108 * Math.exp((17.27 * T) / (T + 237.3)); // kPa
export const deficit = (T, RH) => saturation(T) * (1 - RH / 100); // kPa
export const opening = L => (L <= 0 ? 0 : L / (L + 25));
export const boundary = v => 0.5 * Math.sqrt(v + 0.25);

const clampTo = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

/** Transpiration (= uptake) rate, mm³ per minute. */
export function rate({ light, temperature, humidity, wind, cover = "none" }) {
  const a = opening(clampTo(light, RANGES.light));
  if (a === 0) return 0;
  const gb = boundary(clampTo(wind, RANGES.wind));
  let g = 0;
  for (const side of ["upper", "lower"]) {
    if (cover === side || cover === "both") continue;
    g += 1 / (1 / (SHARE[side] * a) + 1 / gb);
  }
  return 8 * deficit(clampTo(temperature, RANGES.temperature), clampTo(humidity, RANGES.humidity)) * g;
}

/** Distance the bubble moves (mm) after `minutes` at rate E (mm³/phút). */
export const bubbleDistance = (E, minutes) => (E * minutes) / TUBE_AREA;

/** Minutes the current measurement lasts: the chosen period, or less if the bubble would leave the scale. */
export const measureTime = s => {
  const E = rate(s);
  return E > 0 ? Math.min(s.period, (TUBE_LENGTH * TUBE_AREA) / E) : s.period;
};

// Quiz: from the baseline conditions, which one change raises the rate most?
export const QUIZ_CHANGES = {
  light: { key: "light", delta: 20, text: "Tăng ánh sáng thêm 20 %" },
  temperature: { key: "temperature", delta: 5, text: "Tăng nhiệt độ thêm 5 °C" },
  humidity: { key: "humidity", delta: -10, text: "Giảm độ ẩm không khí 10 %" },
  wind: { key: "wind", delta: 1, text: "Tăng tốc độ gió thêm 1 m/s" },
};
export const FACTOR_CODE = { light: 0, temperature: 1, humidity: 2, wind: 3 };

export const baseline = s => ({
  light: clampTo(s.qLight, RANGES.light),
  temperature: clampTo(s.qTemperature, RANGES.temperature),
  humidity: clampTo(s.qHumidity, RANGES.humidity),
  wind: clampTo(s.qWind, RANGES.wind),
});

/** Rate increase (mm³/phút) each quiz change gives from the baseline. */
export function quizEffects(s) {
  const base = baseline(s);
  const E0 = rate(base);
  const out = {};
  for (const [name, c] of Object.entries(QUIZ_CHANGES)) {
    out[name] = rate({ ...base, [c.key]: clampTo(base[c.key] + c.delta, RANGES[c.key]) }) - E0;
  }
  return out;
}

export const strongest = s => Object.entries(quizEffects(s)).sort((a, b) => b[1] - a[1])[0][0];

/** New quiz baseline, chosen so the answer is clear (best change ≥ 1,25 × the next). Copies it to the controls. */
export function newQuestion(s, random = Math.random) {
  const pick = (lo, hi, step) => lo + step * Math.floor(random() * ((hi - lo) / step + 1));
  // Choose the answer first so every factor comes up, then a baseline where it clearly wins.
  const want = Object.keys(QUIZ_CHANGES)[Math.floor(random() * 4)];
  for (let tries = 0; tries < 2000; tries++) {
    Object.assign(s, { qLight: pick(10, 80, 10), qTemperature: pick(10, 35, 5), qHumidity: pick(30, 90, 10), qWind: pick(0, 4, 1) });
    const e = Object.entries(quizEffects(s)).sort((a, b) => b[1] - a[1]);
    if (e[0][1] >= 1.25 * e[1][1] && (e[0][0] === want || tries > 1500)) break;
  }
  Object.assign(s, { light: s.qLight, temperature: s.qTemperature, humidity: s.qHumidity, wind: s.qWind, cover: "none", t: 0 });
  return s;
}
