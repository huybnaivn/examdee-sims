// Thin lens. Lengths in cm. Sign convention of the Vietnamese textbook:
// f > 0 converging, f < 0 diverging; d > 0 real object; d' > 0 real image, d' < 0 virtual image.

export const initialState = () => ({
  lensType: "converging", // or "diverging"
  focal: 15, // |f|, cm
  distance: 25, // d, object to lens, cm
  height: 5, // object height AB, cm
});

/** Signed focal length f. */
export const focalLength = s => (s.lensType === "diverging" ? -s.focal : s.focal);

/** d' from 1/f = 1/d + 1/d'. Infinity when the object sits on the focal point. */
export function imageDistance(s) {
  const f = focalLength(s);
  return s.distance === f ? Infinity : (s.distance * f) / (s.distance - f);
}

/** k = -d'/d = f/(f - d). Positive: upright image. */
export function magnification(s) {
  const f = focalLength(s);
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
 * The three principal rays from the object tip (-d, h), lens at x = 0, light travelling to +x.
 * Each is { y, slope }: the height where it meets the lens and its slope after the lens.
 *  1. parallel to the axis, then through (or away from) the image focus F'(f, 0)
 *  2. through the optical centre, undeviated
 *  3. through (or towards) the object focus F(-f, 0), then parallel to the axis
 * Ray 3 does not reach the lens when the object is on the focal point.
 */
export function principalRays(s) {
  const f = focalLength(s);
  const rays = [
    { y: s.height, slope: -s.height / f },
    { y: 0, slope: -s.height / s.distance },
  ];
  if (s.distance !== f) rays.push({ y: (s.height * f) / (f - s.distance), slope: 0 });
  return rays;
}
