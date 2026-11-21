// An array of counters: `rows` rows, each with `columns` counters.
// Textbook order (lớp 2): each row is one group of `columns`, taken `rows` times,
// so the sentence is  columns × rows = product  and  columns + columns + … (rows times).

export const MIN = 1;
export const MAX = 10;

export const initialState = () => ({
  rows: 3,
  columns: 5,
  mode: "explore", // "explore" | "practice"
  _tried: [], // wrong answers already pressed for this question
  _solved: false,
});

/** Whole number in [MIN, MAX]; anything forged becomes MIN. */
export const side = v => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(MAX, Math.max(MIN, r)) : MIN;
};

export const product = (rows, columns) => side(rows) * side(columns);

/** The multiplication sentence in textbook order: the repeated group first. */
export const sentence = (rows, columns) => ({ a: side(columns), b: side(rows), p: product(rows, columns) });

/** Repeated addition: `columns` written `rows` times. */
export const addends = (rows, columns) => Array(side(rows)).fill(side(columns));

/** Division as the inverse: product : rows = columns and product : columns = rows. */
export const divisions = (rows, columns) => {
  const p = product(rows, columns);
  return [
    { dividend: p, divisor: side(rows), quotient: p / side(rows) },
    { dividend: p, divisor: side(columns), quotient: p / side(columns) },
  ];
};

/** Rotating the array swaps rows and columns; the product does not change. */
export const rotate = s => ({ rows: side(s.columns), columns: side(s.rows) });

export const isCorrect = (rows, columns, answer) => answer === product(rows, columns);

/**
 * Twelve different answers for the practice buttons, smallest first: the product and the
 * mistakes children really make (one row too many or too few, adding instead of
 * multiplying, off by one), then the nearest other numbers. Same question, same buttons.
 */
export function choices(rows, columns) {
  const r = side(rows);
  const c = side(columns);
  const p = r * c;
  const out = new Set([p]);
  const tries = [(r + 1) * c, (r - 1) * c, r * (c + 1), r * (c - 1), r + c, p + 1, p - 1, p + 2, p - 2, p + 10, p - 10];
  for (const v of tries) if (out.size < 12 && v > 0) out.add(v);
  for (let k = 3; out.size < 12; k++) for (const v of [p + k, p - k]) if (out.size < 12 && v > 0) out.add(v);
  return [...out].sort((x, y) => x - y);
}

/** A new practice question (sides 2..10), different from the current one. */
export function newQuestion(rand, current = {}) {
  for (;;) {
    const q = { rows: 2 + Math.floor(rand() * 9), columns: 2 + Math.floor(rand() * 9) };
    if (q.rows !== current.rows || q.columns !== current.columns) return q;
  }
}
