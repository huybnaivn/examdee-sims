// Hydraulic press (jack). Ideal: no friction, massless pistons, incompressible liquid, the weight of the
// liquid itself is neglected, the load is lifted slowly.
// Pascal: p = F₁/S₁ is transmitted unchanged, so F₂ = p·S₂ and F₂/F₁ = S₂/S₁.
// Each push of the small piston by h₁ moves the volume S₁h₁ under the large piston: S₁h₁ = S₂h₂.
// When the small piston is let go a one-way valve keeps the large piston up and the small one refills.

export const G = 9.81; // m/s²
export const STROKE = 10; // cm, full travel of the small piston
export const TARGET = 4; // cm, the height the load has to be lifted to
export const MAX_LIFT = 6; // cm, end of travel of the large piston
export const HAND_LIMIT = 200; // N, the hand force allowed for the car challenge

export const LOADS = {
  car: { mass: 1200, name: "Ô tô" },
  crate: { mass: 400, name: "Thùng hàng" },
  bike: { mass: 120, name: "Xe máy" },
};

export const initialState = () => ({
  area1: 5, // S₁, cm²
  area2: 250, // S₂, cm²
  load: "car",
  force1: 300, // F₁, N, the force of the hand on the small piston
  h1: 0, // cm, how far the small piston is pushed in the current stroke
  pumped: 0, // cm, lift of the large piston from finished strokes
  strokes: 0, // number of finished strokes
  reached: false, // the load has reached TARGET
});

const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
export const loadMass = s => (LOADS[s.load] ?? LOADS.car).mass;
export const weight = s => loadMass(s) * G;
export const pressure = s => s.force1 / (s.area1 * 1e-4); // Pa
export const force2 = s => pressure(s) * s.area2 * 1e-4; // N
export const required = s => (weight(s) * s.area1) / s.area2; // least F₁ that lifts the load
export const lifts = s => force2(s) >= weight(s) * (1 - 1e-12);
export const lift = s => num(s.pumped, 0, MAX_LIFT) + (num(s.h1, 0, STROKE) * s.area1) / s.area2; // h₂, cm
// total h₁ (cm): every finished stroke moved the volume S₂·Δh₂ out of the small cylinder
export const travel = s => (num(s.pumped, 0, MAX_LIFT) * s.area2) / s.area1 + num(s.h1, 0, STROKE);
export const work1 = s => (s.force1 * travel(s)) / 100; // J
export const work2 = s => (force2(s) * lift(s)) / 100; // J

/** Push the small piston further by dh (cm). Nothing moves while F₂ < P or at end of travel. */
export function push(s, dh) {
  if (!lifts(s) || dh <= 0) return 0;
  const room = ((MAX_LIFT - lift(s)) * s.area2) / s.area1; // small-piston travel left before the large one stops
  const d = Math.max(0, Math.min(dh, STROKE - num(s.h1, 0, STROKE), room));
  s.h1 = num(s.h1, 0, STROKE) + d;
  return d;
}

/** Let go of the small piston: the valve keeps the lift, the small piston goes back up. */
export function letGo(s) {
  const d = num(s.h1, 0, STROKE);
  if (d <= 0) return 0;
  s.pumped = num(s.pumped, 0, MAX_LIFT) + (d * s.area1) / s.area2;
  s.strokes += 1;
  s.h1 = 0;
  return d;
}

export function lower(s) {
  Object.assign(s, { h1: 0, pumped: 0, strokes: 0, reached: false });
  return s;
}
