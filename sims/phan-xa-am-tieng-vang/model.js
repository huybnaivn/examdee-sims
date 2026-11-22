// Reflection of sound: an echo off a wall, and echo sounding (sonar) of the sea depth.
// Times in seconds, distances in metres, speeds in m/s.

export const V_AIR = 340; // speed of sound in air at about 15 °C (textbook value)
export const V_SEA = 1500; // speed of sound in sea water (textbook value)
// The ear keeps a sound for about 1/15 s; an echo that comes back later than that is heard
// as a separate sound (an echo), sooner than that it merges with the original.
export const ECHO_GAP = 1 / 15;
export const D_RANGE = [2, 40];

// Fraction of the sound amplitude a surface sends back (the rest is absorbed or passes on).
// Hard, smooth surfaces reflect well; soft, porous ones absorb. Illustrative values.
export const SURFACES = {
  concrete: 0.95,
  wood: 0.6,
  curtain: 0.15,
};

export const initialState = () => ({
  scene: "wall", // "wall" | "sonar"
  distance: 17, // m, person to wall
  surface: "concrete",
  t: 0.07, // s since the last pulse left the source
  flying: true, // a pulse is travelling
  returned: false, // that pulse has already come back to the source
  seed: 1, // which hidden sea floor
  answer: 0, // m, the depth the learner computed
  measured: 0, // s, last sonar delay read (0 = none yet)
  solved: false,
});

const finite = (v, d) => (Number.isFinite(v) ? v : d);
export const distanceOf = s => Math.min(D_RANGE[1], Math.max(D_RANGE[0], finite(s.distance, 17)));
export const reflectance = s => SURFACES[s.surface] ?? SURFACES.concrete;

/** Echo delay t = 2d/v: the sound goes to the wall and back. */
export const echoDelay = (d, v = V_AIR) => (2 * d) / v;
/** A separate echo is heard when the delay is at least 1/15 s. */
export const echoHeard = delay => delay >= ECHO_GAP - 1e-12;
/** Least distance to hear an echo: d = v·(1/15)/2. */
export const minEchoDistance = (v = V_AIR) => (v * ECHO_GAP) / 2;

/** Reflected amplitude, for a unit incident amplitude. */
export const reflectedAmplitude = s => reflectance(s);

/** Hidden sea depth for a seed: 200 … 4000 m, a multiple of 5 m. */
export function seaDepth(seed) {
  const n = Math.abs(Math.round(finite(seed, 1))) % 100000;
  const v = Math.sin(n * 91.345 + 7.13) * 43758.5453;
  return 200 + 5 * Math.floor((v - Math.floor(v)) * 761);
}
/** Depth from the echo delay: h = v·t/2. */
export const depthFromDelay = (t, v = V_SEA) => (v * t) / 2;
export const sonarDelay = h => (2 * h) / V_SEA;
/** An answer is accepted within 2 % of the depth (at least 5 m). */
export const depthTolerance = h => Math.max(5, 0.02 * h);
export const answerOk = (answer, h) => Math.abs(answer - h) <= depthTolerance(h);

/** Delay of the pulse in the current scene. */
export const delayOf = s => (s.scene === "sonar" ? sonarDelay(seaDepth(s.seed)) : echoDelay(distanceOf(s)));

/** Start a new pulse. */
export function emitPulse(s) {
  s.t = 0;
  s.flying = true;
  s.returned = false;
  return s;
}

/**
 * Advance the pulse. Returns true on the step it gets back to the source.
 * The pulse is kept a little after its return, so the reflected front is seen passing by.
 */
export function advance(s, dt) {
  if (!s.flying) return false;
  const delay = delayOf(s);
  s.t += dt;
  let back = false;
  if (!s.returned && s.t >= delay) {
    s.returned = true;
    back = true;
  }
  if (s.t >= delay * 1.35) s.flying = false;
  return back;
}
