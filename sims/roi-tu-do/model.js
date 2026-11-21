// Dropping objects from rest. In a vacuum only gravity acts (free fall); in air a quadratic drag
// force ½·ρ·C·A·v² is added. Both cases have a closed-form solution, so nothing is integrated:
// the state only stores the elapsed time. Buoyancy is ignored. SI units throughout.

export const RHO = 1.2; // density of air, kg/m³

// mass (kg), cross-section facing the motion (m²), drag coefficient
export const OBJECTS = {
  steel: { mass: 0.033, area: 3.14e-4, drag: 0.47 }, // steel ball, radius 1 cm
  ball: { mass: 0.02, area: 5.0e-3, drag: 0.47 }, // light plastic ball, radius 4 cm
  feather: { mass: 1e-4, area: 2e-3, drag: 1.2 },
  paper: { mass: 5e-3, area: 0.0624, drag: 1.2 }, // flat A4 sheet falling face down
};

const PLACES = { earth: 9.81, moon: 1.62 };

export const initialState = () => {
  const s = {
    height: 2, // m
    object1: "steel",
    medium: "air", // "air" | "vacuum"
    place: "earth", // "earth" | "moon" | "custom"
    gCustom: 5, // m/s², used when place = "custom"
    two: true, // drop a second object alongside
    object2: "feather",
    interval: 0.1, // s between stroboscopic marks
    time: 0, // s since release
  };
  s.time = endTime(s); // start on a finished drop: the picture already tells the story
  return s;
};

export const gravity = s => PLACES[s.place] ?? s.gCustom;
export const names = s => (s.two ? [s.object1, s.object2] : [s.object1]);

/** Terminal speed √(2mg/(ρ·C·A)); Infinity in a vacuum. */
export function terminalSpeed(s, name) {
  if (s.medium !== "air") return Infinity;
  const o = OBJECTS[name];
  return Math.sqrt((2 * o.mass * gravity(s)) / (RHO * o.drag * o.area));
}

/** Time to reach the ground from s.height. Vacuum: √(2h/g). */
export function fallTime(s, name) {
  const g = gravity(s);
  const vt = terminalSpeed(s, name);
  if (vt === Infinity) return Math.sqrt((2 * s.height) / g);
  const k = (s.height * g) / (vt * vt);
  // acosh(e^k), written so it cannot overflow
  return (vt / g) * (k + Math.log(1 + Math.sqrt(-Math.expm1(-2 * k))));
}

/** Distance fallen and speed at time t (clamped to the landing). Returns { fallen, h, v, landed }. */
export function motion(s, name, t) {
  const g = gravity(s);
  const vt = terminalSpeed(s, name);
  const T = fallTime(s, name);
  const landed = t >= T;
  t = Math.max(0, Math.min(t, T));
  let fallen, v;
  if (vt === Infinity) {
    v = g * t;
    fallen = 0.5 * g * t * t;
  } else {
    const x = (g * t) / vt;
    v = vt * Math.tanh(x);
    fallen = ((vt * vt) / g) * (x + Math.log1p(Math.expm1(-2 * x) / 2)); // (vt²/g)·ln cosh x
  }
  fallen = landed ? s.height : Math.min(fallen, s.height);
  return { fallen, h: s.height - fallen, v, landed };
}

/** When the last object lands. */
export const endTime = s => Math.max(...names(s).map(name => fallTime(s, name)));

/** Distances fallen at t = 0, Δt, 2Δt, … up to `until` (and never past the landing). */
export function strobe(s, name, until = Infinity) {
  const stop = Math.min(until, fallTime(s, name)) + 1e-9;
  const marks = [];
  for (let k = 0; k * s.interval <= stop && k < 2000; k++) marks.push(motion(s, name, k * s.interval).fallen);
  return marks;
}
