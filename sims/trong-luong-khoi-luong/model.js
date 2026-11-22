// Mass and weight. A beam balance compares the object with standard masses, so it reads the mass
// wherever there is gravity. A spring scale reads the force that stretches its spring, P = m·g.
// Unit of g here: N/kg (the same number as m/s²).

export const TEXTBOOK_G = 10; // N/kg, the rounding the grade 6 textbook uses on Earth: P = 10·m

// g at the surface (Jupiter: at the cloud tops, it has no solid surface).
// In orbit the station and everything in it fall freely together, so a spring scale is not
// stretched: the apparent g is 0 although the Earth still pulls.
export const PLACES = {
  earth: { name: "Trái Đất", g: 9.81 },
  moon: { name: "Mặt Trăng", g: 1.62 },
  mars: { name: "Sao Hỏa", g: 3.71 },
  jupiter: { name: "Sao Mộc", g: 24.79 },
  orbit: { name: "Trạm vũ trụ trên quỹ đạo", g: 0 },
};

export const OBJECTS = {
  astronaut: { name: "Phi hành gia", mass: 75 },
  crate: { name: "Thùng dụng cụ", mass: 20 },
  rock: { name: "Hòn đá", mass: 5 },
  weight: { name: "Quả cân", mass: 1 },
};

export const initialState = () => ({
  place: "moon",
  object: "astronaut",
  approx: true, // on Earth use g = 10 N/kg as the textbook does
  predict: false, // hide the spring scale reading so the learner can predict it
  guess: 0, // N, the learner's prediction
  verdict: 0, // 0 not checked, 1 right, -1 wrong
});

/** g that the instruments feel at a place, N/kg. */
export const gravity = (place, approx = false) => (place === "earth" && approx ? TEXTBOOK_G : (PLACES[place] ?? PLACES.earth).g);

/** Weight (N) of a mass (kg) where the gravitational field strength is g (N/kg). */
export const weight = (mass, g) => mass * g;

/** Textbook conversion on Earth: 1 kg ↔ 10 N. */
export const weightFromMass = mass => TEXTBOOK_G * mass;
export const massFromWeight = P => P / TEXTBOOK_G;

/** A beam balance compares two pans under the same g, so g cancels; it cannot compare when g = 0. */
export const balanceWorks = g => g > 0;
export const balanceReading = (mass, g) => (balanceWorks(g) ? (mass * g) / g : NaN);

/** Full scale (N) of the spring scale picked for an object: the smallest that still fits Jupiter. */
export const fullScale = mass => [30, 150, 500, 2000].find(f => f >= 25 * mass) ?? 2000;

export const FULL_EXTENSION = 0.1; // m, stretch of every spring scale at its full scale
export const springConstant = mass => fullScale(mass) / FULL_EXTENSION; // N/m
/** Hooke's law: the stretch (m) is proportional to the force (N). */
export const extension = (force, k) => force / k;

/** Everything the two instruments show for a state. */
export function reading(s) {
  const mass = (OBJECTS[s.object] ?? OBJECTS.astronaut).mass;
  const g = gravity(s.place, s.approx);
  const P = weight(mass, g);
  const k = springConstant(mass);
  return { mass, g, weight: P, fullScale: fullScale(mass), extension: extension(P, k), balance: balanceReading(mass, g) };
}

/** The guess is a state key without a kit control: keep it finite and in range. */
export const cleanGuess = v => (Number.isFinite(v) ? Math.min(100000, Math.max(0, v)) : 0);

/** A prediction counts when it is within 2 % of the reading (or 0,5 N for small readings). */
export const isGoodGuess = (guess, P) => Math.abs(cleanGuess(guess) - P) <= Math.max(0.5, 0.02 * P);
