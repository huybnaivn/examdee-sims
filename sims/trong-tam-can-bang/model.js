// Centre of gravity and kinds of equilibrium, in three parts chosen by `mode`:
//   "hang"    – a flat uniform plate hung from a pin swings until its centre of gravity is under the pin;
//   "topple"  – a uniform block on a ramp falls over when the vertical through its centre leaves the base;
//   "balance" – a ball on a curved surface: stable, unstable or neutral equilibrium.
// Plates and blocks are measured in cm, the ball's track in m; angles in rad unless a name says otherwise.

const G = 9.8; // m/s²
const QUARTER = Math.PI / 2;

// ---------- plates ----------

/** Outline (counter-clockwise, cm) and five holes to hang each plate from. */
export const SHAPES = {
  rect: { pts: [[0, 0], [16, 0], [16, 10], [0, 10]], pins: [[1, 9], [15, 9], [8, 9], [12, 1], [1, 5]] },
  L: { pts: [[0, 0], [16, 0], [16, 7], [7, 7], [7, 16], [0, 16]], pins: [[1, 15], [15, 6], [6, 15], [15, 1], [1, 1]] },
  triangle: { pts: [[0, 0], [18, 0], [5, 14]], pins: [[5, 12.5], [16, 0.8], [1.5, 0.8], [9, 0.8], [11, 6]] },
  polygon: { pts: [[0, 4], [9, 0], [17, 5], [14, 14], [5, 16]], pins: [[5.5, 14.5], [15.5, 5.5], [13, 12.5], [9, 1.5], [1.5, 5]] },
};
export const PINS = 5;
export const SIZE = 18; // cm, every plate fits in a SIZE × SIZE square
export const TOLERANCE = 0.5; // cm, how close the learner's mark must be to the centre of gravity

const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const edges = pts => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);

/** Signed area by the shoelace formula (positive for a counter-clockwise outline). */
export const area = pts => edges(pts).reduce((sum, [a, b]) => sum + cross(a, b), 0) / 2;

/** Centre of gravity of a uniform plate: Cx = Σ(xᵢ + xᵢ₊₁)(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ) / (6A), likewise Cy. */
export function centroid(pts) {
  const A = area(pts);
  let x = 0;
  let y = 0;
  for (const [a, b] of edges(pts)) {
    x += (a[0] + b[0]) * cross(a, b);
    y += (a[1] + b[1]) * cross(a, b);
  }
  return [x / (6 * A), y / (6 * A)];
}

/** Square of the radius of gyration about the centre of gravity (cm²): polar second moment of area / area. */
export function gyration2(pts) {
  const A = area(pts);
  const [cx, cy] = centroid(pts);
  let j = 0;
  for (const [a, b] of edges(pts)) {
    j += cross(a, b) * (a[0] * a[0] + a[0] * b[0] + b[0] * b[0] + a[1] * a[1] + a[1] * b[1] + b[1] * b[1]);
  }
  return j / (12 * A) - cx * cx - cy * cy;
}

export function inside(pts, [x, y]) {
  let hit = false;
  for (const [a, b] of edges(pts)) {
    if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) hit = !hit;
  }
  return hit;
}

const shapeOf = s => SHAPES[s.shape] ?? SHAPES.rect;
export const pinOf = s => shapeOf(s).pins[Math.min(PINS, Math.max(1, Math.round(s.pin) || 1)) - 1];
const rotate = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI)); // into [−π, π]

/** Rotation of the plate (from the way it is drawn in SHAPES) at which it hangs at rest from this pin. */
export function equilibriumAngle(shape, pin) {
  const { pts, pins } = SHAPES[shape];
  const [cx, cy] = centroid(pts);
  const [px, py] = pins[pin - 1];
  return wrap(-QUARTER - Math.atan2(cy - py, cx - px));
}

