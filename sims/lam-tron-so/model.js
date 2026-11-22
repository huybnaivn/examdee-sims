// Rounding and estimating. Decimal numbers are kept as whole thousandths (2,45 is 2450),
// so every comparison with "the half" is exact: no binary floating point on the way.

export const SCALE = 1000;
export const MAX = 9999999; // 9999,999

// `unit` is the size of one step of the place, in thousandths.
export const PLACES = [
  { unit: 10, name: "hàng phần trăm", decimals: 2 },
  { unit: 100, name: "hàng phần mười", decimals: 1 },
  { unit: 1000, name: "hàng đơn vị", decimals: 0 },
  { unit: 10000, name: "hàng chục", decimals: 0 },
  { unit: 100000, name: "hàng trăm", decimals: 0 },
  { unit: 1000000, name: "hàng nghìn", decimals: 0 },
];
export const placeOf = unit => PLACES.find(p => p.unit === unit) ?? PLACES[3];

export const initialState = () => ({
  mode: "round", // "round" | "estimate" | "practice"
  neg: false,
  int: 2847, // whole part of |x|
  frac: 360, // decimal part of |x| in thousandths
  place: 10000, // unit of the rounding place, in thousandths
  // estimating
  eop: "add", // "add" | "mul"
  ea: 4876,
  eb: 2349,
  ePlace: 100, // rounding unit for both numbers; 0 = the highest place of each number
  // practice question: round pm (thousandths) to pUnit
  pm: 3470,
  pUnit: 100,
  _picked: null, // the mark the learner chose
  _drag: null,
});

const int = (v, lo, hi) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : lo;
};

/** The number of the "round" activity, in thousandths. */
export const valueOf = s => (s.neg === true ? -1 : 1) * (int(s.int, 0, 9999) * SCALE + int(s.frac, 0, 999)) || 0;

/** Split thousandths back into the three state keys. */
export const partsOf = m => {
  const a = Math.min(MAX, Math.abs(Math.round(m)));
  return { neg: m < 0 && a > 0, int: Math.floor(a / SCALE), frac: a % SCALE };
};

/**
 * Round the whole number n to a multiple of `unit`, by the textbook rule: look at the first
 * digit dropped; 5 or more adds one to the kept digit. A negative number is rounded through
 * its opposite (−2,5 → −3), so halves go away from zero.
 */
export function roundTo(n, unit) {
  const a = Math.abs(n);
  const r = Math.floor((2 * a + unit) / (2 * unit)) * unit; // floor((a + unit/2) / unit), in whole numbers
  return (n < 0 ? -r : r) || 0;
}

/** The two neighbouring marks of the place, the midpoint between them and how far n is from each. */
export function marks(n, unit) {
  const lo = Math.floor(n / unit) * unit;
  const hi = lo + unit;
  return { lo, hi, mid: lo + unit / 2, toLo: n - lo, toHi: hi - n, onMark: n === lo };
}

/** Digit of |n| at the place of `unit`, and the digit just to its right (the first one dropped). */
export const digitAt = (n, unit) => Math.floor(Math.abs(n) / unit) % 10;
export const nextDigit = (n, unit) => digitAt(n, unit / 10);

/** 12345,6 written the Vietnamese way from thousandths; `decimals` fixes the number of decimals. */
export function format(m, decimals) {
  const a = Math.abs(Math.round(m));
  let whole = String(Math.floor(a / SCALE));
  if (whole.length > 4) whole = whole.replace(/\B(?=(\d{3})+$)/g, " ");
  let dec = String(a % SCALE).padStart(3, "0");
  dec = decimals == null ? dec.replace(/0+$/, "") : dec.slice(0, decimals);
  return `${m < 0 && a > 0 ? "−" : ""}${whole}${dec ? "," + dec : ""}`;
}

// ---------- estimating with whole numbers ----------
/** Unit of the highest place of n: 4876 → 1000, 62 → 10, 7 → 1. */
export const leadingUnit = n => 10 ** (String(Math.abs(Math.trunc(n))).length - 1);

export const E_PLACES = [0, 10, 100, 1000];

/**
 * Round both numbers first, then add or multiply, and compare with the exact result.
 * `bound` is the largest the error can be: each rounding is off by at most half its unit.
 */
export function estimate(a, b, op, place) {
  const ua = place > 0 ? place : leadingUnit(a);
  const ub = place > 0 ? place : leadingUnit(b);
  const ra = roundTo(a, ua);
  const rb = roundTo(b, ub);
  const mul = op === "mul";
  const exact = mul ? a * b : a + b;
  const approx = mul ? ra * rb : ra + rb;
  const bound = mul ? (Math.abs(ra) * ub) / 2 + (Math.abs(rb) * ua) / 2 + (ua * ub) / 4 : (ua + ub) / 2;
  return { ua, ub, ra, rb, exact, approx, error: approx - exact, bound, percent: exact ? (Math.abs(approx - exact) / Math.abs(exact)) * 100 : 0 };
}

/** The numbers of the "estimate" activity, clamped. */
export const estimateOf = s => estimate(int(s.ea, 1, 9999), int(s.eb, 1, 9999), s.eop === "mul" ? "mul" : "add", E_PLACES.includes(s.ePlace) ? s.ePlace : 100);
export const operandsOf = s => ({ a: int(s.ea, 1, 9999), b: int(s.eb, 1, 9999) });

// ---------- practice ----------
/** The practice question, clamped: a number that is not already on a mark of the place. */
export function questionOf(s) {
  const unit = placeOf(s.pUnit).unit;
  let m = int(s.pm, -MAX, MAX);
  if (m % unit === 0) m += unit / 10 > 1 ? unit / 2 : 5; // forged: keep it strictly between two marks
  return { m, unit };
}

export const isCorrect = (m, unit, answer) => answer === roundTo(m, unit);

/** A new question: one or two digits beyond the place, sometimes exactly halfway, sometimes negative. */
export function newQuestion(rand, current = {}) {
  for (;;) {
    const unit = PLACES[Math.floor(rand() * PLACES.length)].unit;
    const fine = unit >= 100 && rand() < 0.5 ? unit / 100 : unit / 10; // the number's last digit
    let m = Math.floor(rand() * (unit === 1000000 ? 9 : 60) * (unit / fine)) * fine + (rand() < 0.2 ? unit / 2 : 0);
    if (unit <= 1000 && rand() < 0.25) m = -m;
    if (m % unit !== 0 && Math.abs(m) <= MAX && (m !== current.pm || unit !== current.pUnit)) return { pm: m, pUnit: unit };
  }
}
