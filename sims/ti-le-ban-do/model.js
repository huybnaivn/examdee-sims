// Map scale. An invented town, 1000 m × 500 m. Real positions are in metres (x to the east, y to the
// south from the north-west corner); lengths on the map are in centimetres.
// Scale 1 : N means 1 cm on the map stands for N cm in reality.

export const TOWN = { w: 1000, h: 500 };
export const SCALES = [5000, 10000, 20000, 25000];
export const PLACES = [
  { id: "school", name: "Trường học", short: "Trường", x: 100, y: 100 },
  { id: "post", name: "Bưu điện", short: "B.điện", x: 500, y: 100 },
  { id: "market", name: "Chợ", short: "Chợ", x: 900, y: 100 },
  { id: "home", name: "Nhà Lan", short: "Nhà Lan", x: 100, y: 400 },
  { id: "park", name: "Công viên", short: "C.viên", x: 500, y: 400 },
  { id: "hospital", name: "Bệnh viện", short: "B.viện", x: 900, y: 400 },
];
export const place = id => PLACES.find(p => p.id === id);

const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

/** Length on the map (cm) of a real distance (m): real : N, after turning metres into centimetres. */
export const mapLength = (realM, denom) => (realM * 100) / denom;
/** Real distance (m) of a length on the map (cm): map × N, then centimetres into metres. */
export const realDistance = (mapCm, denom) => (mapCm * denom) / 100;
export const realBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** The scale bar is always 2 cm long on the map, with a mark at 1 cm. */
export function scaleBar(denom) {
  return { cm: 2, metres: realDistance(2, denom), half: realDistance(1, denom) };
}

export const denominator = s => (SCALES.includes(s.scale) ? s.scale : 10000);

/** Both ends of the ruler, in metres, kept inside the town (state can be forged). */
export const ends = s => ({
  a: { x: num(s.ax, 0, TOWN.w), y: num(s.ay, 0, TOWN.h) },
  b: { x: num(s.bx, 0, TOWN.w), y: num(s.by, 0, TOWN.h) },
});

/**
 * What the ruler shows. It is read to the nearest millimetre, as a real ruler is, and the real distance is
 * worked out from that reading; `exact` says whether the reading is the true length (then nothing is rounded).
 */
export function measure(s) {
  const denom = denominator(s);
  const { a, b } = ends(s);
  const real = realBetween(a, b);
  const mapExact = mapLength(real, denom);
  const mm = Math.round(mapExact * 10);
  return {
    denom,
    real, // true distance, m
    mapExact, // cm
    mapRead: mm / 10, // cm, as read on the ruler
    realCm: (mm * denom) / 10, // the reading × N, cm
    realFromReading: (mm * denom) / 1000, // m
    exact: Math.abs(mapExact * 10 - mm) < 1e-6,
  };
}

/** The nearest landmark within `tol` metres of a point, if any. */
export function snapPlace(x, y, tol) {
  const d = p => Math.hypot(p.x - x, p.y - y);
  const best = PLACES.reduce((a, b) => (d(b) < d(a) ? b : a));
  return d(best) <= tol ? best : null;
}

// ---------- practice ----------
// ["real": map length given, real distance asked | "map": the other way, scale, from, to]
const QUESTIONS = [
  ["real", 10000, "school", "post"],
  ["map", 20000, "home", "post"],
  ["real", 5000, "post", "park"],
  ["map", 10000, "school", "park"],
  ["real", 20000, "school", "market"],
  ["map", 5000, "home", "park"],
  ["real", 25000, "post", "hospital"],
  ["map", 25000, "market", "park"],
];
export const QUESTION_COUNT = QUESTIONS.length;
const index = i => ((Math.round(Number.isFinite(i) ? i : 0) % QUESTION_COUNT) + QUESTION_COUNT) % QUESTION_COUNT;

export function question(i) {
  const [type, denom, from, to] = QUESTIONS[index(i)];
  const real = realBetween(place(from), place(to));
  const map = mapLength(real, denom);
  return { type, denom, from, to, real, map, answer: type === "real" ? real : map };
}

export const initialState = () => ({
  mode: "measure", // "measure" | "practice"
  scale: 5000, // N of the scale 1 : N
  from: "school", // landmark under end A of the ruler, or "free"
  to: "park",
  ax: 100, // ruler ends, metres
  ay: 100,
  bx: 500,
  by: 400,
  showGrid: true,
  qIndex: 0,
  answerM: 0, // answer in metres (map → real)
  answerCm: 0, // answer in centimetres (real → map)
  status: "", // "" | "right" | "wrong"
  solved: 0,
});

/** Put the ruler end `which` ("a" | "b") on a landmark. */
export function putOn(s, which, id) {
  const p = place(id);
  if (!p) return s;
  s[`${which}x`] = p.x;
  s[`${which}y`] = p.y;
  return s;
}

export function startQuestion(s) {
  const q = question(s.qIndex);
  s.scale = q.denom;
  s.from = q.from;
  s.to = q.to;
  putOn(s, "a", q.from);
  putOn(s, "b", q.to);
  s.answerM = 0;
  s.answerCm = 0;
  s.status = "";
  return s;
}

export function nextQuestion(s) {
  s.qIndex = index(s.qIndex + 1);
  return startQuestion(s);
}

export function isCorrect(s) {
  const q = question(s.qIndex);
  return Math.abs((q.type === "real" ? s.answerM : s.answerCm) - q.answer) < 1e-6;
}
