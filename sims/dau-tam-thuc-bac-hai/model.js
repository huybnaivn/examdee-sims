// Sign of f(x) = ax² + bx + c and the quadratic inequalities f(x) > 0, ≥ 0, < 0, ≤ 0 (grade 10).
// Pure maths, no DOM.

export const INEQ = ["gt", "ge", "lt", "le"]; // index = code used in events
// Shape of a solution set; index = code used in events. x₁ < x₂ are the roots, x₀ a single root.
export const TYPES = [
  "empty", // ∅
  "all", // ℝ
  "point", // {x₀}
  "allExcept", // ℝ \ {x₀}
  "between", // (x₁; x₂)
  "betweenClosed", // [x₁; x₂]
  "outside", // (−∞; x₁) ∪ (x₂; +∞)
  "outsideClosed", // (−∞; x₁] ∪ [x₂; +∞)
  "left", // (−∞; x₀)      only when a = 0
  "leftClosed", // (−∞; x₀]
  "right", // (x₀; +∞)
  "rightClosed", // [x₀; +∞)
];

export const initialState = () => ({
  a: 1,
  b: -1,
  c: -2,
  ineq: "gt",
  practice: false,
  answer: "none", // the learner's choice in practice: "none" or one of TYPES
});

export const f = (a, b, c, x) => a * x * x + b * x + c;

/**
 * Roots in increasing order and the sign of f on each of the roots.length + 1 intervals they cut
 * the line into. For a ≠ 0 this is the textbook rule: Δ < 0 → the sign of a everywhere;
 * Δ = 0 → the sign of a except at −b/(2a); Δ > 0 → opposite to a between the roots, same outside.
 */
export function analyze(a, b, c) {
  if (a === 0) {
    if (b === 0) return { degree: 0, roots: [], signs: [Math.sign(c)] };
    return { degree: 1, roots: [-c / b + 0], signs: [-Math.sign(b), Math.sign(b)] };
  }
  const delta = b * b - 4 * a * c;
  const sa = Math.sign(a);
  if (delta < 0) return { degree: 2, delta, roots: [], signs: [sa] };
  if (delta === 0) return { degree: 2, delta, roots: [-b / (2 * a) + 0], signs: [sa, sa] };
  const q = Math.sqrt(delta);
  const roots = [(-b - q) / (2 * a) + 0, (-b + q) / (2 * a) + 0].sort((x, y) => x - y);
  return { degree: 2, delta, roots, signs: [sa, -sa, sa] };
}

/**
 * Solution set of f(x) ⋛ 0 as a list of disjoint intervals in increasing order,
 * each { lo, hi, loClosed, hiClosed }; a single point has lo = hi. `type` is one of TYPES.
 */
export function solutionSet(a, b, c, ineq) {
  const { roots, signs } = analyze(a, b, c);
  const strict = ineq === "gt" || ineq === "lt";
  const want = ineq === "gt" || ineq === "ge" ? 1 : -1;
  const ok = sign => sign === want || (sign === 0 && !strict);
  const intervals = [];
  let cur = null;
  signs.forEach((sign, i) => {
    if (ok(sign)) {
      const hi = i < roots.length ? roots[i] : Infinity;
      if (cur) Object.assign(cur, { hi, hiClosed: false });
      else intervals.push((cur = { lo: i ? roots[i - 1] : -Infinity, hi, loClosed: false, hiClosed: false }));
    } else cur = null;
    if (i >= roots.length) return;
    // the root itself: f = 0 there, a solution only of the non-strict inequalities
    if (strict) cur = null;
    else if (cur) cur.hiClosed = true;
    else intervals.push((cur = { lo: roots[i], hi: roots[i], loClosed: true, hiClosed: true }));
  });
  return { intervals, type: classify(intervals) };
}

function classify(iv) {
  if (iv.length === 0) return "empty";
  const [p, q] = iv;
  if (q) return p.hi === q.lo ? "allExcept" : p.hiClosed ? "outsideClosed" : "outside";
  if (p.lo === -Infinity && p.hi === Infinity) return "all";
  if (p.lo === p.hi) return "point";
  if (p.lo === -Infinity) return p.hiClosed ? "leftClosed" : "left";
  if (p.hi === Infinity) return p.loClosed ? "rightClosed" : "right";
  return p.loClosed ? "betweenClosed" : "between";
}

export const contains = (intervals, x) =>
  intervals.some(i => (x > i.lo || (i.loClosed && x === i.lo)) && (x < i.hi || (i.hiClosed && x === i.hi)));

/** A practice exercise with whole coefficients: two roots, a double root or no root. */
export function newProblem(rand = Math.random) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const a = (rand() < 0.5 ? -1 : 1) * int(1, 2);
  const ineq = INEQ[int(0, 3)];
  const kind = rand();
  if (kind < 0.25) {
    // no root: a(x − h)² + k with k of the sign of a
    const h = int(-2, 2);
    const s = Math.sign(a);
    return { a: s, b: -2 * s * h + 0, c: s * (h * h + int(1, 3)), ineq };
  }
  const p = int(-3, 3);
  const q = kind < 0.5 ? p : int(-3, 3);
  return { a, b: -a * (p + q) + 0, c: a * p * q + 0, ineq };
}
