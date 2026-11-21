// Percentages: three basic problems, and increase / decrease by a percentage.
// "whole" is the number taken as 100 %, "part" is the value of `percent` % of it.

export const MAX = 200; // largest whole or part the sliders offer

const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : 0)));

export const initialState = () => ({
  type: "part", // "part" | "whole" | "percent" | "change"
  whole: 80,
  percent: 25,
  part: 20,
  change: "updown", // "up" | "down" | "updown" (only for type "change")
});

/** p % of a. */
export const percentOf = (a, p) => (a * p) / 100;

/** The number whose p % is `part`; null when p = 0 (cannot divide by zero). */
export const wholeFrom = (part, p) => (p === 0 ? null : (part * 100) / p);

/** What percentage `part` is of `whole`; null when whole = 0. */
export const percentRatio = (part, whole) => (whole === 0 ? null : (part / whole) * 100);

export const increase = (a, p) => a * (1 + p / 100);
export const decrease = (a, p) => a * (1 - p / 100);

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

/** Fraction n/d in lowest terms as [n, d] with d > 0; null when d = 0. Whole numbers only. */
export function simplify(n, d) {
  if (d === 0 || !Number.isInteger(n) || !Number.isInteger(d)) return null;
  const g = gcd(n, d) * Math.sign(d);
  return [n / g, d / g];
}

/** A percentage as a decimal number: 25 % = 0,25. */
export const toDecimal = p => p / 100;

/**
 * Work out the unknown of the chosen problem.
 * Returns whole, percent, part (null when it cannot be found), the percentage as a lowest-terms
 * fraction and a decimal, and for type "change" the values after each step.
 */
export function solve(s) {
  const type = ["part", "whole", "percent", "change"].includes(s.type) ? s.type : "part";
  let whole = int(s.whole, 0, MAX);
  let percent = int(s.percent, 0, 100);
  let part = int(s.part, 0, MAX);
  let fraction = simplify(percent, 100);
  if (type === "whole") whole = wholeFrom(part, percent);
  else if (type === "percent") {
    percent = percentRatio(part, whole);
    fraction = simplify(part, whole);
  } else part = percentOf(whole, percent);
  const out = { type, whole, percent, part, fraction, decimal: percent === null ? null : toDecimal(percent), valid: whole !== null && percent !== null };
  if (type === "change") {
    const mode = ["up", "down", "updown"].includes(s.change) ? s.change : "updown";
    const steps = [whole];
    if (mode !== "down") steps.push(increase(steps.at(-1), percent));
    if (mode !== "up") steps.push(decrease(steps.at(-1), percent));
    Object.assign(out, { mode, steps, final: steps.at(-1) });
  }
  return out;
}
