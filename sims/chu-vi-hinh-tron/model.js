// Circumference and area of a circle. Lengths in cm.
// The primary-school textbook uses 3,14 for π; the measured quantities use the exact value.

export const PI_SCHOOL = 3.14;
export const R_MIN = 1;
export const R_MAX = 5;
export const ROLL_TIME = 4; // s for one full turn

export const initialState = () => ({
  mode: "roll", // "roll" | "cut"
  radius: 3, // cm
  roll: 0.6, // fraction of one turn already rolled (0–1)
  sectors: 16, // pieces the circle is cut into
});

const r = s => Math.min(R_MAX, Math.max(R_MIN, Number.isFinite(s.radius) ? s.radius : R_MIN));
export const radiusOf = r;
export const rollOf = s => Math.min(1, Math.max(0, Number.isFinite(s.roll) ? s.roll : 0));

export const diameter = r => 2 * r;
/** C = 2πr = πd, exact. */
export const circumference = r => 2 * Math.PI * r;
export const ratio = r => circumference(r) / diameter(r);
/** S = πr², exact. */
export const area = r => Math.PI * r * r;
/** Textbook versions: C = d × 3,14 and S = r × r × 3,14. */
export const schoolCircumference = r => diameter(r) * PI_SCHOOL;
export const schoolArea = r => r * r * PI_SCHOOL;

/** An even number of sectors from 4 to 64 (half of them come from each half of the circle). */
export const clampSectors = n => Math.min(64, Math.max(4, 2 * Math.round((Number.isFinite(n) ? n : 4) / 2)));

/**
 * The sectors laid side by side, alternately point down and point up. With chord c = 2r·sin(π/n)
 * the shape is close to a parallelogram of width n/2 · c (→ πr) and height r·cos(π/n) (→ r).
 */
export function rearranged(r, n) {
  n = clampSectors(n);
  const half = Math.PI / n;
  const chord = 2 * r * Math.sin(half);
  const height = r * Math.cos(half);
  const width = (n / 2) * chord;
  // apex and direction (+1 arc on top, −1 arc at the bottom) of each piece, left to right
  const pieces = [];
  for (let i = 0; i < n / 2; i++) {
    pieces.push({ x: i * chord, y: 0, up: 1 }); // from the top half: point down, arc on top
    pieces.push({ x: i * chord + chord / 2, y: height, up: -1 }); // from the bottom half: point up
  }
  return { width, height, chord, approxArea: width * height, pieces, half };
}

/** Advance the roll by dt seconds; true when it has just finished the turn. */
export function step(s, dt) {
  if (s.mode !== "roll") return false;
  const before = rollOf(s);
  s.roll = Math.min(1, before + dt / ROLL_TIME);
  return before < 1 && s.roll >= 1;
}
