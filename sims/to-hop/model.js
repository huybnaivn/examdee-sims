// Counting arrangements of k objects chosen from n distinct objects.
// ordered: the order of the k chosen objects matters; repeat: an object may be chosen more than once.

export const N_MAX = 20;
export const K_MAX = 20;

export const initialState = () => ({ n: 4, k: 3, ordered: true, repeat: false });

/** k as the model uses it: 1..K_MAX, and without repetition at most n. Forged states cannot break it. */
export function settings(s) {
  const n = Math.min(N_MAX, Math.max(1, Math.round(Number(s.n) || 1)));
  const k = Math.min(s.repeat ? K_MAX : n, Math.max(1, Math.round(Number(s.k) || 1)));
  return { n, k, ordered: !!s.ordered, repeat: !!s.repeat };
}

export function factorial(n) {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
}

/** Number of k-arrangements (chỉnh hợp) of n: A_n^k = n!/(n − k)!, 0 when k > n. */
export function arrangements(n, k) {
  if (k > n) return 0n;
  let r = 1n;
  for (let i = 0; i < k; i++) r *= BigInt(n - i);
  return r;
}

/** Number of k-combinations (tổ hợp) of n: C_n^k = n!/(k!(n − k)!), 0 when k > n. */
export function combinations(n, k) {
  if (k < 0 || k > n) return 0n;
  return arrangements(n, k) / factorial(k);
}

/** 1 hoán vị, 2 chỉnh hợp, 3 tổ hợp, 4 chỉnh hợp lặp, 5 tổ hợp lặp. */
export function typeCode(s) {
  const { n, k, ordered, repeat } = settings(s);
  if (repeat) return ordered ? 4 : 5;
  if (!ordered) return 3;
  return k === n ? 1 : 2;
}

export const TYPE_NAMES = { 1: "Hoán vị", 2: "Chỉnh hợp", 3: "Tổ hợp", 4: "Chỉnh hợp lặp", 5: "Tổ hợp lặp" };

/** The number of ways, exact (BigInt). */
export function count(s) {
  const { n, k } = settings(s);
  switch (typeCode(s)) {
    case 1: return factorial(n);
    case 2: return arrangements(n, k);
    case 3: return combinations(n, k);
    case 4: return BigInt(n) ** BigInt(k);
    default: return combinations(n + k - 1, k);
  }
}

/**
 * Every arrangement, as arrays of object indices 0..n−1, in lexicographic order, lazily.
 * Unordered selections are listed once each, as a non-decreasing list.
 */
export function* enumerate(s) {
  const { n, k, ordered, repeat } = settings(s);
  const pick = [];
  const used = new Array(n).fill(false);
  function* go() {
    if (pick.length === k) return yield [...pick];
    const from = ordered || !pick.length ? 0 : pick.at(-1) + (repeat ? 0 : 1);
    for (let i = from; i < n; i++) {
      if (!repeat && used[i]) continue;
      used[i] = true;
      pick.push(i);
      yield* go();
      pick.pop();
      used[i] = false;
    }
  }
  yield* go();
}

/** The first `cap` arrangements. */
export function firstArrangements(s, cap) {
  const out = [];
  if (cap <= 0) return out;
  for (const a of enumerate(s)) {
    out.push(a);
    if (out.length >= cap) break;
  }
  return out;
}

/** Exact integer with Vietnamese digit grouping: 3628800n → "3.628.800". */
export const big = x => {
  const t = String(x);
  return t.replace(/\B(?=(\d{3})+$)/g, ".");
};

/**
 * The formula with the numbers put in, as a list of pieces for the view.
 * A piece is a string or { b: base, sub, sup } (Vietnamese notation: A with n below and k above).
 */
export function formula(s) {
  const { n, k } = settings(s);
  const type = typeCode(s);
  const total = big(count(s));
  const product = (from, terms) =>
    terms <= 6 ? Array.from({ length: terms }, (_, i) => from - i).join(" · ") : `${from} · ${from - 1} · … · ${from - terms + 1}`;
  switch (type) {
    case 1:
      return [[{ b: "P", sub: "n" }, " = n!"], [{ b: "P", sub: `${n}` }, ` = ${n}! = `, ...(n > 1 ? [product(n, n), " = "] : []), total]];
    case 2:
      return [
        [{ b: "A", sub: "n", sup: "k" }, " = n! / (n − k)!"],
        [{ b: "A", sub: `${n}`, sup: `${k}` }, ` = ${n}! / ${n - k}! = `, ...(k > 1 ? [product(n, k), " = "] : []), total],
      ];
    case 3:
      return [
        [{ b: "C", sub: "n", sup: "k" }, " = n! / (k! · (n − k)!)"],
        [{ b: "C", sub: `${n}`, sup: `${k}` }, ` = ${n}! / (${k}! · ${n - k}!) = `, total],
      ];
    case 4:
      return [[{ b: "n", sup: "k" }], [{ b: `${n}`, sup: `${k}` }, " = ", total]];
    default:
      return [
        [{ b: "C", sub: "n + k − 1", sup: "k" }, " = (n + k − 1)! / (k! · (n − 1)!)"],
        [{ b: "C", sub: `${n} + ${k} − 1`, sup: `${k}` }, " = ", { b: "C", sub: `${n + k - 1}`, sup: `${k}` }, " = ", total],
      ];
  }
}
