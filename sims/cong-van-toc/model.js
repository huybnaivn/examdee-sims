// Relative motion and the velocity-addition formula  v13 = v12 + v23.
// (1) the moving object, (2) the moving frame, (3) the frame at rest.
//
// River: x along the bank, positive downstream; y across, from the starting bank (y = 0)
// to the far bank (y = width). The current is uniform over the whole width (model).
// The heading is measured from the straight-across direction, positive when the bow
// is turned upstream. SI units, angles in degrees in the state.
//
// Train: one dimension, positive in the train's direction of travel.

export const TOLERANCE = 0.02; // landing counts as "opposite" within this fraction of the width
export const LOOP = 5; // s, length of the repeating train scene

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const rad = deg => (deg * Math.PI) / 180;

export const initialState = () => ({
  mode: "river", // "river" | "train"
  width: 100, // m, river width
  vBoat: 4, // m/s, boat relative to the water (v12)
  heading: 0, // degrees upstream of straight across
  vCurrent: 2, // m/s, water relative to the bank (v23)
  t: 25, // s since the launch; starts landed, so the first picture shows a whole crossing
  sailing: false, // the boat is under way
  vTrain: 8, // m/s, train relative to the ground (v23)
  vWalk: 1.5, // m/s, walker relative to the train (v12), negative = towards the rear
  clock: 2.5, // s, time in the train scene
});

/** v12, v23 and their sum v13, as { x, y } in m/s. */
export function velocities(s) {
  const a = rad(s.heading);
  const v12 = { x: -s.vBoat * Math.sin(a), y: s.vBoat * Math.cos(a) };
  const v23 = { x: s.vCurrent, y: 0 };
  const v13 = { x: v12.x + v23.x, y: v12.y + v23.y };
  return { v12, v23, v13, speed: Math.hypot(v13.x, v13.y) };
}

/** Crossing time = width / component of the velocity perpendicular to the bank. */
export const crossingTime = s => s.width / velocities(s).v13.y;

/** Where the boat lands: distance downstream of the point opposite the start (negative = upstream). */
export const drift = s => velocities(s).v13.x * crossingTime(s);

/** Heading (degrees) that lands directly opposite: sinθ = v23 / v12. NaN when the current is not slower than the boat. */
export const headingForNoDrift = s => (s.vCurrent < s.vBoat ? (Math.asin(s.vCurrent / s.vBoat) * 180) / Math.PI : NaN);

export const landsOpposite = s => Math.abs(drift(s)) <= TOLERANCE * s.width;

/** Boat position at the state's time (clamped to the crossing). */
export function boat(s) {
  const t = clamp(s.t, 0, crossingTime(s));
  const { v13 } = velocities(s);
  return { t, x: v13.x * t, y: v13.y * t, landed: t >= crossingTime(s) };
}

/** Advance the crossing. Returns true on the step in which the boat lands. */
export function step(s, dt) {
  if (s.mode === "train") {
    s.clock = (clamp(s.clock, 0, LOOP) + dt) % LOOP;
    return false;
  }
  if (!s.sailing) return false;
  const T = crossingTime(s);
  s.t = clamp(s.t, 0, T) + dt;
  if (s.t < T) return false;
  s.t = T;
  s.sailing = false;
  return true;
}

export function launch(s) {
  s.t = 0;
  s.sailing = true;
}

/** Train scene: 1D velocities and distances covered after the clock time. */
export function train(s) {
  const t = clamp(s.clock, 0, LOOP);
  const v13 = s.vWalk + s.vTrain;
  return { t, v12: s.vWalk, v23: s.vTrain, v13, s12: s.vWalk * t, s23: s.vTrain * t, s13: v13 * t };
}
