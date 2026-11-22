// The eight planets on circular orbits around the Sun (good enough here: every eccentricity is below 0,21).
// a: semi-major axis (AU), period: sidereal orbital period (Earth years),
// diameter: equatorial diameter relative to Earth's (12 756 km). Rounded planetary fact-sheet values.
// type: "rock" (hành tinh đất đá) or "gas" (hành tinh khí). Listed from the Sun outwards.
export const PLANETS = [
  { name: "Sao Thủy", short: "Thủy", a: 0.387, period: 0.241, diameter: 0.383, type: "rock", color: "#9a8f86", start: 1.2 },
  { name: "Sao Kim", short: "Kim", a: 0.723, period: 0.615, diameter: 0.949, type: "rock", color: "#e0b45a", start: 4.0 },
  { name: "Trái Đất", short: "T. Đất", a: 1, period: 1, diameter: 1, type: "rock", color: "#2f6fed", start: 0.3 },
  { name: "Sao Hỏa", short: "Hỏa", a: 1.524, period: 1.881, diameter: 0.532, type: "rock", color: "#d0603a", start: 2.6 },
  { name: "Sao Mộc", short: "Mộc", a: 5.203, period: 11.86, diameter: 11.21, type: "gas", color: "#c9a27a", start: 5.3 },
  { name: "Sao Thổ", short: "Thổ", a: 9.537, period: 29.45, diameter: 9.45, type: "gas", color: "#cfb66d", start: 3.3 },
  { name: "Sao Thiên Vương", short: "T. Vương", a: 19.19, period: 84.02, diameter: 4.01, type: "gas", color: "#6fbfcf", start: 1.9 },
  { name: "Sao Hải Vương", short: "H. Vương", a: 30.07, period: 164.8, diameter: 3.88, type: "gas", color: "#4166d5", start: 4.6 },
];

export const DAYS_PER_YEAR = 365.25;
export const BELT = 2.7; // AU, middle of the asteroid belt between Mars and Jupiter
// Fixed shuffle for the quiz board, so a saved quiz reopens the same way.
export const QUIZ_ORDER = [5, 2, 7, 0, 6, 3, 1, 4];

export const initialState = () => ({
  time: 0, // years since start
  speed: 0.5, // simulated years per real second
  layout: "easy", // "easy" (dễ nhìn) | "scale" (đúng tỉ lệ khoảng cách)
  selected: 2, // planet index, -1 = none
  compare: 4, // second planet for the comparison, -1 = none
  quiz: false,
  quizStep: 0, // planets already placed in the right order (0..8)
  quizMistakes: 0,
});

/** Kepler's third law with the Sun's mass: T (years)² = a (AU)³. */
export const keplerPeriod = a => a ** 1.5;

/** Angular speed in degrees per year. */
export const angularSpeed = p => 360 / p.period;

/** Orbital angle (rad, counter-clockwise from +x) after t years. */
export const angleAt = (p, t) => p.start + (2 * Math.PI * t) / p.period;

/** Inner (vòng trong) planets orbit inside the asteroid belt. */
export const isInner = p => p.a < BELT;

/** Planet indices sorted from nearest to farthest from the Sun. */
export const byDistance = () => PLANETS.map((_, i) => i).sort((i, j) => PLANETS[i].a - PLANETS[j].a);

/** Ratios of planet i to planet j. */
export const compare = (i, j) => ({
  periodRatio: PLANETS[i].period / PLANETS[j].period,
  distanceRatio: PLANETS[i].a / PLANETS[j].a,
});

export const validIndex = k => Number.isInteger(k) && k >= 0 && k < PLANETS.length;

/** Quiz: the learner taps planet k as the next one out from the Sun. Returns "right", "wrong" or "done". */
export function quizTap(s, k) {
  const next = byDistance()[s.quizStep];
  if (next === undefined) return "done";
  if (k !== next) {
    s.quizMistakes += 1;
    return "wrong";
  }
  s.quizStep += 1;
  return s.quizStep === PLANETS.length ? "done" : "right";
}

/** Keep forged state keys that have no control inside a safe range. */
export function tidy(s) {
  s.time = Number.isFinite(s.time) ? Math.min(Math.max(s.time, 0), 1e6) : 0;
  s.quizStep = Math.min(Math.max(Math.round(s.quizStep) || 0, 0), PLANETS.length);
  s.quizMistakes = Math.min(Math.max(Math.round(s.quizMistakes) || 0, 0), 999);
  return s;
}

export function step(s, dt) {
  s.time += dt * s.speed;
  return s;
}
