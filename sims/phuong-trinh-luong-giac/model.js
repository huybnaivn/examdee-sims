// Basic trigonometric equations: sin x = a, cos x = a, tan x = a, cot x = a.
// Angles are in radians inside the model. Angles that are whole multiples of π/12 are also
// carried as an integer `n12` (number of twelfths of π) so they can be written exactly.

const PI = Math.PI;
const R2 = Math.SQRT2;
const R3 = Math.sqrt(3);
const EPS = 1e-9;
const near = (u, v) => Math.abs(u - v) < EPS;

export const FORMS = ["sin", "cos", "tan", "cot"];
export const A_MIN = -2;
export const A_MAX = 2;

/** Special values of a. "free" means: take a from the slider. */
export const PRESETS = [
  { value: "free", label: "Tự chọn bằng thanh trượt", a: null },
  ...[
    ["0", "0", 0],
    ["1/2", "1/2", 0.5],
    ["r2/2", "√2/2", R2 / 2],
    ["r3/2", "√3/2", R3 / 2],
    ["1", "1", 1],
    ["r3/3", "√3/3", R3 / 3],
    ["r3", "√3", R3],
  ].flatMap(([value, label, a]) => (a === 0 ? [{ value, label, a }] : [{ value, label, a }, { value: `-${value}`, label: `−${label}`, a: -a }])),
];

/** Intervals [lo; hi] (closed), in twelfths of π. */
export const INTERVALS = {
  "0..2pi": [0, 24],
  "-pi..pi": [-12, 12],
  "-2pi..2pi": [-24, 24],
  "0..pi": [0, 12],
  "-pi/2..pi/2": [-6, 6],
  "-2pi..0": [-24, 0],
};

export const initialState = () => ({
  form: "sin", // "sin" | "cos" | "tan" | "cot"
  a: 0.5,
  preset: "1/2", // which special value the select shows; `a` is always the value used
  interval: "0..2pi",
  unit: "rad", // "rad" | "deg"
  practice: false,
  answer: 0,
  status: "", // "" | "right" | "wrong"
  solved: 0,
});

const formOf = form => (FORMS.includes(form) ? form : "sin");
const valueOf = a => Math.min(A_MAX, Math.max(A_MIN, Number.isFinite(a) ? a : 0));
const boundsOf = interval => INTERVALS[interval] ?? INTERVALS["0..2pi"];

/** Decimal comma, at most `digits` decimals, a real minus sign. */
export function num(v, digits = 2) {
  let t = v.toFixed(digits);
  if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
  if (Number(t) === 0) t = "0";
  return t.replace(".", ",").replace("-", "−");
}

/** a as the textbook writes it: √3/2 for the special values, a decimal otherwise. */
export function aLabel(a) {
  const special = PRESETS.find(p => p.a !== null && near(p.a, a));
  return special ? special.label : num(a, 2);
}

/** Value of the left-hand side at x (rad). */
export function f(form, x) {
  if (form === "cos") return Math.cos(x);
  if (form === "tan") return Math.tan(x);
  if (form === "cot") return Math.cos(x) / Math.sin(x);
  return Math.sin(x);
}

/** x (rad) as a whole number of twelfths of π, or null when it is not one. */
export function twelfths(x) {
  const n = (x * 12) / PI;
  return Math.abs(n - Math.round(n)) < 1e-7 ? Math.round(n) : null;
}

/**
 * The solution set as families x = base + k·period (k ∈ ℤ), in radians. Empty when there is no solution.
 *   sin x = a: x = α + k2π or x = π − α + k2π, α = arcsin a   (|a| ≤ 1)
 *   cos x = a: x = ±α + k2π, α = arccos a                      (|a| ≤ 1)
 *   tan x = a: x = α + kπ, α = arctan a
 *   cot x = a: x = α + kπ, α = arccot a ∈ (0; π)
 * The special cases a = 0, ±1 of sin and cos collapse to a single family.
 */
export function families(form, a) {
  form = formOf(form);
  a = valueOf(a);
  if (form === "tan") return [{ base: Math.atan(a), period: PI }];
  if (form === "cot") return [{ base: PI / 2 - Math.atan(a), period: PI }];
  if (Math.abs(a) > 1 + EPS) return [];
  a = Math.min(1, Math.max(-1, a));
  if (form === "sin") {
    if (near(a, 0)) return [{ base: 0, period: PI }];
    const alpha = Math.asin(a);
    if (near(Math.abs(a), 1)) return [{ base: alpha, period: 2 * PI }];
    return [{ base: alpha, period: 2 * PI }, { base: PI - alpha, period: 2 * PI }];
  }
  if (near(a, 0)) return [{ base: PI / 2, period: PI }];
  const alpha = Math.acos(a);
  if (near(Math.abs(a), 1)) return [{ base: alpha, period: 2 * PI }];
  return [{ base: alpha, period: 2 * PI }, { base: -alpha, period: 2 * PI }];
}

export const hasSolution = (form, a) => families(form, a).length > 0;

/** The angle α of the formulas (rad), or null when there is no solution. */
export const alpha = (form, a) => families(form, a)[0]?.base ?? null;

