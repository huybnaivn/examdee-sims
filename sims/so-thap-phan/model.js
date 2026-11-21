// Base-ten blocks from thousands down to hundredths. Every value is kept as a whole number of
// hundredths, so 0,1 + 0,2 is exactly 0,3 and comparisons and rounding are exact.

export const PLACES = [
  { key: "th", name: "Nghìn", unit: 100000 },
  { key: "h", name: "Trăm", unit: 10000 },
  { key: "t", name: "Chục", unit: 1000 },
  { key: "u", name: "Đơn vị", unit: 100 },
  { key: "d", name: "Phần mười", unit: 10 },
  { key: "c", name: "Phần trăm", unit: 1 },
];
export const MAX = 999999; // 9999,99 in hundredths

export const initialState = () => ({
  th: 1,
  h: 2,
  t: 3,
  u: 4,
  d: 0,
  c: 5, // 1234,05: every place used, and the decimal part reads "không năm"
  mode: "build", // "build" | "compare" | "round" | "target"
  bInt: 1234, // number B = bInt + bD/10 + bC/100
  bD: 5,
  bC: 0,
  roundTo: 100, // rounding unit in hundredths: 10 (phần mười), 100 (đơn vị), 1000 (chục), 10000 (trăm)
  target: 1234, // number to build in "target" mode, in hundredths (12,34)
});

/** Value in hundredths of a set of block counts. */
export const value = s => PLACES.reduce((sum, p) => sum + (Number(s[p.key]) || 0) * p.unit, 0);

/** Digits of a value, one per place. */
export const digits = v => Object.fromEntries(PLACES.map(p => [p.key, Math.floor(v / p.unit) % 10]));

/** Ten blocks of a place become one of the next place up, lowest place first.
 *  Returns the new counts and the places that received a block. Thousands never regroup. */
export function regroup(s) {
  const counts = Object.fromEntries(PLACES.map(p => [p.key, s[p.key]]));
  const into = [];
  for (let i = PLACES.length - 1; i > 0; i--) {
    while (counts[PLACES[i].key] >= 10) {
      counts[PLACES[i].key] -= 10;
      counts[PLACES[i - 1].key] += 1;
      into.push(PLACES[i - 1].key);
    }
  }
  return { counts, into };
}

/** Whole hundredths in [lo, hi]. */
export const hundredths = (v, lo = 0, hi = MAX) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : lo;
};

/** Number B of the comparison, in hundredths. */
export const valueB = s => hundredths(s.bInt, 0, 9999) * 100 + hundredths(s.bD, 0, 9) * 10 + hundredths(s.bC, 0, 9);

/** Digits with a decimal comma; `decimals` defaults to as few as needed (0,5 not 0,50). */
export function format(v, decimals) {
  const whole = Math.floor(v / 100);
  const frac = v % 100;
  if (decimals == null) decimals = frac === 0 ? 0 : frac % 10 === 0 ? 1 : 2;
  if (decimals === 0) return String(whole);
  const f = String(frac).padStart(2, "0").slice(0, decimals);
  return `${whole},${f}`;
}

const D = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/** Two-digit group: mười lăm, hai mươi mốt, (linh) năm. `higher` = a hundreds or thousands part is read before. */
function tens(n, higher) {
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 0) return u === 0 ? [] : higher ? ["linh", D[u]] : [D[u]];
  const out = t === 1 ? ["mười"] : [D[t], "mươi"];
  if (u === 1 && t > 1) out.push("mốt");
  else if (u === 5) out.push("lăm");
  else if (u > 0) out.push(D[u]);
  return out;
}

/** Whole number 0..9999 in Vietnamese words. */
export function readInt(n) {
  if (n === 0) return "không";
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  const out = th ? [D[th], "nghìn"] : [];
  if (rest) {
    const h = Math.floor(rest / 100);
    if (h || th) out.push(D[h], "trăm");
    out.push(...tens(rest % 100, h > 0 || th > 0));
  }
  return out.join(" ");
}

/** A value in hundredths, read aloud: 1005 → "mười phẩy không năm". */
export function words(v) {
  const whole = readInt(Math.floor(v / 100));
  const frac = v % 100;
  if (frac === 0) return whole;
  const d = Math.floor(frac / 10);
  const c = frac % 10;
  const part = c === 0 ? D[d] : d === 0 ? `không ${D[c]}` : tens(frac, false).join(" ");
  return `${whole} phẩy ${part}`;
}

/** −1, 0 or 1. */
export const compare = (a, b) => Math.sign(a - b);

/** First place (index into PLACES) where the digits of a and b differ, or −1. */
export const firstDifference = (a, b) => {
  const da = digits(a);
  const db = digits(b);
  return PLACES.findIndex(p => da[p.key] !== db[p.key]);
};

/** Round half up to a multiple of `unit` hundredths (Vietnamese textbook rule: digit ≥ 5 rounds up). */
export const round = (v, unit) => Math.floor((v + unit / 2) / unit) * unit;

/** How many decimals a rounded result is written with. */
export const decimalsFor = unit => (unit === 1 ? 2 : unit === 10 ? 1 : 0);

/** Random number to build: 0,01 to 99,99. */
export const newTarget = (rand, current) => {
  for (;;) {
    const t = 1 + Math.floor(rand() * 9999);
    if (t !== current) return t;
  }
};

/** Untrusted state from the host: known keys of the right type, block counts regrouped and capped. */
export function sanitize(incoming, base) {
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const v = incoming[key];
    if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
  }
  for (const p of PLACES) out[p.key] = hundredths(out[p.key], 0, 10);
  const v = Math.min(MAX, value(regroup(out).counts));
  Object.assign(out, digits(v));
  out.target = hundredths(out.target, 1, MAX);
  return out;
}
