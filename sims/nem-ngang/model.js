// Horizontal launch from height h. Textbook axes: origin O at the launch point, Ox horizontal
// in the direction of v₀, Oy vertical pointing DOWN, so x = v₀t and y = ½gt²; the ground is y = h.
// A second ball is dropped from the same height at the same instant; it has the same y at every t.

export const TOLERANCE = 1; // m, half the width of the target basket

export const flightTime = s => Math.sqrt((2 * s.height) / s.gravity);
export const range = s => s.speed * flightTime(s);
export const impactSpeed = s => Math.sqrt(s.speed * s.speed + 2 * s.gravity * s.height);
export const positionAt = (s, t) => ({ x: s.speed * t, y: 0.5 * s.gravity * t * t });
/** Trajectory y(x) = g·x² / (2v₀²). */
export const pathY = (s, x) => (s.gravity * x * x) / (2 * s.speed * s.speed);
export const hit = s => Math.abs(s.x - s.target) <= TOLERANCE;

/** Strobe interval: the shortest of 0,1 / 0,2 / 0,25 / 0,5 / 1 s that gives at most 12 images. */
export const strobeInterval = s => [0.1, 0.2, 0.25, 0.5, 1].find(d => flightTime(s) / d <= 12) ?? 1;

/** Balls back at O, waiting. */
export function ready(s) {
  Object.assign(s, { phase: "ready", time: 0, x: 0, y: 0, vx: s.speed, vy: 0 });
  return s;
}

export function launch(s) {
  ready(s).phase = "flying";
  return s;
}

/**
 * Advance by dt with the exact constant-acceleration update (vx constant, vy grows by g·dt).
 * The flight time is not looked up: the step that reaches the ground solves for the instant y = h.
 * Returns "landed" on that step.
 */
export function step(s, dt) {
  if (s.phase !== "flying") return null;
  const y = s.y + s.vy * dt + 0.5 * s.gravity * dt * dt;
  if (y < s.height) {
    s.x += s.vx * dt;
    s.y = y;
    s.vy += s.gravity * dt;
    s.time += dt;
    return null;
  }
  const left = s.height - s.y; // ½g·τ² + vy·τ = left
  const tau = (-s.vy + Math.sqrt(s.vy * s.vy + 2 * s.gravity * left)) / s.gravity;
  s.x += s.vx * tau;
  s.y = s.height;
  s.vy += s.gravity * tau;
  s.time += tau;
  s.phase = "landed";
  return "landed";
}

const run = s => {
  launch(s);
  while (step(s, 1 / 120) !== "landed");
  return s;
};

// Starts on a finished throw that misses the basket, so the first picture shows the strobe images.
export const initialState = () =>
  run({
    speed: 10, // m/s, v₀
    height: 20, // m, h
    gravity: 9.81, // m/s²
    target: 35, // m, centre of the basket on the ground
    showStrobe: true,
    showDropped: true,
    showVectors: false,
    phase: "ready", // ready | flying | landed
    time: 0, // s since the launch
    x: 0, // m, horizontal distance from O
    y: 0, // m, distance fallen below O
    vx: 0, // m/s
    vy: 0, // m/s, downward
  });
