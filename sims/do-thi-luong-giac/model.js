// y = a·f(b·x + c) + d with f = sin, cos or tan.
// The state stores c in units of π/12 (an integer), so every phase is an exact fraction of π.

export const C_UNIT = Math.PI / 12;

export const initialState = () => ({
  fn: "sin", // "sin" | "cos" | "tan"
  a: 2,
  b: 2,
  c: 4, // × π/12, so π/3
  d: 1,
  showParent: true,
});

const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const defined = (fn, u) => fn !== "tan" || Math.abs(Math.cos(u)) > 1e-12;

/** c in radians. */
export const phase = s => s.c * C_UNIT;

/** The parent function y = f(x); null where tan is undefined. */
export const parent = (fn, x) => (defined(fn, x) ? F[fn](x) : null);

/** y at x; null where tan is undefined. a = 0 gives the constant d. */
export function evaluate(s, x) {
  if (s.a === 0) return s.d;
  const y = parent(s.fn, s.b * x + phase(s));
  return y === null ? null : s.a * y + s.d;
}

/**
 * Textbook characteristics. Fields that do not apply are null:
 * amplitude for tan, period and range of a constant, phase shift when b = 0.
 * a = 0 or b = 0 makes the function constant (`value`, null if tan is undefined there).
 */
export function analyze(s) {
  const tan = s.fn === "tan";
  const constant = s.a === 0 || s.b === 0;
  const absA = Math.abs(s.a);
  const value = constant ? evaluate(s, 0) : null;
  return {
    constant,
    value,
    amplitude: tan ? null : constant ? 0 : absA,
    period: constant ? null : (tan ? Math.PI : 2 * Math.PI) / Math.abs(s.b),
    phaseShift: s.b === 0 ? null : -phase(s) / s.b + 0, // + 0 turns −0 into 0
    verticalShift: s.d,
    range: constant ? (value === null ? null : [value, value]) : tan ? [-Infinity, Infinity] : [s.d - absA, s.d + absA],
  };
}

/** Solutions of a·f(b·x + c) + d = 0 in [lo, hi], ascending. Empty for a constant function. */
export function zeros(s, lo, hi) {
  if (s.a === 0 || s.b === 0) return [];
  const t = -s.d / s.a; // f(u) = t
  let bases;
  let period = 2 * Math.PI;
  if (s.fn === "tan") {
    bases = [Math.atan(t)];
    period = Math.PI;
  } else {
    if (Math.abs(t) > 1 + 1e-12) return [];
    const tt = Math.min(1, Math.max(-1, t));
    bases = s.fn === "sin" ? [Math.asin(tt), Math.PI - Math.asin(tt)] : [Math.acos(tt), -Math.acos(tt)];
  }
  const ph = phase(s);
  const out = [];
  for (const u of bases) {
    const k1 = (s.b * lo + ph - u) / period;
    const k2 = (s.b * hi + ph - u) / period;
    for (let k = Math.ceil(Math.min(k1, k2) - 1e-9); k <= Math.floor(Math.max(k1, k2) + 1e-9); k++) {
      out.push((u + k * period - ph) / s.b + 0);
    }
  }
  out.sort((p, q) => p - q);
  return out.filter((x, i) => i === 0 || x - out[i - 1] > 1e-9);
}

/** x of one maximum of the sin / cos form (needs a ≠ 0 and b ≠ 0). */
export function peakX(s) {
  const u = s.fn === "sin" ? Math.sign(s.a) * (Math.PI / 2) : s.a > 0 ? 0 : Math.PI;
  return (u - phase(s)) / s.b;
}

/** x as an exact multiple of π ("−3π/4", "2π", "0"), or null if it is not p·π/q with q ≤ 48. */
export function piText(x) {
  const r = x / Math.PI;
  for (let q = 1; q <= 48; q++) {
    const p = Math.round(r * q);
    if (Math.abs(r * q - p) > 1e-9) continue;
    if (p === 0) return "0";
    const n = Math.abs(p);
    return (p < 0 ? "−" : "") + (n === 1 ? "" : n) + "π" + (q === 1 ? "" : "/" + q);
  }
  return null;
}

const num = v => String(Math.abs(v)).replace(".", ",");
const coef = k => (k < 0 ? "−" : "") + (Math.abs(k) === 1 ? "" : num(k));

/** The formula as written in a Vietnamese textbook, e.g. "y = 2sin(2x + π/3) + 1". */
export function formula(s) {
  if (s.a === 0) return `y = ${s.d < 0 ? "−" : ""}${num(s.d)}`;
  const ph = phase(s);
  let inner = piText(ph);
  if (s.b !== 0) inner = `${coef(s.b)}x` + (s.c === 0 ? "" : ` ${s.c > 0 ? "+" : "−"} ${piText(Math.abs(ph))}`);
  const simple = !inner.includes(" ") && !inner.startsWith("−");
  const tail = s.d === 0 ? "" : ` ${s.d > 0 ? "+" : "−"} ${num(s.d)}`;
  return `y = ${coef(s.a)}${s.fn}${simple ? " " + inner : `(${inner})`}${tail}`;
}
