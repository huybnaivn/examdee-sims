// Liquid thermometer and temperature scales.
// KHTN 6 uses T(K) = t(°C) + 273 (the exact offset is 273,15) and t(°F) = 1,8·t(°C) + 32.

export const K_OFFSET = 273; // textbook value; exactly 273,15
export const RANGE = [-20, 110]; // °C, the thermometer's scale (GHĐ)
export const DIVISION = 1; // °C, smallest division (ĐCNN)
export const QUIZ_RANGE = [-10, 100];

export const toF = c => 1.8 * c + 32;
export const fromF = f => (f - 32) / 1.8;
export const toK = c => c + K_OFFSET;
export const fromK = k => k - K_OFFSET;

// Fixed points of the Celsius scale (at normal atmospheric pressure).
export const FIXED = { ice: 0, steam: 100 };

export const SITUATIONS = {
  ice: { label: "Nước đá đang tan", c: 0 },
  body: { label: "Cơ thể người khỏe mạnh", c: 37 },
  summer: { label: "Một ngày hè nóng", c: 35 },
  boil: { label: "Nước đang sôi", c: 100 },
  custom: { label: "Tự chọn nhiệt độ", c: null },
};

export const initialState = () => ({
  mode: "explore", // "explore" | "quiz"
  situation: "body",
  tempC: 37, // °C shown in explore mode
  quizT: 23, // °C the quiz thermometer shows
  answer: 20, // °C the learner reads
  eye: "level", // "level" | "above" | "below": where the eye is, relative to the top of the liquid
  feedback: "", // "" | "ok" | "eye" | "value"
});

/** A reading rounded to the smallest division of the scale. */
export const snap = (t, div = DIVISION) => Math.round(t / div) * div;

// Parallax (illustrative model): looking from above, the line of sight through the top of the
// liquid meets the scale behind it lower down, so the reading is too low; from below, too high.
export const PARALLAX = { level: 0, above: -2, below: 2 }; // °C
export const apparent = (t, eye) => t + (PARALLAX[eye] ?? 0);

/** Quiz temperature: whole degrees in QUIZ_RANGE, from a random number r in [0, 1). */
export const quizTemp = r => QUIZ_RANGE[0] + Math.floor(Math.min(0.999999, Math.max(0, r)) * (QUIZ_RANGE[1] - QUIZ_RANGE[0] + 1));

export const quizOf = s => (Number.isFinite(s.quizT) ? Math.min(QUIZ_RANGE[1], Math.max(QUIZ_RANGE[0], snap(s.quizT))) : 23);

/** "ok" only for the right value read with the eye level with the liquid. */
export function check(answer, truth, eye) {
  if (eye !== "level") return "eye";
  return snap(answer) === snap(truth) ? "ok" : "value";
}

/** Temperature currently on the thermometer, °C. */
export const shownC = s => (s.mode === "quiz" ? quizOf(s) : Math.min(RANGE[1], Math.max(RANGE[0], Number.isFinite(s.tempC) ? s.tempC : 37)));
