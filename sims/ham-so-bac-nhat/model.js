// Two lines d₁: y = a₁x + b₁ and d₂: y = a₂x + b₂.

export const initialState = () => ({
  a1: 2,
  b1: -1,
  a2: 0.5,
  b2: 2,
  showSlope: true,
  task: 0,
  mx: 2, // point M for tasks 3 and 4
  my: 1,
  taskDone: false,
});

const EPS = 1e-9;
export const same = (u, v) => Math.abs(u - v) < EPS;

/** Angle α between the line and Ox, measured from the positive direction of Ox, 0° ≤ α < 180°, tan α = a. */
export function angleDeg(a) {
  const d = (Math.atan(a) * 180) / Math.PI;
  return d < 0 ? d + 180 : d;
}

// Codes sent to the host.
export const CODES = { "cat-nhau": 1, "song-song": 2, "trung-nhau": 3, "vuong-goc": 4 };
export const NAMES = { "cat-nhau": "cắt nhau", "song-song": "song song", "trung-nhau": "trùng nhau", "vuong-goc": "vuông góc (và cắt nhau)" };

/** Relative position of the two lines. "vuong-goc" is the special case of "cat-nhau" with a₁a₂ = −1. */
export function classify(a1, b1, a2, b2) {
  if (same(a1, a2)) return same(b1, b2) ? "trung-nhau" : "song-song";
  return same(a1 * a2, -1) ? "vuong-goc" : "cat-nhau";
}

/** Intersection point, or null when the lines are parallel or coincide. */
export function intersection(a1, b1, a2, b2) {
  if (same(a1, a2)) return null;
  const x = (b2 - b1) / (a1 - a2);
  return { x, y: a1 * x + b1 };
}

/** b of the line with slope a through (x0, y0). */
export const lineThrough = (x0, y0, a) => y0 - a * x0;

/** Slope of a line perpendicular to one with slope a (a ≠ 0). */
export const perpendicularSlope = a => (same(a, 0) ? NaN : -1 / a);

export const TASKS = [
  null,
  { text: "Làm cho d₂ song song với d₁", rel: "song-song", throughM: false },
  { text: "Làm cho d₂ vuông góc với d₁", rel: "vuong-goc", throughM: false },
  { text: "Tìm d₂ đi qua M, song song với d₁", rel: "song-song", throughM: true },
  { text: "Tìm d₂ đi qua M, vuông góc với d₁", rel: "vuong-goc", throughM: true },
];

export function taskMet(s) {
  const t = TASKS[s.task];
  if (!t) return false;
  if (classify(s.a1, s.b1, s.a2, s.b2) !== t.rel) return false;
  return !t.throughM || same(s.a2 * s.mx + s.b2, s.my);
}

/** "y = 2x − 1" in textbook notation; fmt formats numbers with a decimal comma. */
export function equation(a, b, fmt) {
  const n = v => fmt(Math.abs(v), 2);
  let t = same(a, 0) ? "" : same(a, 1) ? "x" : same(a, -1) ? "−x" : `${a < 0 ? "−" : ""}${n(a)}x`;
  if (!t) return `y = ${fmt(b, 2)}`;
  if (!same(b, 0)) t += ` ${b < 0 ? "−" : "+"} ${n(b)}`;
  return `y = ${t}`;
}
