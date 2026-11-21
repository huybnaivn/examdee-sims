// Adding two plane vectors a and b given by their components.

export const LIMIT = 5; // components stay within [-LIMIT, LIMIT]

export const initialState = () => ({
  ax: 4,
  ay: 1,
  bx: 1,
  by: 3,
  method: "parallelogram", // or "tip-to-tail"
  showComponents: false,
});

export const sum = s => ({ x: s.ax + s.bx, y: s.ay + s.by });
export const magnitude = (x, y) => Math.hypot(x, y);

/** Direction in degrees, counter-clockwise from the positive x axis, in [0, 360). Null vector: 0. */
export const direction = (x, y) => {
  if (x === 0 && y === 0) return 0;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/** Angle between a and b in degrees, [0, 180]. NaN if either is the null vector. */
export const angleBetween = s => {
  if (!magnitude(s.ax, s.ay) || !magnitude(s.bx, s.by)) return NaN;
  // atan2(|cross|, dot) stays exact for parallel vectors, where acos loses precision.
  const cross = s.ax * s.by - s.ay * s.bx;
  const dot = s.ax * s.bx + s.ay * s.by;
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
};
