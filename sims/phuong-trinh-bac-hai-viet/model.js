// Quadratic equation ax² + bx + c = 0 (grade 9): Δ, Δ′, Viète's relations, quick roots,
// and the reverse problem (two numbers from their sum and product). Pure maths, no DOM.

export const initialState = () => ({
  mode: "delta", // "delta" | "deltaPrime" | "viete" | "reverse"
  a: 1,
  b: -2,
  c: -3,
  sum: 5, // reverse problem: given u + v
  product: 6, // reverse problem: given u·v
  u: 0, // learner's two numbers
  v: 0,
  showAnswer: false,
});

/**
 * Solve ax² + bx + c = 0. `rootCount` is the number of distinct real roots, −1 when every x
 * is a root. Roots are in textbook order: x₁ uses +√Δ, x₂ uses −√Δ.
 */
export function solve(a, b, c) {
  if (a === 0) {
    if (b === 0) return { type: "constant", roots: [], rootCount: c === 0 ? -1 : 0 };
    return { type: "linear", roots: [-c / b + 0], rootCount: 1 };
  }
  const delta = b * b - 4 * a * c;
  const dp = deltaPrime(a, b, c);
  let roots = [];
  if (delta > 0) roots = [(-b + Math.sqrt(delta)) / (2 * a) + 0, (-b - Math.sqrt(delta)) / (2 * a) + 0];
  else if (delta === 0) roots = [-b / (2 * a) + 0];
  return { type: "quadratic", delta, deltaPrime: dp, roots, rootCount: roots.length };
}

/** Δ′ = b′² − ac with b = 2b′. */
export const deltaPrime = (a, b, c) => (b / 2) ** 2 - a * c;

/** Roots from the reduced formula x = (−b′ ± √Δ′)/a; same order as solve(). Needs a ≠ 0. */
export function rootsByDeltaPrime(a, b, c) {
  const dp = deltaPrime(a, b, c);
  if (dp < 0) return [];
  if (dp === 0) return [-(b / 2) / a + 0];
  return [(-b / 2 + Math.sqrt(dp)) / a + 0, (-b / 2 - Math.sqrt(dp)) / a + 0];
}

/** Viète: S = x₁ + x₂ = −b/a, P = x₁·x₂ = c/a. Only for a ≠ 0 and Δ ≥ 0, else null. */
export function viete(a, b, c) {
  if (a === 0 || b * b - 4 * a * c < 0) return null;
  return { sum: -b / a + 0, product: c / a + 0 };
}

/** Quick roots: a + b + c = 0 gives 1 and c/a; a − b + c = 0 gives −1 and −c/a. Else null. */
export function quickRoots(a, b, c) {
  if (a === 0) return null;
  if (a + b + c === 0) return { rule: "plus", roots: [1, c / a + 0] };
  if (a - b + c === 0) return { rule: "minus", roots: [-1, -c / a + 0] };
  return null;
}

/** Two numbers with the given sum and product: roots of X² − SX + P = 0. Null if S² − 4P < 0. */
export function twoNumbers(sum, product) {
  const d = sum * sum - 4 * product;
  if (d < 0) return null;
  return [(sum + Math.sqrt(d)) / 2 + 0, (sum - Math.sqrt(d)) / 2 + 0];
}

export const isMatch = s => s.u + s.v === s.sum && s.u * s.v === s.product;

/** A reverse problem with whole-number answers in −6…6. `rand` returns a number in [0, 1). */
export function newProblem(rand = Math.random) {
  const pick = () => Math.floor(rand() * 13) - 6;
  const p = pick();
  const q = pick();
  return { sum: p + q, product: p * q };
}

/** The equation the current mode is about: the reverse problem is X² − SX + P = 0. */
export const equation = s => (s.mode === "reverse" ? { a: 1, b: -s.sum + 0, c: s.product } : { a: s.a, b: s.b, c: s.c });