/** Angle of the line pin → centre of gravity from the downward vertical; 0 at rest. */
export function lean(s) {
  const [cx, cy] = centroid(shapeOf(s).pts);
  const [px, py] = pinOf(s);
  return wrap(Math.atan2(cy - py, cx - px) + s.angle + QUARTER);
}

/** A point of the plate (cm, plate coordinates) relative to the pin, y upwards, at the current rotation. */
export const toWorld = (s, [x, y]) => rotate([x - pinOf(s)[0], y - pinOf(s)[1]], s.angle);
/** The inverse: from a position relative to the pin to plate coordinates. */
export function toPlate(s, w) {
  const [x, y] = rotate(w, -s.angle);
  return [x + pinOf(s)[0], y + pinOf(s)[1]];
}

export const isSettled = s => s.omega === 0 && Math.abs(lean(s)) < 1e-9;

/**
 * The plumb line through a pin, as drawn on the plate: it starts at the pin and runs in the
 * direction that pointed straight down while the plate hung at rotation `angle`.
 */
export function plumbLine(shape, pin, angle = equilibriumAngle(shape, pin)) {
  const [x, y] = SHAPES[shape].pins[pin - 1];
  const [dx, dy] = rotate([0, -1], -angle);
  return { x, y, dx, dy };
}

/** Where two lines { x, y, dx, dy } cross. */
export function intersect(a, b) {
  const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / (a.dx * b.dy - a.dy * b.dx);
  return [a.x + t * a.dx, a.y + t * a.dy];
}

const HANG_DAMPING = 2.5; // 1/s, air and pin friction, so the plate comes to rest in a few seconds

/**
 * Swing of the plate as a physical pendulum: (k² + d²)·φ″ = −g·d·sin φ, with d the distance from
 * the pin to the centre of gravity and k the radius of gyration. Returns true on the step it comes to rest.
 */
export function stepHang(s, dt) {
  if (isSettled(s)) return false;
  const { pts } = shapeOf(s);
  const [cx, cy] = centroid(pts);
  const [px, py] = pinOf(s);
  const d = Math.hypot(cx - px, cy - py) / 100; // m
  const k2 = gyration2(pts) / 1e4; // m²
  const phi = lean(s);
  s.omega += (-((G * d) / (k2 + d * d)) * Math.sin(phi) - HANG_DAMPING * s.omega) * dt;
  s.angle = wrap(s.angle + s.omega * dt);
  if (Math.abs(lean(s)) < 0.003 && Math.abs(s.omega) < 0.01) {
    const pin = shapeOf(s).pins.indexOf(pinOf(s)) + 1;
    s.angle = equilibriumAngle(s.shape in SHAPES ? s.shape : "rect", pin);
    s.omega = 0;
    s.traced |= 1 << (pin - 1); // the plumb line through this hole is now drawn on the plate
    return true;
  }
  return false;
}

/** Number of plumb lines drawn so far. */
export const lineCount = s => [0, 1, 2, 3, 4].filter(i => s.traced & (1 << i)).length;

/** Distance (cm) from the learner's mark to the centre of gravity. */
export function markError(s) {
  const [cx, cy] = centroid(shapeOf(s).pts);
  return Math.hypot(s.guessX - cx, s.guessY - cy);
}

// ---------- block on a ramp ----------

/** A body topples when tan θ exceeds (half the base) / (height of the centre of gravity above the base). */
export const toppleAngle = (halfBase, centreHeight) => Math.atan(halfBase / centreHeight);
/** Uniform block, base b and height H: the centre is at H/2, so tan θ₀ = (b/2)/(H/2) = b/H. */
export const criticalAngle = (base, height) => toppleAngle(base / 2, height / 2);
/** How far down the slope from the middle of the base the vertical through the centre meets the ramp (cm). */
export const footOffset = (height, slope) => (height / 2) * Math.tan(slope);
export const isStable = (base, height, slope) => footOffset(height, slope) <= base / 2;
export const hasToppled = s => s.tilt >= QUARTER - 1e-9;

