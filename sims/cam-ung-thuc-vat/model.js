// Plant tropisms: a seedling (a straight young shoot and a root) under one-sided light and gravity.
// No DOM here. Angles are in degrees, measured clockwise from "straight up" as seen on screen
// (0 up, 90 to the right, 180 down). Lengths in cm, time in hours.
//
// The growth model is a deliberately simple one in the spirit of the Cholodny–Went hypothesis:
//  1. The shoot tip makes auxin and senses light; shoot tip and root tip both sense gravity.
//  2. A stimulus from the side moves auxin across the tip. With `shift` = the difference between
//     the auxin shares of the two flanks:
//       shift = K_GRAVITY · sin(tilt of the organ)             more auxin on the lower flank
//             − K_LIGHT · sin(light direction − organ direction)  more auxin on the shaded flank (shoot only)
//     so fully one-sided light gives 65 % : 35 %, a horizontal organ 60 % : 40 %.
//  3. In the shoot, more auxin means faster elongation, so the shoot bends away from the flank
//     with more auxin (towards the light, and upwards). In the root the same extra auxin inhibits
//     elongation, so the root bends towards that flank (downwards).
//       bending rate = BEND · shift   (degrees per hour)
//  4. The tip advances at a constant speed in the direction it currently points; the path it has
//     traced is the organ. (Real organs bend in the elongation zone behind the tip.)
// Not modelled: the root's weak negative phototropism, growth in the dark, nutrients.
// The constants are illustrative.

export const T_END = 72; // h, length of one experiment
export const K_LIGHT = 0.3;
export const K_GRAVITY = 0.2;
export const BEND = 30; // degrees per hour per unit of auxin shift
export const V_SHOOT = 0.06; // cm/h
export const V_ROOT = 0.04; // cm/h
export const L_SHOOT = 0.6; // cm, length at the start
export const L_ROOT = 0.4;
// No organ is perfectly straight: a 0,4° deviation at the start lets an organ that points exactly
// the "wrong" way (pot upside down) leave that unstable position, as it does in reality.
export const WOBBLE = 0.4;
const STEP = 0.25; // h, integration step

export const TIPS = ["intact", "cap", "clear", "band", "removed"];
export const PREDICTIONS = ["light", "up", "straight", "none"];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = v => (Number.isFinite(v) ? v : 0);
const sin = deg => Math.sin((deg * Math.PI) / 180);
const cos = deg => Math.cos((deg * Math.PI) / 180);
/** An angle brought into (−180, 180]. */
export const norm = deg => {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a;
};

/** Direction of the pot's axis (where the shoot points at the start). On the clinostat the pot lies on its side. */
export const tiltOf = s => (s.clinostat ? 90 : clamp(num(s.tilt), 0, 180));
export const lightOf = s => clamp(num(s.lightAngle), -180, 180);
export const tipOf = s => (TIPS.includes(s.tip) ? s.tip : "intact");
/** The tip is the auxin source: no tip, no elongation and no bending of the shoot. */
export const hasTip = s => tipOf(s) !== "removed";
/** One-sided light is sensed only by an uncovered tip, and only if the plant is not being rotated. */
export const seesLight = s => !!s.oneSided && !s.clinostat && hasTip(s) && tipOf(s) !== "cap";
/** The clinostat turns the plant steadily, so over time no flank is the lower one. */
export const feelsGravity = s => !s.clinostat;
// `time` has no control, so a forged value is clamped here.
export const timeOf = s => clamp(num(s.time), 0, T_END);

/** Auxin share of the flank on the clockwise side minus that of the other flank, for an organ pointing along `theta`. */
export function auxinShift(s, organ, theta) {
  let shift = feelsGravity(s) ? K_GRAVITY * sin(theta) : 0;
  if (organ === "shoot" && seesLight(s)) shift -= K_LIGHT * sin(lightOf(s) - theta);
  return shift;
}

