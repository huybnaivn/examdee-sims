// Pressure on a surface: p = F / S. KHTN 8 takes the weight as P = 10·m, so g = 10 N/kg here.

export const G = 10; // N/kg

// A brick of 20 cm × 10 cm × 5 cm. w = width seen from the front, d = depth, h = height (cm).
// The face pressed on the sand is w × d.
export const FACES = {
  large: { label: "Mặt lớn (20 cm × 10 cm)", w: 20, d: 10, h: 5 },
  medium: { label: "Mặt vừa (20 cm × 5 cm)", w: 20, d: 5, h: 10 },
  small: { label: "Mặt nhỏ (10 cm × 5 cm)", w: 10, d: 5, h: 20 },
};

// What a standing person presses on the sand, total area in cm².
export const SUPPORTS = {
  feet: { label: "Hai bàn chân", area: 300 }, // about 150 cm² per foot
  skis: { label: "Đôi ván trượt", area: 2560 }, // 2 skis of 160 cm × 8 cm
  nail: { label: "Tấm ván tựa trên một mũi đinh", area: 0.01 }, // nail tip 1 mm²
};

export const MASS = { brick: [1, 5], person: [20, 90] }; // kg, slider ranges

export const initialState = () => ({
  object: "brick", // "brick" | "person"
  face: "large", // which brick face rests on the sand
  support: "feet", // what the person stands on
  brickMass: 2, // kg
  personMass: 50, // kg
});

export const weight = m => G * m; // N
export const cm2ToM2 = s => s / 1e4; // 1 m² = 10 000 cm²
export const pressure = (force, areaM2) => force / areaM2; // N/m² = Pa

// Dent in soft sand (documented model, not a law of physics): it grows with pressure and
// levels off at D_MAX, d = D_MAX·(1 − e^(−p/P_REF)). Only its monotonic growth is meant to be read.
export const D_MAX = 6; // cm
export const P_REF = 10000; // Pa
export const dentDepth = p => D_MAX * (1 - Math.exp(-Math.max(0, p) / P_REF)); // cm

const bounded = (v, [lo, hi]) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

/** Every option for the current object, as { key, label, areaCm2 }. */
export function options(s) {
  const table = s.object === "person" ? SUPPORTS : FACES;
  return Object.entries(table).map(([key, o]) => ({ key, label: o.label, areaCm2: o.area ?? o.w * o.d }));
}

export const currentKey = s => (s.object === "person" ? s.support : s.face);

/** Force, area and pressure for one option (default: the current one). */
export function solve(s, key = currentKey(s)) {
  const person = s.object === "person";
  const mass = person ? bounded(s.personMass, MASS.person) : bounded(s.brickMass, MASS.brick);
  const opt = options(s).find(o => o.key === key) ?? options(s)[0];
  const force = weight(mass);
  const area = cm2ToM2(opt.areaCm2);
  const p = pressure(force, area);
  return { key: opt.key, mass, force, areaCm2: opt.areaCm2, area, pressure: p, depth: dentDepth(p) };
}

/** Key of the option with the largest pressure: the smallest contact area. */
export const maxPressureKey = s => options(s).reduce((a, b) => (b.areaCm2 < a.areaCm2 ? b : a)).key;
