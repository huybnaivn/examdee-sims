// Column addition and subtraction (đặt tính rồi tính) of natural numbers up to 9999,
// one column at a time from the right, with carrying / borrowing ("nhớ 1"),
// and the matching base-ten block picture.

export const MAX = 9999;
export const PLACES = 5; // đơn vị, chục, trăm, nghìn, chục nghìn (only a sum can reach it)

export const initialState = () => ({
  mode: "explore", // "explore" | "practice"
  op: "add", // "add" | "sub"
  a: 368,
  b: 257,
  step: 1, // how many columns are done
  size: 3, // digits of the numbers "Phép tính khác" makes
  _mistakes: 0, // wrong digits entered for this calculation
  _wrong: -1, // last wrong digit, -1 when none
});

/** Whole number in [lo, hi]; anything forged becomes lo. */
export const whole = (v, lo, hi) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : lo;
};

/** Digits of n, ones first. */
export const digits = n => String(n).split("").reverse().map(Number);

/** At this level the difference must not be negative. */
export const valid = (a, b, op) => op !== "sub" || whole(a, 0, MAX) >= whole(b, 0, MAX);

export const answer = (a, b, op) => (valid(a, b, op) ? (op === "sub" ? whole(a, 0, MAX) - whole(b, 0, MAX) : whole(a, 0, MAX) + whole(b, 0, MAX)) : null);

/**
 * The columns from the right, or null when the subtraction is not allowed.
 * Addition:    sum = x + y + carryIn, write digit = sum mod 10, carryOut = 1 when sum ≥ 10.
 *              A carry out of the last column is one more column that only writes the 1.
 * Subtraction: (Vietnamese textbook wording) the carry is added to the subtrahend digit: t = y + carryIn;
 *              if x < t take 10 + x − t and carry 1 ("nhớ 1"), else x − t.
 * hasX / hasY: whether that number has a digit in this column.
 */
export function columns(a, b, op) {
  if (!valid(a, b, op)) return null;
  const da = digits(whole(a, 0, MAX));
  const db = digits(whole(b, 0, MAX));
  const n = Math.max(da.length, db.length);
  const out = [];
  let carry = 0;
  for (let place = 0; place < n; place++) {
    const x = da[place] ?? 0;
    const y = db[place] ?? 0;
    const base = { place, x, y, hasX: place < da.length, hasY: place < db.length, carryIn: carry };
    if (op === "sub") {
      const t = y + carry;
      carry = x < t ? 1 : 0;
      out.push({ ...base, digit: x + 10 * carry - t, carryOut: carry });
    } else {
      const sum = x + y + carry;
      carry = sum >= 10 ? 1 : 0;
      out.push({ ...base, sum, digit: sum % 10, carryOut: carry });
    }
  }
  if (carry) out.push({ place: n, x: 0, y: 0, hasX: false, hasY: false, carryIn: 1, sum: 1, digit: 1, carryOut: 0 });
  return out;
}

/** The number the written digits make. */
export const fromDigits = cols => cols.reduce((v, c) => v + c.digit * 10 ** c.place, 0);

/** How many times "nhớ 1" happens. */
export const carries = cols => cols.filter(c => c.carryOut).length;

/** Steps done, clamped to what the calculation has (state.step has no control, so it can be forged). */
export const stepOf = s => whole(s.step, 0, columns(s.a, s.b, s.op)?.length ?? 0);

/** Is `digit` the right one for column number `k`? */
export const checkDigit = (cols, k, digit) => !!cols?.[k] && cols[k].digit === digit;

/**
 * The block picture after `k` columns are done. Counts per place, ones first.
 *   have    – blocks on the table
 *   removed – blocks taken away so far (subtraction only)
 *   moves   – regroupings made in the last step: { from, to } places
 * Addition: every place starts with x + y blocks; doing a column trades 10 of them for 1 of the next place,
 *           so Σ have·10^place = a + b at every step.
 * Subtraction: starts with the blocks of a; doing a column first breaks 1 block of the nearest higher place
 *           that has one into 10 (through the places in between), then takes y away,
 *           so Σ (have + removed)·10^place = a at every step and Σ have·10^place = a − b at the end.
 */
export function blocks(a, b, op, k) {
  const cols = columns(a, b, op);
  if (!cols) return null;
  const da = digits(whole(a, 0, MAX));
  const db = digits(whole(b, 0, MAX));
  const have = Array.from({ length: PLACES }, (_, p) => (da[p] ?? 0) + (op === "sub" ? 0 : (db[p] ?? 0)));
  const removed = Array(PLACES).fill(0);
  let moves = [];
  for (let i = 0; i < Math.min(k, cols.length); i++) {
    moves = [];
    if (op === "sub") {
      const y = db[i] ?? 0;
      if (have[i] < y) {
        let j = i + 1;
        while (have[j] === 0) j++;
        for (let q = j; q > i; q--) {
          have[q]--;
          have[q - 1] += 10;
          moves.push({ from: q, to: q - 1 });
        }
      }
      have[i] -= y;
      removed[i] += y;
    } else if (have[i] >= 10) {
      have[i] -= 10;
      have[i + 1]++;
      moves.push({ from: i, to: i + 1 });
    }
  }
  return { have, removed, moves };
}

export const value = counts => counts.reduce((v, n, p) => v + n * 10 ** p, 0);

/** A random calculation with `size`-digit numbers and at least one "nhớ". */
export function newQuestion(rand, op, size = 3) {
  const n = whole(size, 2, 4);
  const lo = 10 ** (n - 1);
  for (;;) {
    let a = lo + Math.floor(rand() * 9 * lo);
    let b = (n > 2 && rand() < 0.3 ? lo / 10 : lo) + Math.floor(rand() * 9 * (lo / 10) * (rand() < 0.5 ? 10 : 1));
    b = Math.min(b, 10 * lo - 1);
    if (op === "sub" && a < b) [a, b] = [b, a];
    if (a !== b && carries(columns(a, b, op)) > 0) return { a, b };
  }
}
