// Plane and spherical mirrors, paraxial (Gaussian) approximation. Lengths in cm.
// Sign convention (Vietnamese textbook): f > 0 concave mirror, f < 0 convex mirror, plane mirror f = ∞;
// d > 0 real object in front of the mirror; d' > 0 real image (in front of the mirror),
// d' < 0 virtual image (behind the mirror). Mirror equation 1/f = 1/d + 1/d', k = -d'/d.

export const initialState = () => ({
  mirrorType: "concave", // "plane", "concave" or "convex"
  focal: 15, // |f|, cm (spherical mirrors only; radius of curvature R = 2|f|)
  distance: 40, // d, object to mirror, cm
  height: 5, // object height AB, cm
});

/** Signed focal length f; Infinity for the plane mirror. */
export const focalLength = s => (s.mirrorType === "plane" ? Infinity : s.mirrorType === "convex" ? -s.focal : s.focal);

/** d' from 1/f = 1/d + 1/d'. Infinity when the object sits on the focal point of a concave mirror. */
export function imageDistance(s) {
  const f = focalLength(s);
  if (f === Infinity) return -s.distance;
  return s.distance === f ? Infinity : (s.distance * f) / (s.distance - f);
}

/** k = -d'/d = f/(f - d). Positive: upright image. */
export function magnification(s) {
  const f = focalLength(s);
  if (f === Infinity) return 1;
  return s.distance === f ? -Infinity : f / (f - s.distance);
}

/** Signed image height A'B' = k·AB (negative: inverted). */
export const imageHeight = s => magnification(s) * s.height;

export function describe(s) {
  const k = magnification(s);
  if (!Number.isFinite(k)) return { atInfinity: true };
  const size = Math.abs(Math.abs(k) - 1) < 1e-9 ? "equal" : Math.abs(k) > 1 ? "larger" : "smaller";
  return { atInfinity: false, real: imageDistance(s) > 0, upright: k > 0, size };
}

/**
 * Rays from the object tip (-d, h). Mirror vertex at x = 0, object on the side x < 0,
 * so a point at distance d' in front of the mirror is at x = -d' (a virtual image has x > 0).
 * Each ray is { y, slope }: the height where it meets the mirror and the line y + slope·x it
 * follows after reflection (x < 0 is the real reflected ray, x > 0 its extension behind the mirror).
 * Spherical mirror:
 *  1. parallel to the axis, reflected through (or away from) the focus F(-f, 0)
 *  2. to the vertex O, reflected symmetrically about the axis
 *  3. through (or towards) F, reflected parallel to the axis; missing when the object is on F
 * Plane mirror: three rays obeying the law of reflection, meeting the mirror at heights h, 0 and h/2.
 */
export function principalRays(s) {
  const f = focalLength(s);
  const { distance: d, height: h } = s;
  if (f === Infinity) return [h, 0, h / 2].map(y => ({ y, slope: (h - y) / d }));
  const rays = [
    { y: h, slope: h / f },
    { y: 0, slope: h / d },
  ];
  if (d !== f) rays.push({ y: (h * f) / (f - d), slope: 0 });
  return rays;
}
