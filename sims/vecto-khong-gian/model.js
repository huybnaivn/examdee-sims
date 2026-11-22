// Vectors in Oxyz. Right-handed axes, z up. Coordinates are plain numbers (the unit of the axes).

export const RANGE = 5; // sliders run from −RANGE to RANGE
export const MODES = ["sum", "diff", "cross", "none"];

export const initialState = () => ({
  ax: 1, ay: 4, az: 3,
  bx: 2, by: -3, bz: 2,
  show: "sum", // which extra vector is drawn
  showPoint: false, // projections of the point A (tip of a) on the coordinate planes
  yaw: -28, // degrees, turn of the view about Oz
  pitch: 22, // degrees, how far the view looks down on (Oxy)
  perp: false, // true once the committed vectors are perpendicular (so the goal is reported once)
});

const comp = v => Math.min(RANGE, Math.max(-RANGE, Number.isFinite(v) ? v : 0)); // forged state stays in range
export const vecA = s => [comp(s.ax), comp(s.ay), comp(s.az)];
export const vecB = s => [comp(s.bx), comp(s.by), comp(s.bz)];

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = a => Math.sqrt(dot(a, a));
/** Tích có hướng [a, b] = (a₂b₃ − a₃b₂; a₃b₁ − a₁b₃; a₁b₂ − a₂b₁). */
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Angle between a and b in degrees (0…180), or null when one of them is the zero vector. */
export function angle(a, b) {
  const la = length(a);
  const lb = length(b);
  if (!la || !lb) return null;
  return (Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (la * lb)))) * 180) / Math.PI;
}

/** Perpendicular: both non-zero and a·b = 0. */
export const perpendicular = (a, b) => length(a) > 0 && length(b) > 0 && Math.abs(dot(a, b)) < 1e-9;

/** Orthogonal projections of the point p on (Oxy), (Oyz), (Oxz): one coordinate becomes 0. */
export const projections = p => ({ xy: [p[0], p[1], 0], yz: [0, p[1], p[2]], xz: [p[0], 0, p[2]] });

/**
 * Turn the scene for viewing: yaw about Oz, then tilt by pitch. Returns [right, up, towards the viewer].
 * A rotation, so lengths and angles are kept; the picture is its parallel projection [right, up].
 */
export function rotate(p, yawDeg, pitchDeg) {
  const y = (yawDeg * Math.PI) / 180;
  const t = (pitchDeg * Math.PI) / 180;
  const front = p[0] * Math.cos(y) - p[1] * Math.sin(y);
  const right = p[0] * Math.sin(y) + p[1] * Math.cos(y);
  return [right, p[2] * Math.cos(t) - front * Math.sin(t), p[2] * Math.sin(t) + front * Math.cos(t)];
}

/** Everything shown on screen, from one place. */
export function measure(s) {
  const a = vecA(s);
  const b = vecB(s);
  const n = cross(a, b);
  return {
    a, b,
    sum: add(a, b),
    diff: sub(a, b),
    cross: n,
    dot: dot(a, b),
    lenA: length(a),
    lenB: length(b),
    angle: angle(a, b),
    area: length(n), // |[a, b]| = |a||b|sin θ, the area of the parallelogram on a and b
    perpendicular: perpendicular(a, b),
  };
}
