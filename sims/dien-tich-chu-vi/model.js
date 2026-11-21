// A rectangle with whole-number sides on a unit grid, and challenges about its area and perimeter.

export const MAX_A = 12; // longest horizontal side offered
export const MAX_B = 10; // longest vertical side offered

export const initialState = () => ({
  a: 8, // horizontal side
  b: 3, // vertical side
  challenge: "a24",
  showCount: true,
  met: false, // the current challenge is met right now (so the goal is reported once)
});

export const area = (a, b) => a * b;
export const perimeter = (a, b) => 2 * (a + b);

// A challenge fixes the area and/or the perimeter and may ask to optimise the other quantity.
export const CHALLENGES = {
  free: {},
  a24: { area: 24, optimize: "minPerimeter" },
  a36: { area: 36, optimize: "minPerimeter" },
  p20: { perimeter: 20, optimize: "maxArea" },
  p22: { perimeter: 22, optimize: "maxArea" },
  a12p16: { area: 12, perimeter: 16 },
};

const fits = (c, a, b) =>
  (c.area == null || area(a, b) === c.area) && (c.perimeter == null || perimeter(a, b) === c.perimeter);

const objective = (c, a, b) =>
  c.optimize === "minPerimeter" ? -perimeter(a, b) : c.optimize === "maxArea" ? area(a, b) : 0;

/** Every rectangle on the grid that satisfies the fixed part of a challenge. */
export function candidates(c, maxA = MAX_A, maxB = MAX_B) {
  const list = [];
  for (let a = 1; a <= maxA; a++) for (let b = 1; b <= maxB; b++) if (fits(c, a, b)) list.push([a, b]);
  return list;
}

/** The best rectangles (by the challenge's objective) among the candidates. */
export function best(c, maxA = MAX_A, maxB = MAX_B) {
  const list = candidates(c, maxA, maxB);
  const top = Math.max(...list.map(([a, b]) => objective(c, a, b)));
  return list.filter(([a, b]) => objective(c, a, b) === top);
}

/** fixed: the required area/perimeter is right. optimal: nothing on the grid does better. ok: target met. */
export function check(id, a, b) {
  const c = CHALLENGES[id] ?? {};
  const fixed = fits(c, a, b);
  const optimal = fixed && best(c).some(([x, y]) => x === a && y === b);
  return { fixed, optimal, ok: id !== "free" && id in CHALLENGES && optimal };
}
