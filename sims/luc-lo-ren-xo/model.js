// A charged particle in a uniform magnetic field perpendicular to the screen. Non-relativistic,
// gravity neglected. World axes: x to the right, y up (on screen), z out of the screen.
// The force F = q·v×B is perpendicular to v, so the velocity turns at the constant rate
// α = −q·B_z/m (rad/s, positive = counter-clockwise) and the speed never changes.
// Units in the state: charge in e, mass in u, speed in 10⁶ m/s, field in mT; flight in SI.

export const E = 1.602176634e-19; // C
export const U = 1.66053906660e-27; // kg
export const PRESETS = {
  electron: { charge: -1, mass: 9.1093837015e-31 / U },
  proton: { charge: 1, mass: 1.67262192369e-27 / U },
  alpha: { charge: 2, mass: 6.6446573357e-27 / U },
};
const V_REF = 2e6; // m/s and
const B_REF = 0.05; // T: the radius at these values sets the drawing scale for each particle

// The starting picture is three quarters of a turn into a flight, so it already shows the arc.
export const initialState = () => {
  const s = atRest();
  step(s, 2.25);
  return s;
};

const atRest = () => ({
  particle: "proton", // "electron" | "proton" | "alpha" | "custom"
  charge: 1, // e, used only when particle = "custom"
  mass: 4, // u, used only when particle = "custom"
  speed: 2, // 10⁶ m/s
  field: 50, // mT
  fieldDir: "into", // "into" | "out" of the screen
  // flight (SI): launched from the origin along +x
  launched: true,
  exited: false,
  x: 0,
  y: 0,
  vx: 2e6,
  vy: 0,
  time: 0, // s
  turned: 0, // rad the velocity has turned, signed (+ = counter-clockwise)
  maxDist: 0, // m, furthest distance from the launch point (= diameter after half a turn)
  measuredPeriod: 0, // s, 0 until one full revolution
  measuredRadius: 0, // m
});

/** Charge (C) and mass (kg) of the particle. */
export function props(s) {
  const p = PRESETS[s.particle] ?? { charge: s.charge, mass: s.mass };
  return { q: p.charge * E, m: Math.max(1e-6, p.mass) * U };
}

/** Textbook values: R = mv/(|q|B), T = 2πm/(|q|B), f = 1/T, F = |q|vB, and the turning rate. */
export function theory(s) {
  const { q, m } = props(s);
  const v = s.speed * 1e6;
  const B = Math.max(0, s.field) * 1e-3;
  const bz = s.fieldDir === "out" ? B : -B;
  const alpha = (-q * bz) / m; // rad/s, + = counter-clockwise
  const circles = alpha !== 0;
  const radius = circles ? (m * v) / (Math.abs(q) * B) : Infinity;
  const period = circles ? (2 * Math.PI * m) / (Math.abs(q) * B) : Infinity;
  const qRef = Math.abs(q) || E;
  return {
    q, m, v, B, alpha, circles, radius, period,
    frequency: circles ? 1 / period : 0,
    force: Math.abs(q) * v * B,
    sense: Math.sign(alpha), // +1 counter-clockwise, −1 clockwise, 0 straight line
    refRadius: (m * V_REF) / (qRef * B_REF), // m, sets the drawing scale
  };
}

/** Put the particle at the launch point, moving along +x at the set speed. */
export function launch(s) {
  Object.assign(s, { launched: true, exited: false, x: 0, y: 0, vx: s.speed * 1e6, vy: 0, time: 0, turned: 0, maxDist: 0, measuredPeriod: 0, measuredRadius: 0 });
  return s;
}

/** Back to the launch point, waiting for a launch. */
export const stop = s => Object.assign(launch(s), { launched: false });

/** Model seconds per real second: about 3 s per revolution, or 3 s to cross a reference circle. */
export function timeScale(s) {
  const th = theory(s);
  return th.circles ? th.period / 3 : (2 * Math.PI * th.refRadius) / th.v / 3;
}

/** Exact motion over h seconds under the magnetic force alone (rotation of v at rate α). */
function advance(s, h, alpha) {
  const { vx, vy } = s;
  if (alpha === 0) {
    s.x += vx * h;
    s.y += vy * h;
  } else {
    const c = Math.cos(alpha * h);
    const sn = Math.sin(alpha * h);
    // ∫₀ʰ Rot(αt)·v dt
    s.x += (sn * vx + (c - 1) * vy) / alpha;
    s.y += ((1 - c) * vx + sn * vy) / alpha;
    s.vx = c * vx - sn * vy;
    s.vy = sn * vx + c * vy;
  }
  s.time += h;
  s.turned += alpha * h;
  s.maxDist = Math.max(s.maxDist, Math.hypot(s.x, s.y));
}

/** Advance the flight by `total` seconds of model time. Returns true when the first revolution completes. */
function fly(s, total, th = theory(s)) {
  // at most 1/2000 turn per sub-step, so the sampled diameter is accurate to ~1e-6
  const n = th.circles ? Math.max(1, Math.ceil((Math.abs(th.alpha) * total) / (Math.PI / 1000))) : 1;
  const h = total / n;
  let done = false;
  for (let k = 0; k < n; k++) {
    const before = Math.abs(s.turned);
    const t0 = s.time;
    advance(s, h, th.alpha);
    if (!s.measuredPeriod && Math.abs(s.turned) >= 2 * Math.PI) {
      s.measuredPeriod = t0 + ((2 * Math.PI - before) / (Math.abs(s.turned) - before)) * h;
      s.measuredRadius = s.maxDist / 2;
      done = true;
    }
  }
  return done;
}

/** Advance by `dt` real seconds (slowed down by timeScale). Returns true when the first revolution completes. */
export function step(s, dt) {
  if (!s.launched || s.exited) return false;
  return fly(s, dt * timeScale(s));
}

export const RANGES = { charge: [-3, 3], mass: [1, 50], speed: [0.5, 5], field: [0, 200] };
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/**
 * State from outside (host, saved state) is untrusted. The flight follows from the settings and the
 * elapsed time alone, so only those are taken and the flight is replayed from the launch point.
 */
export function sanitize(incoming, base) {
  const out = { ...base };
  for (const key of ["particle", "fieldDir", "launched", "exited", "charge", "mass", "speed", "field", "time"]) {
    const v = incoming[key];
    if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
  }
  if (!(out.particle in PRESETS) && out.particle !== "custom") out.particle = base.particle;
  if (out.fieldDir !== "out") out.fieldDir = "into";
  for (const key of Object.keys(RANGES)) out[key] = clamp(out[key], RANGES[key]);
  out.charge = Math.round(out.charge);
  const time = Math.max(0, out.time);
  const exited = out.exited;
  if (!out.launched) return stop(out);
  launch(out);
  // replay at most 100 revolutions (or 100 screen crossings for a straight line)
  fly(out, Math.min(time, 100 * 3 * timeScale(out)));
  out.exited = exited;
  return out;
}
