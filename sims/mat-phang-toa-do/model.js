// The coordinate plane Oxy: points, quadrants, reflections, and a treasure hunt.
// Coordinates run from −RANGE to RANGE on both axes and snap to multiples of STEP.

export const RANGE = 6;
export const STEP = 0.5;

/** Treasures to place in game mode, in order: every quadrant, both axes, halves. */
export const TREASURES = [
  { name: "A", x: -3, y: 4 },
  { name: "B", x: 5, y: 2 },
  { name: "C", x: -4, y: -2.5 },
  { name: "D", x: 2, y: -5 },
  { name: "E", x: 0, y: 3 },
  { name: "F", x: -5, y: 0 },
  { name: "G", x: 1.5, y: 3.5 },
  { name: "H", x: 4.5, y: -1 },
];

export const initialState = () => ({
  mode: "explore", // "explore" | "game"
  x: 3,
  y: 2,
  showCoords: true,
  showMirror: false,
  found: 0, // treasures found so far in game mode
});

/** Nearest allowed coordinate. */
export const snap = v => Math.min(RANGE, Math.max(-RANGE, Math.round(v / STEP) * STEP)) + 0; // + 0 turns −0 into 0

/** Quadrant 1..4 (I..IV) from the signs; 0 for a point on an axis (it belongs to no quadrant). */
export function quadrant(x, y) {
  if (x === 0 || y === 0) return 0;
  if (y > 0) return x > 0 ? 1 : 2;
  return x < 0 ? 3 : 4;
}

/** Mirror image across "Ox", "Oy" or the origin "O". */
export function reflect(x, y, about) {
  if (about === "Ox") return [x, -y + 0];
  if (about === "Oy") return [-x + 0, y];
  return [-x + 0, -y + 0];
}

/** Is the point exactly on the target (coordinates are multiples of STEP, so compare with a tolerance). */
export const isAt = (x, y, t) => Math.abs(x - t.x) < 1e-9 && Math.abs(y - t.y) < 1e-9;

/** Number of treasures found, made safe against a forged state. */
export const foundCount = s => Math.min(TREASURES.length, Math.max(0, Math.floor(Number.isFinite(s.found) ? s.found : 0)));

/** The treasure to look for now, or null when all are found. */
export const target = s => TREASURES[foundCount(s)] ?? null;

/**
 * Place the point (already snapped). In game mode a correct placement counts the treasure.
 * Returns the treasure found, or null.
 */
export function place(s, x, y) {
  s.x = snap(x);
  s.y = snap(y);
  if (s.mode !== "game") return null;
  const t = target(s);
  if (!t || !isAt(s.x, s.y, t)) return null;
  s.found = foundCount(s) + 1;
  return t;
}

/** Screen grid: `ppu` px per unit, origin at (ox, oy). Shared by drawing and the pointer. */
export function grid(view, top) {
  const span = 2 * RANGE + 1.2;
  const ppu = Math.max(4, Math.min((view.w - 16) / span, (view.h - top - 6) / span));
  return { ppu, ox: view.w / 2, oy: top + (view.h - top) / 2 };
}
export const toScreen = (g, x, y) => [g.ox + x * g.ppu, g.oy - y * g.ppu];
export const fromScreen = (g, px, py) => [(px - g.ox) / g.ppu, (g.oy - py) / g.ppu];