/** Angles in [0; 2π) of the points on the unit circle that represent the solutions. */
export function circleAngles(form, a) {
  const out = [];
  for (const fam of families(form, a)) {
    for (let x = fam.base; x < fam.base + 2 * PI - EPS; x += fam.period) out.push(((x % (2 * PI)) + 2 * PI) % (2 * PI));
  }
  return out.sort((u, v) => u - v);
}

/**
 * All solutions in the closed interval, ascending. `unit` "deg" works the whole thing out in degrees
 * (α in degrees, periods 360° and 180°); "rad" in radians. Each item: { x (in that unit), n12 }.
 */
export function solutions(form, a, interval, unit = "rad") {
  const k = unit === "deg" ? 180 / PI : 1;
  const [lo, hi] = boundsOf(interval).map(n => (unit === "deg" ? n * 15 : (n * PI) / 12));
  const tol = 1e-7 * k;
  const out = [];
  for (const fam of families(form, a)) {
    const base = fam.base * k;
    const period = fam.period * k;
    for (let i = Math.ceil((lo - base - tol) / period); base + i * period <= hi + tol; i++) {
      const x = base + i * period;
      out.push({ x, n12: twelfths(x / k) });
    }
  }
  return out.sort((u, v) => u.x - v.x);
}

export const count = s => solutions(s.form, s.a, s.interval).length;

const gcd = (u, v) => (v ? gcd(v, u % v) : Math.abs(u));

/** n twelfths of π written exactly: "5π/6", "−π/3", "2π", "0". */
export function piText(n12) {
  if (n12 === 0) return "0";
  const g = gcd(Math.abs(n12), 12);
  const p = Math.abs(n12) / g;
  const q = 12 / g;
  return `${n12 < 0 ? "−" : ""}${p === 1 ? "" : p}π${q === 1 ? "" : `/${q}`}`;
}

/** An angle given in radians, written in the chosen unit; exact when it is a multiple of π/12. */
export function angleText(x, unit = "rad") {
  const n12 = twelfths(x);
  if (unit === "deg") return `${n12 !== null ? num(n12 * 15, 0) : num((x * 180) / PI, 2)}°`;
  return n12 !== null ? piText(n12) : num(x, 3);
}

export function intervalText(interval, unit = "rad") {
  const [lo, hi] = boundsOf(interval);
  return `[${angleText((lo * PI) / 12, unit)}; ${angleText((hi * PI) / 12, unit)}]`;
}

const periodText = (period, unit) => (near(period, PI) ? (unit === "deg" ? "k180°" : "kπ") : unit === "deg" ? "k360°" : "k2π");

/**
 * The general solution as text lines. Exact angles are written out (x = π/6 + k2π);
 * otherwise the formula keeps α and `note` says what α is.
 */
export function general(form, a, unit = "rad") {
  form = formOf(form);
  a = valueOf(a);
  const fams = families(form, a);
  const condition = form === "tan" ? `x ≠ ${angleText(PI / 2, unit)} + ${periodText(PI, unit)}` : form === "cot" ? `x ≠ ${periodText(PI, unit)}` : "";
  if (!fams.length) return { none: true, lines: [], note: `Vô nghiệm vì |a| = ${aLabel(Math.abs(a))} > 1`, condition };
  if (fams.every(fam => twelfths(fam.base) !== null)) {
    const lines = fams.map(fam => {
      const k = periodText(fam.period, unit);
      return twelfths(fam.base) === 0 ? `x = ${k}` : `x = ${angleText(fam.base, unit)} + ${k}`;
    });
    return { none: false, lines, note: "", condition };
  }
  const k = periodText(fams[0].period, unit);
  const half = unit === "deg" ? "180°" : "π";
  const lines = form === "sin" ? [`x = α + ${k}`, `x = ${half} − α + ${k}`] : form === "cos" ? [`x = α + ${k}`, `x = −α + ${k}`] : [`x = α + ${k}`];
  const value = unit === "deg" ? angleText(fams[0].base, "deg") : `${num(fams[0].base, 3)} rad`;
  return { none: false, lines, note: `với ${form} α = ${aLabel(a)}, α ≈ ${value}`, condition };
}

export const isCorrect = s => Number.isInteger(s.answer) && s.answer === count(s);

/** Pose a new counting question. `rnd` returns a number in [0, 1). */
export function newQuestion(s, rnd = Math.random) {
  const pick = list => list[Math.floor(rnd() * list.length)];
  s.form = pick(FORMS);
  const circular = s.form === "sin" || s.form === "cos";
  const keys = circular ? ["0", "1/2", "r2/2", "r3/2", "1", "-1/2", "-r2/2", "-r3/2", "-1", "free"] : ["0", "r3/3", "1", "r3", "-r3/3", "-1", "-r3", "free"];
  s.preset = pick(keys);
  s.a = s.preset === "free" ? pick(circular ? [0.3, -0.6, 0.8, 1.5, -1.2] : [0.5, -0.5, 2, -1.5]) : PRESETS.find(p => p.value === s.preset).a;
  s.interval = pick(Object.keys(INTERVALS));
  s.answer = 0;
  s.status = "";
  return s;
}