/** Auxin shares of the two flanks: `cw` on the clockwise side of the growth direction, `ccw` on the other. They add up to 1. */
export function auxin(s, organ, theta) {
  const shift = auxinShift(s, organ, theta);
  return { cw: 0.5 + shift / 2, ccw: 0.5 - shift / 2 };
}

/**
 * The seedling after `hours` of growth under constant conditions, seed at (0, 0), y upwards.
 * shootAngle: where the shoot tip points, from straight up, positive to the right.
 * rootAngle: where the root tip points, from straight down, positive to the right.
 */
export function grow(s, hours) {
  const t = clamp(num(hours), 0, T_END);
  const tilt = tiltOf(s);
  const organ = (name, start, length, speed, response) => {
    let theta = start + WOBBLE;
    let x = length * sin(theta);
    let y = length * cos(theta);
    const points = [[0, 0], [x, y]];
    for (let done = 0; done < t - 1e-9; done += STEP) {
      const dt = Math.min(STEP, t - done);
      theta += response * BEND * auxinShift(s, name, theta) * dt;
      x += speed * dt * sin(theta);
      y += speed * dt * cos(theta);
      points.push([x, y]);
    }
    return { points, theta };
  };
  const alive = hasTip(s) ? 1 : 0;
  // shoot: bends away from the auxin-rich flank (−1); root: towards it (+1)
  const shoot = organ("shoot", tilt, alive ? L_SHOOT : L_SHOOT * 0.75, V_SHOOT * alive, -alive);
  const root = organ("root", tilt + 180, L_ROOT, V_ROOT, 1);
  return {
    shoot: shoot.points,
    root: root.points,
    shootTheta: shoot.theta,
    rootTheta: root.theta,
    shootAngle: norm(shoot.theta),
    rootAngle: norm(180 - root.theta),
  };
}

/**
 * What the shoot has done by the end of the experiment, as the categories a learner can predict:
 * "none" (no growth), "straight", "light" (bent towards the light), "up" (bent upwards, against gravity).
 * A bend can be both towards the light and upwards.
 */
export function shootOutcomes(s) {
  if (!hasTip(s)) return ["none"];
  const tilt = tiltOf(s);
  const end = grow(s, T_END).shootAngle;
  const gap = (a, b) => Math.abs(norm(a - b));
  if (gap(end, tilt) < 5) return ["straight"];
  const out = [];
  if (seesLight(s) && gap(end, lightOf(s)) < gap(tilt, lightOf(s)) - 1) out.push("light");
  if (feelsGravity(s) && gap(end, 0) < gap(tilt, 0) - 1) out.push("up");
  return out;
}

/** A condition of the experiment changed: it is a new, untested experiment starting at 0 h. */
export function changed(s) {
  s.time = 0;
  s.tested = false;
  s.verdict = "";
}

/** Let time run on (a finished experiment starts again). Returns true when the experiment has just ended. */
export function advance(s, hours) {
  const t = timeOf(s);
  s.time = Math.min(T_END, (t >= T_END ? 0 : t) + hours);
  return s.time >= T_END;
}

/** The experiment has ended: judge a prediction made before this outcome was ever seen. */
export function finish(s) {
  const g = grow(s, T_END);
  const predicted = !s.tested && PREDICTIONS.includes(s.predict);
  const correct = predicted && shootOutcomes(s).includes(s.predict);
  s.verdict = predicted ? (correct ? "correct" : "wrong") : s.tested ? s.verdict : "";
  s.tested = true;
  return { shootAngle: g.shootAngle, rootAngle: g.rootAngle, predicted, correct };
}

export function initialState() {
  return {
    oneSided: true,
    lightAngle: 90,
    tilt: 0,
    clinostat: false,
    tip: "intact",
    predict: "",
    time: T_END, // the picture shows the finished experiment; ▶ runs it again from 0 h
    tested: true,
    verdict: "",
  };
}
