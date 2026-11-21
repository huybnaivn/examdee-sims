// Adding and subtracting integers on the number line.
// Subtraction is shown as adding the opposite: a − b = a + (−b).

export const MIN = -10;
export const MAX = 10;

const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : 0)));
const sign = op => (op === "sub" || op === -1 ? -1 : 1);

export const initialState = () => ({
  a: 4,
  b: 7,
  op: "sub", // "add" | "sub"
  showCounters: true,
  practice: false,
  qa: -3, // practice question: qa (qop) qb
  qb: 5,
  qop: 1, // 1 = add, −1 = subtract
  answer: 0,
  status: "", // "" | "right" | "wrong"
  solved: 0,
});

/** a ± b. `op` is "add"/"sub" or 1/−1. `move` is the signed step taken from a. */
export function compute(a, b, op) {
  a = int(a, MIN, MAX);
  b = int(b, MIN, MAX);
  const s = sign(op);
  const move = s * b || 0; // never −0
  return { a, b, sign: s, move, result: a + move };
}

/** The two arrows on the number line: 0 → a, then a → a + move. */
export function arrows(a, b, op) {
  const c = compute(a, b, op);
  return [
    { from: 0, to: c.a },
    { from: c.a, to: c.a + c.move },
  ];
}

/** Counters: one per unit of a and of the move, + or −. A + and a − cancel as a pair. */
export function counters(a, b, op) {
  const c = compute(a, b, op);
  const positive = Math.max(c.a, 0) + Math.max(c.move, 0);
  const negative = Math.max(-c.a, 0) + Math.max(-c.move, 0);
  const pairs = Math.min(positive, negative);
  return { positive, negative, pairs, leftPositive: positive - pairs, leftNegative: negative - pairs };
}

/** The calculation currently on screen: the practice question or the chosen numbers. */
export const current = s => (s.practice ? compute(s.qa, s.qb, s.qop) : compute(s.a, s.b, s.op));

export const isCorrect = s => Number.isInteger(s.answer) && s.answer === compute(s.qa, s.qb, s.qop).result;

/** Pose a new practice question. `rnd` returns a number in [0, 1). */
export function newQuestion(s, rnd = Math.random) {
  const pick = () => MIN + Math.floor(rnd() * (MAX - MIN + 1));
  s.qa = pick();
  do s.qb = pick();
  while (s.qb === 0);
  s.qop = rnd() < 0.5 ? 1 : -1;
  s.answer = 0;
  s.status = "";
  return s;
}

/** Negative numbers are written in brackets inside a calculation: 3 + (−5). */
const term = n => (n < 0 ? `(−${-n})` : `${n}`);
export const plain = n => (n < 0 ? `−${-n}` : `${n}`);

/** Left-hand side(s) of the calculation, without the result. */
export function expression(a, b, op) {
  const c = compute(a, b, op);
  return c.sign === 1 ? `${term(c.a)} + ${term(c.b)}` : `${term(c.a)} − ${term(c.b)} = ${term(c.a)} + ${term(-c.b)}`;
}
