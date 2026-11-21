// Converting units of length, mass, area and time. Numbers are exact rationals (BigInt), so
// 0,1 km is exactly 100 m and 1 phút is exactly 1/60 giờ. The input is num / 10^dec.
// Length and mass go in steps of 10, area in steps of 100 (ha = hm²), time by 24, 60, 60.
// A unit is named by its column in the table (0 = largest unit).

export const QUANTITIES = [
  { key: "length", name: "Độ dài", units: ["km", "hm", "dam", "m", "dm", "cm", "mm"], step: 10 },
  { key: "mass", name: "Khối lượng", units: ["tấn", "tạ", "yến", "kg", "hg", "dag", "g"], step: 10 },
  { key: "area", name: "Diện tích", units: ["km²", "hm²", "dam²", "m²", "dm²", "cm²", "mm²"], step: 100 },
  { key: "time", name: "Thời gian", units: ["ngày", "giờ", "phút", "giây"], factors: [24, 60, 60] },
];
/** Options of the unit lists: value = column, except "ha" which is hm² under another name. */
export const unitOptions = qi => {
  const q = QUANTITIES[qi];
  const out = q.units.map((u, i) => ({ value: u, label: u, col: i }));
  if (q.key === "area") out.splice(2, 0, { value: "ha", label: "ha (héc-ta)", col: 1 });
  return out;
};
export const KEYS = [["lenFrom", "lenTo"], ["massFrom", "massTo"], ["areaFrom", "areaTo"], ["timeFrom", "timeTo"]];

export const MAX_NUM = 999;
export const MAX_DEC = 2;

export const initialState = () => ({
  mode: "explore", // "explore" | "practice"
  qty: "length", // QUANTITIES[].key
  num: 375, // the digits of the number to convert
  dec: 2, // how many of them are after the comma: 375 and 2 give 3,75
  lenFrom: "km",
  lenTo: "m",
  massFrom: "kg",
  massTo: "g",
  areaFrom: "ha",
  areaTo: "m²",
  timeFrom: "giờ",
  timeTo: "phút",
  // practice, transient (not saved)
  _answer: "",
  _status: "",
  _tries: 0,
  _solved: false,
  _anim: null,
});

const int = (v, lo, hi) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : lo;
};
const big = n => BigInt(n);
const bgcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const reduce = ({ p, q }) => {
  const g = bgcd(p, q) || 1n;
  return { p: p / g, q: q / g };
};

/** Index of the quantity, from its key. */
export const qIndex = s => Math.max(0, QUANTITIES.findIndex(q => q.key === s.qty));

/** Column of a unit name in quantity qi (unknown names become the first unit). */
export const colOf = (qi, unit) => unitOptions(qi).find(o => o.value === unit)?.col ?? 0;

/** The conversion a state asks for: quantity, columns, input value as num/10^dec. */
export function read(s) {
  const qi = qIndex(s);
  const [kf, kt] = KEYS[qi];
  const opts = unitOptions(qi);
  const fromUnit = opts.some(o => o.value === s[kf]) ? s[kf] : opts[0].value;
  const toUnit = opts.some(o => o.value === s[kt]) ? s[kt] : opts[0].value;
  return { qi, q: QUANTITIES[qi], fromUnit, toUnit, from: colOf(qi, fromUnit), to: colOf(qi, toUnit), num: int(s.num, 1, MAX_NUM), dec: int(s.dec, 0, MAX_DEC) };
}

/** How many `to` units make one `from` unit, as a fraction p/q (1 km → m: 1000/1; 1 phút → giờ: 1/60). */
export function factor(qi, from, to) {
  const q = QUANTITIES[qi];
  let p = 1n;
  for (let i = Math.min(from, to); i < Math.max(from, to); i++) p *= big(q.factors ? q.factors[i] : q.step);
  return to >= from ? { p, q: 1n } : { p: 1n, q: p };
}

/** Exact result of a conversion: value (from units) × factor. */
export function convert(qi, from, to, value) {
  const f = factor(qi, from, to);
  return reduce({ p: value.p * f.p, q: value.q * f.q });
}

/** num / 10^dec as an exact fraction. */
export const inputValue = (num, dec) => reduce({ p: big(num), q: 10n ** big(dec) });

/** True when p/q has a finite decimal expansion. */
export const terminates = ({ q }) => {
  for (const f of [2n, 5n]) while (q % f === 0n) q /= f;
  return q === 1n;
};

/** Integer part with a space between groups of three when it has more than four digits. */
const group = s => (s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : s);

