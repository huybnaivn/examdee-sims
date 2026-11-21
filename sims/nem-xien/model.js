// Projectile motion. x to the right, y up, ground at y = 0. Angle in degrees above the horizontal.

export const DT = 1 / 120;
export const DRAG_K = 0.02; // 1/m; with air drag the acceleration is -k·|v|·v (drag grows with v²)

/** Put the projectile on the launcher, not moving yet. */
export function ready(s) {
  const a = (s.angle * Math.PI) / 180;
  Object.assign(s, {
    phase: "ready",
    x: 0,
    y: s.height,
    vx: s.speed * Math.cos(a),
    vy: s.speed * Math.sin(a),
    time: 0,
    maxHeight: s.height,
  });
  return s;
}

export function launch(s) {
  ready(s).phase = "flying";
  return s;
}

const accel = (s, vx, vy) => {
  const k = s.drag ? DRAG_K * Math.hypot(vx, vy) : 0;
  return [-k * vx, -s.gravity - k * vy];
};

/**
 * Advance by dt. The acceleration at the midpoint is held constant over the step, so without
 * drag the step, the apex and the landing point are exact; with drag the error is O(dt²).
 */
export function step(s, dt) {
  if (s.phase !== "flying") return s;
  const { x, y, vx, vy } = s;
  const [hx, hy] = accel(s, vx, vy);
  const [ax, ay] = accel(s, vx + (hx * dt) / 2, vy + (hy * dt) / 2);
  let tau = dt;
  const landed = y + vy * dt + (ay * dt * dt) / 2 <= 0;
  if (landed) {
    // root of y + vy·τ + ay·τ²/2 = 0 inside this step
    const d = Math.sqrt(Math.max(0, vy * vy - 2 * ay * y)) - vy;
    tau = d > 0 ? Math.min(dt, Math.max(0, (2 * y) / d)) : 0;
  }
  const apexInStep = vy > 0 && ay < 0 && vy + ay * tau <= 0;
  s.x = x + vx * tau + (ax * tau * tau) / 2;
  s.y = landed ? 0 : y + vy * tau + (ay * tau * tau) / 2;
  s.vx = vx + ax * tau;
  s.vy = vy + ay * tau;
  s.time += tau;
  s.maxHeight = Math.max(s.maxHeight, apexInStep ? y + (vy * vy) / (-2 * ay) : s.y);
  if (landed) s.phase = "landed";
  return s;
}

/** Launch and run to the landing. On return x is the range and time the flight time. */
export function fly(s) {
  launch(s);
  for (let i = 0; i < 50000 && s.phase === "flying"; i++) step(s, DT);
  return s;
}

/** Textbook results without air drag. */
export function ideal(s) {
  const a = (s.angle * Math.PI) / 180;
  const vy = s.speed * Math.sin(a);
  const flightTime = (vy + Math.sqrt(vy * vy + 2 * s.gravity * s.height)) / s.gravity;
  return {
    flightTime,
    range: s.speed * Math.cos(a) * flightTime,
    maxHeight: s.height + (vy * vy) / (2 * s.gravity),
  };
}

/** Points [x, y] of the current shot from launch up to time `until` (default: the landing). */
export function trajectory(s, until = Infinity) {
  const p = launch({ ...s });
  const points = [[p.x, p.y]];
  for (let i = 0; i < 50000 && p.phase === "flying" && p.time < until - 1e-9; i++) {
    step(p, DT);
    points.push([p.x, p.y]);
  }
  return points;
}

// Starts with one finished shot on screen so the path, range and height are visible at once.
export const initialState = () =>
  fly({
    speed: 18, // m/s
    angle: 50, // degrees
    height: 0, // m, launch height
    gravity: 9.81, // m/s^2
    drag: false,
    showVectors: true,
    phase: "ready", // "ready" | "flying" | "landed"
    x: 0, // m; the range once landed
    y: 0, // m
    vx: 0, // m/s
    vy: 0, // m/s
    time: 0, // s since launch; the flight time once landed
    maxHeight: 0, // m, highest point so far
  });