/**
 * The block does not slide. Once the vertical through its centre passes the lower edge it turns
 * about that edge like a rod falling over, until it lies on its side. Returns true on the step it lands.
 */
export function stepTopple(s, dt) {
  if (hasToppled(s)) return false;
  const slope = (s.slope * Math.PI) / 180;
  const psi = slope - criticalAngle(s.base, s.height) + s.tilt; // lean of the line edge → centre past the vertical
  if (s.tilt === 0 && psi <= 0) return false;
  const diagonal = Math.hypot(s.base, s.height) / 100; // m
  s.tiltSpeed += ((3 * G) / (2 * diagonal)) * Math.sin(psi) * dt; // about the edge: k² + d² = (b² + H²)/3
  s.tilt += s.tiltSpeed * dt;
  if (s.tilt <= 0) {
    s.tilt = 0; // settled back on its base
    s.tiltSpeed = 0;
  }
  if (s.tilt >= QUARTER) {
    s.tilt = QUARTER;
    s.tiltSpeed = 0;
    return true;
  }
  return false;
}

// ---------- ball on a curved surface ----------

export const RIM = 1; // m, the track runs from x = −RIM to x = RIM
/** Height of the track y = ½·c·x² (m); c is its curvature at the equilibrium point x = 0 (1/m). */
export const surfaceY = (c, x) => 0.5 * c * x * x;
/** Kind of equilibrium at x = 0 from the sign of the curvature. */
export const equilibriumType = c => (c > 0 ? "stable" : c < 0 ? "unstable" : "neutral");

const BALL_DAMPING = 1; // 1/s

/** A small ball sliding along the track under gravity with a little resistance. */
export function stepBall(s, dt) {
  const c = s.curvature;
  const slope = c * s.ballX;
  const a = -(slope * (G + c * s.ballV * s.ballV)) / (1 + slope * slope) - BALL_DAMPING * s.ballV;
  s.ballV += a * dt;
  s.ballX += s.ballV * dt;
  if (Math.abs(s.ballX) >= RIM) {
    s.ballX = Math.sign(s.ballX) * RIM; // stopped by the rim
    s.ballV = 0;
  }
  if (Math.abs(s.ballV) < 1e-4 && Math.abs(a) < 1e-3) s.ballV = 0;
  return s;
}

// ---------- state ----------

export const initialState = () => ({
  mode: "hang",
  shape: "L",
  pin: 1,
  angle: equilibriumAngle("L", 1), // rad, rotation of the plate
  omega: 0, // rad/s
  traced: 1, // bit i set = the plumb line through hole i + 1 has been drawn
  marking: false,
  guessX: 9, // cm, the learner's mark, in plate coordinates
  guessY: 9,
  guessed: false, // a mark has been placed
  found: false, // the mark has been within TOLERANCE of the centre of gravity
  showCentre: false,
  slope: 12, // degrees
  base: 6, // cm
  height: 18, // cm
  tilt: 0, // rad the block has turned about its lower edge; π/2 = lying on its side
  tiltSpeed: 0, // rad/s
  curvature: 1, // 1/m
  ballX: 0.6, // m
  ballV: 0, // m/s
});

/** Keys without a control arrive unclamped from a saved state: keep them in a sane range. */
export function tidy(s) {
  const lim = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  s.angle = wrap(s.angle);
  s.omega = lim(s.omega, -60, 60);
  s.traced = lim(Math.round(s.traced), 0, 31);
  s.tilt = lim(s.tilt, 0, QUARTER);
  s.tiltSpeed = lim(s.tiltSpeed, -60, 60);
  s.ballV = lim(s.ballV, -30, 30);
  return s;
}

/** A fresh plate: hung from hole 1 the way it is drawn, no plumb lines, no mark. */
export function newShape(s) {
  s.pin = 1;
  s.angle = 0;
  s.omega = 0;
  s.traced = 0;
  s.guessed = false;
  s.found = false;
  return s;
}
