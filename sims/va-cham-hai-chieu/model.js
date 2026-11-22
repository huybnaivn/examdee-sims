// Two smooth pucks of equal radius on a frictionless air table, seen from above. SI units, y upwards.
// The learner chooses masses, velocities, the coefficient of restitution e and the offset b
// (impact parameter): the distance at which the centres would pass each other if the pucks did not
// interact. The starting points are derived from these so that the pucks do meet with that offset,
// and so that the centre of mass is at the origin at that moment.
// Smooth pucks push each other only along the line of centres: the velocity components along that
// line change as in a head-on collision, the components across it stay as they were.
// The whole run is a closed form of the elapsed time, so the state stores the settings and `time`.

export const R = 0.4; // m, radius of each puck
const LEAD = 1.2; // s of approach shown before the pucks meet (at least)
const AFTER = 1.2; // s shown after they meet
const MIN_GAP = 2 * R + 0.6; // m, least starting distance along the line of approach

export const initialState = () => {
  const s = {
    m1: 1, // kg
    v1x: 3, // m/s
    v1y: 0,
    m2: 1,
    v2x: 0,
    v2y: 0,
    restitution: 1, // e: 1 elastic … 0 perfectly inelastic along the line of centres
    offset: 0.4, // b, m; positive when puck 1 passes on the left of puck 2 (seen along its approach)
    time: 0, // s since the launch
  };
  s.time = endTime(s); // start on a finished run: before and after are both on screen
  return s;
};

/**
 * Geometry of the run: start points, the moment the pucks touch (or pass closest), and the unit
 * vector n from puck 1 to puck 2 at contact. `hit` is false when they never touch.
 */
export function setup(s) {
  const M = s.m1 + s.m2;
  const ux = s.v1x - s.v2x; // velocity of puck 1 relative to puck 2
  const uy = s.v1y - s.v2y;
  const u = Math.hypot(ux, uy);
  const moving = u > 1e-9;
  const ex = moving ? ux / u : 1; // direction of approach
  const ey = moving ? uy / u : 0;
  const gap = Math.max(u * LEAD, MIN_GAP);
  // position of puck 1 relative to puck 2 at t = 0: `gap` behind, `offset` to the left
  const rx = -gap * ex - s.offset * ey;
  const ry = -gap * ey + s.offset * ex;
  const hit = moving && Math.abs(s.offset) < 2 * R;
  const along = hit ? Math.sqrt(4 * R * R - s.offset * s.offset) : 0;
  const meet = moving ? (gap - along) / u : AFTER; // contact, closest approach, or mid-run when nothing approaches
  const vcx = (s.m1 * s.v1x + s.m2 * s.v2x) / M;
  const vcy = (s.m1 * s.v1y + s.m2 * s.v2y) / M;
  return {
    hit,
    meet,
    end: meet + AFTER,
    x1: -vcx * meet + (s.m2 / M) * rx,
    y1: -vcy * meet + (s.m2 / M) * ry,
    x2: -vcx * meet - (s.m1 / M) * rx,
    y2: -vcy * meet - (s.m1 / M) * ry,
    // line of centres at contact, from puck 1 to puck 2
    nx: hit ? (along * ex + s.offset * ey) / (2 * R) : 0,
    ny: hit ? (along * ey - s.offset * ex) / (2 * R) : 0,
  };
}

export const collisionTime = s => (setup(s).hit ? setup(s).meet : Infinity);
export const endTime = s => setup(s).end;

/**
 * Velocities after two smooth pucks collide with line of centres n (unit vector from 1 to 2):
 * momentum is conserved, and along n the separation speed is e times the approach speed.
 */
export function collide(m1, v1x, v1y, m2, v2x, v2y, e, nx, ny) {
  const approach = (v1x - v2x) * nx + (v1y - v2y) * ny;
  const impulse = ((1 + e) * approach * m1 * m2) / (m1 + m2); // N·s, on puck 2 along n
  return {
    v1x: v1x - (impulse / m1) * nx,
    v1y: v1y - (impulse / m1) * ny,
    v2x: v2x + (impulse / m2) * nx,
    v2y: v2y + (impulse / m2) * ny,
  };
}

/** Momentum vectors (kg·m/s) and kinetic energies (J) of the pucks and of the system. */
export function quantities(m1, m2, v) {
  const p1x = m1 * v.v1x;
  const p1y = m1 * v.v1y;
  const p2x = m2 * v.v2x;
  const p2y = m2 * v.v2y;
  const k1 = 0.5 * m1 * (v.v1x ** 2 + v.v1y ** 2);
  const k2 = 0.5 * m2 * (v.v2x ** 2 + v.v2y ** 2);
  return { ...v, p1x, p1y, p2x, p2y, px: p1x + p2x, py: p1y + p2y, p: Math.hypot(p1x + p2x, p1y + p2y), k1, k2, k: k1 + k2 };
}

export const before = s => quantities(s.m1, s.m2, { v1x: s.v1x, v1y: s.v1y, v2x: s.v2x, v2y: s.v2y });

/** Quantities after the collision, or null if the pucks never touch. */
export function after(s) {
  const g = setup(s);
  if (!g.hit) return null;
  return quantities(s.m1, s.m2, collide(s.m1, s.v1x, s.v1y, s.m2, s.v2x, s.v2y, s.restitution, g.nx, g.ny));
}

/** Angle in degrees (0–180) between two vectors; NaN if either has no length. */
export function angleBetween(ax, ay, bx, by) {
  const a = Math.hypot(ax, ay);
  const b = Math.hypot(bx, by);
  if (a < 1e-9 || b < 1e-9) return NaN;
  return (Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / (a * b)))) * 180) / Math.PI;
}

/** Centres and velocities of both pucks at time t (clamped to the run). */
export function at(s, t) {
  const g = setup(s);
  const time = Math.min(Math.max(0, Number.isFinite(t) ? t : 0), g.end);
  const v0 = { v1x: s.v1x, v1y: s.v1y, v2x: s.v2x, v2y: s.v2y };
  const pre = Math.min(time, g.hit ? g.meet : time);
  const post = time - pre;
  const v = post > 0 ? after(s) : v0;
  return {
    time,
    collided: post > 0,
    x1: g.x1 + s.v1x * pre + v.v1x * post,
    y1: g.y1 + s.v1y * pre + v.v1y * post,
    x2: g.x2 + s.v2x * pre + v.v2x * post,
    y2: g.y2 + s.v2y * pre + v.v2y * post,
    v1x: v.v1x,
    v1y: v.v1y,
    v2x: v.v2x,
    v2y: v.v2y,
  };
}

/** Box { minX, maxX, minY, maxY } the pucks cover during the whole run (for scaling the view). */
export function extent(s) {
  const g = setup(s);
  const pts = [0, g.meet, g.end].map(t => at(s, t));
  const xs = pts.flatMap(p => [p.x1, p.x2]);
  const ys = pts.flatMap(p => [p.y1, p.y2]);
  return { minX: Math.min(...xs) - R, maxX: Math.max(...xs) + R, minY: Math.min(...ys) - R, maxY: Math.max(...ys) + R };
}