/** Decimal with a comma. Exact when it terminates, else "≈" and `digits` decimals (rounded half up). */
export function format(v, digits = 3) {
  const { p, q } = reduce(v);
  let k = 0n;
  let scale = 1n;
  const exact = terminates({ p, q });
  if (exact) while ((p * scale) % q !== 0n) (k += 1n), (scale *= 10n);
  else (k = big(digits)), (scale = 10n ** k);
  const n = exact ? (p * scale) / q : (2n * p * scale + q) / (2n * q);
  let str = n.toString().padStart(Number(k) + 1, "0");
  const whole = group(str.slice(0, str.length - Number(k)));
  let frac = str.slice(str.length - Number(k)).replace(/0+$/, "");
  return `${exact ? "" : "≈ "}${whole}${frac ? "," + frac : ""}`;
}

/** Plain number (for events). */
export const toNumber = ({ p, q }) => Number(p) / Number(q);

/**
 * The number written in a place-value table (length, mass: one digit per column; area: two).
 * Slot s belongs to column floor(s / k). The input's units digit sits at the end of the `from`
 * column; the comma moves to the end of the `to` column and zeros fill the gap.
 * Returns the slots lo..hi with their digits, which ones were added, and the number read back.
 */
export function placeDigits(qi, from, to, num, dec) {
  const k = QUANTITIES[qi].step === 100 ? 2 : 1;
  const digits = String(num).padStart(dec + 1, "0");
  const unitsSlot = from * k + k - 1;
  const comma = to * k + k - 1;
  const first = unitsSlot - (digits.length - 1 - dec);
  const last = unitsSlot + dec;
  const lo = Math.min(first, comma);
  const hi = Math.max(last, comma);
  const slots = [];
  for (let i = lo; i <= hi; i++) {
    const inside = i >= first && i <= last;
    slots.push({ slot: i, digit: inside ? digits[i - first] : "0", added: !inside });
  }
  // zeros that are not written in the answer (before the first non-zero integer digit, after the last decimal)
  const intPart = slots.filter(x => x.slot <= comma);
  for (const x of intPart.slice(0, -1)) {
    if (x.digit !== "0") break;
    x.silent = true;
  }
  for (const x of slots.filter(y => y.slot > comma).reverse()) {
    if (x.digit !== "0") break;
    x.silent = true;
  }
  const whole = intPart.map(x => x.digit).join("").replace(/^0+(?=\d)/, "");
  const frac = slots.filter(x => x.slot > comma).map(x => x.digit).join("").replace(/0+$/, "");
  return { k, slots, comma, inputComma: unitsSlot, lo, hi, text: `${group(whole)}${frac ? "," + frac : ""}` };
}

/** Rule of the quantity, in words. */
export const rule = qi => {
  const q = QUANTITIES[qi];
  if (q.factors) return "1 ngày = 24 giờ;  1 giờ = 60 phút;  1 phút = 60 giây";
  const name = q.name.toLowerCase();
  return `Mỗi đơn vị đo ${name} gấp ${q.step} lần đơn vị bé hơn liền sau`;
};

/** The learner's answer: digits with a decimal comma; dots between groups of three are thousands separators. */
export function parseAnswer(text) {
  let t = String(text ?? "").replace(/[\s  ]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const m = t.match(/^(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const frac = m[2] ?? "";
  return reduce({ p: big(m[1] + frac), q: 10n ** big(frac.length) });
}

/** "correct", "wrong" or "invalid". */
export function check(text, result) {
  const a = parseAnswer(text);
  if (!a) return "invalid";
  return a.p * result.q === result.p * a.q ? "correct" : "wrong";
}

/**
 * A practice question for quantity qi: units 1 to 3 places apart (area 1 or 2), a value with at
 * most 2 decimals, and an exact answer with at most 3 decimals and at most 7 digits before the comma.
 */
export function newQuestion(rand, qi, current = {}) {
  const q = QUANTITIES[qi];
  const n = q.units.length;
  const far = q.step === 100 ? 2 : 3;
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  for (;;) {
    const from = pick(0, n - 1);
    const to = pick(0, n - 1);
    if (from === to || Math.abs(from - to) > far) continue;
    const dec = rand() < 0.6 ? 0 : pick(1, 2);
    const num = dec ? pick(1, 99) * (rand() < 0.5 ? 5 : 1) : [pick(1, 9), pick(1, 9) * 10, pick(1, 99) * 5, pick(1, 9) * 100][pick(0, 3)];
    if (num > MAX_NUM || (dec && num % 10 === 0)) continue;
    const r = convert(qi, from, to, inputValue(num, dec));
    if (!terminates(r)) continue;
    const text = format(r);
    const [whole, frac = ""] = text.replace(/ /g, "").split(",");
    if (frac.length > 3 || whole.length > 7) continue;
    if (from === current.from && to === current.to && num === current.num && dec === current.dec) continue;
    const opts = unitOptions(qi);
    const name = col => {
      const choices = opts.filter(o => o.col === col);
      return choices[pick(0, choices.length - 1)].value;
    };
    return { from: name(from), to: name(to), num, dec };
  }
}
