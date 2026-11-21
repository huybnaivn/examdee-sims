// Points on a unit circle, each stored as a whole-degree angle (counter-clockwise from +x),
// so they can never leave the circle. Angles are measured geometrically from coordinates;
// the tests then check them against the textbook theorems.

export const SNAP = 2; // A and B snap to a diameter within this many degrees

export const initialState = () => ({
  a: 200, // A
  b: 340, // B
  c: 90, // C, vertex of the inscribed angle ACB
  d: 140, // D, vertex of the second inscribed angle ADB
  second: true, // show ∠ADB
  tangent: false, // show the tangent at A and ∠(Ax, AB)
});

/** Whole degrees in [0, 360). Anything non-finite becomes 0. */
export const deg = v => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? ((r % 360) + 360) % 360 : 0;
};

export const point = t => ({ x: Math.cos((t * Math.PI) / 180), y: Math.sin((t * Math.PI) / 180) });

/** Angle between vectors u and v in degrees, 0..180. NaN when either is zero. */
export const between = (u, v) => {
  const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  if (n < 1e-12) return NaN;
  return (Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / n))) * 180) / Math.PI;
};

const vec = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });

/** ∠PVQ for points on the circle given by angles (vertex v). NaN if V coincides with P or Q. */
export const angleAt = (p, v, q) => between(vec(point(v), point(p)), vec(point(v), point(q)));

/** Counter-clockwise arc from angle p to angle q, in [0, 360). */
export const ccw = (p, q) => (((q - p) % 360) + 360) % 360;

/** True if X lies strictly inside the counter-clockwise arc from A to B. */
export const onCcwArc = (a, b, x) => ccw(a, x) > 0 && ccw(a, x) < ccw(a, b);

/** Measure of arc AB that does not contain X (the arc ∠AXB intercepts). */
export const arcAway = (a, b, x) => (onCcwArc(a, b, x) ? 360 - ccw(a, b) : ccw(a, b));

/** Snap the moving point to the end of the diameter through `other` if within SNAP degrees. */
export const snapDiameter = (moving, other) => {
  const opposite = deg(other + 180);
  return Math.abs(((moving - opposite + 540) % 360) - 180) <= SNAP ? opposite : deg(moving);
};

/** Unit direction of the tangent ray at A that points along the arc AB not containing C. */
export const tangentRay = (a, b, c) => {
  const t = (a * Math.PI) / 180;
  const sign = onCcwArc(a, b, c) ? -1 : 1; // arc away from C runs clockwise from A when C is on the ccw arc
  return { x: -Math.sin(t) * sign, y: Math.cos(t) * sign };
};

/** Every measure the sim shows. Degenerate angles (coincident points) are NaN. */
export function measures({ a, b, c, d }) {
  const arc = a === b ? NaN : arcAway(a, b, c);
  const sameSide = onCcwArc(a, b, c) === onCcwArc(a, b, d);
  return {
    inscribed: c === a || c === b ? NaN : angleAt(a, c, b), // ∠ACB
    arc, // sđ cung AB không chứa C
    central: Math.min(arc, 360 - arc), // ∠AOB (≤ 180°)
    second: d === a || d === b ? NaN : angleAt(a, d, b), // ∠ADB
    sameSide, // C and D on the same arc AB
    tangentChord: a === b ? NaN : between(tangentRay(a, b, c), vec(point(a), point(b))), // ∠(Ax, AB)
    diameter: ccw(a, b) === 180,
  };
}
