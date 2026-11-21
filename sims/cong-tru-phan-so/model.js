// Adding and subtracting two fractions (or mixed numbers) step by step, as in the textbook:
// mixed numbers to fractions, common denominator (the lowest one), add or subtract the
// numerators, simplify by the gcd, write the result as a mixed number.
// A step is { kind, title, lines }, each line an array of parts: a string or a stacked
// fraction { n, d } (n and d may be strings such as "3 × 2").

export const MAX = 12; // largest numerator and denominator
export const MAX_WHOLE = 3; // largest whole part of a mixed number
export const ALL = 9; // stage value meaning "every step shown"

export const initialState = () => ({
  mode: "explore", // "explore" | "practice"
  op: "+", // "+" | "-"
  n1: 1,
  d1: 4,
  n2: 5,
  d2: 12,
  w1: 1, // whole parts, used only when `mixed` is on
  w2: 1,
  mixed: false,
  negative: false, // lớp 6: allow a negative result
  stage: ALL, // how many steps are shown (index of the last one), clamped by the model
  // practice, transient (not saved)
  _ansN: "",
  _ansD: "",
  _status: "",
  _tries: 0,
  _solved: false,
  _anim: null,
});

const int = (v, lo, hi) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : lo;
};

export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export const lcm = (a, b) => (a / gcd(a, b)) * b;

/** Lowest terms with the sign on the numerator; 0 becomes 0/1. */
export const simplify = ({ n, d }) => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};

/** Mixed number w + n/d (w ≥ 0, n ≥ 0) as an improper fraction. */
export const toImproper = (w, n, d) => ({ n: w * d + n, d });

/** Simplified fraction as a mixed number: sign, whole part, proper fraction part. −7/4 = −(1 3/4). */
export const toMixed = f => {
  const { n, d } = simplify(f);
  const a = Math.abs(n);
  return { sign: Math.sign(n), whole: Math.floor(a / d), n: a % d, d };
};

/** The two operands of a state, sanitised. In practice mode there are no whole parts. */
export function read(s) {
  const mixed = s.mixed === true && s.mode !== "practice";
  const op = s.op === "-" ? "-" : "+";
  const part = (w, n, d) => {
    d = int(d, 1, MAX);
    n = int(n, 0, MAX);
    w = mixed ? int(w, 0, MAX_WHOLE) : 0;
    if (mixed) n = Math.min(n, d - 1); // a mixed number's fraction part is proper
    return { w, n, d, f: toImproper(w, n, d) };
  };
  return { mixed, op, A: part(s.w1, s.n1, s.d1), B: part(s.w2, s.n2, s.d2), negative: s.negative === true };
}

/** In mixed-number mode the fraction parts must be proper: write that back into the state. */
export function normalize(s) {
  const { mixed, A, B } = read(s);
  if (mixed) {
    s.n1 = A.n;
    s.n2 = B.n;
  }
}

// ---------- parts for written steps ----------
const sign = n => (n < 0 ? "−" : "");
/** A fraction as parts: −3/4 → ["−", {3,4}], 6/1 → ["6"]. */
export const fracParts = ({ n, d }) => (d === 1 ? [`${sign(n)}${Math.abs(n)}`] : [sign(n), { n: Math.abs(n), d }].filter(p => p !== ""));
/** A simplified fraction as a mixed number: −7/4 → ["−1", {3,4}]. */
export const mixedParts = f => {
  const m = toMixed(f);
  if (m.n === 0) return [`${m.sign < 0 ? "−" : ""}${m.whole}`];
  if (m.whole === 0) return fracParts(simplify(f));
  return [`${m.sign < 0 ? "−" : ""}${m.whole}`, { n: m.n, d: m.d }];
};
/** An operand as the learner set it (mixed number or fraction). */
export const operandParts = (x, mixed) => (mixed && x.w > 0 ? (x.n ? [String(x.w), { n: x.n, d: x.d }] : [String(x.w)]) : fracParts(x.f));
const OP = { "+": " + ", "-": " − " };

/** Every step of the calculation, and its result (null when lớp 4–5 cannot subtract). */
export function solve(s) {
  const { mixed, op, A, B, negative } = read(s);
  const a = A.f;
  const b = B.f;
  const steps = [{ kind: "problem", title: "Đề bài", lines: [[...operandParts(A, mixed), OP[op], ...operandParts(B, mixed), " = ?"]] }];
  const out = { op, a, b, A, B, mixed, steps, D: null, a2: null, b2: null, raw: null, g: 1, result: null, blocked: false };
  if (op === "-" && a.n * b.d < b.n * a.d && !negative) {
    out.blocked = true;
    steps.push({ kind: "blocked", title: "Số bị trừ bé hơn số trừ nên chưa trừ được (lớp 4, 5). Bật “Lớp 6: cho phép kết quả âm” để xem.", lines: [] });
    return out;
  }

  if (mixed && (A.w || B.w)) {
    const lines = [A, B]
      .filter(x => x.w > 0)
      .map(x => [...operandParts(x, true), " = ", { n: `${x.w} × ${x.d} + ${x.n}`, d: x.d }, " = ", { n: x.f.n, d: x.f.d }]);
    steps.push({ kind: "convert", title: "Đổi hỗn số thành phân số", lines });
  }

  const D = lcm(a.d, b.d);
  const scale = f => ({ n: f.n * (D / f.d), d: D });
  const a2 = scale(a);
  const b2 = scale(b);
  if (a.d !== b.d) {
    const line = f => {
      const k = D / f.d;
      return k === 1 ? [{ n: f.n, d: f.d }, " giữ nguyên"] : [{ n: f.n, d: f.d }, " = ", { n: `${f.n} × ${k}`, d: `${f.d} × ${k}` }, " = ", { n: f.n * k, d: D }];
    };
    steps.push({ kind: "common", title: `Quy đồng mẫu số: mẫu số chung nhỏ nhất là ${D}`, lines: [line(a), line(b)] });
  }

  const raw = { n: op === "+" ? a2.n + b2.n : a2.n - b2.n, d: D };
  const verb = op === "+" ? "Cộng" : "Trừ";
  steps.push({
    kind: "compute",
    title: `${verb} hai tử số, giữ nguyên mẫu số`,
    lines: [[{ n: a2.n, d: D }, OP[op], { n: b2.n, d: D }, " = ", { n: `${a2.n}${OP[op]}${b2.n}`, d: D }, " = ", ...fracParts(raw)]],
  });

  const g = gcd(raw.n, D) || D;
  const result = simplify(raw);
  if (raw.n === 0) {
    steps.push({ kind: "simplify", title: "Tử số bằng 0 nên kết quả bằng 0", lines: [[...fracParts(raw), " = 0"]] });
  } else if (g > 1) {
    const abs = Math.abs(raw.n);
    steps.push({
      kind: "simplify",
      title: `Rút gọn: chia cả tử số và mẫu số cho ${g} (ƯCLN của ${abs} và ${D})`,
      lines: [[...fracParts(raw), " = ", sign(raw.n), { n: `${abs} : ${g}`, d: `${D} : ${g}` }, " = ", ...fracParts(result)]],
    });
  }
  if (mixed && result.d !== 1 && Math.abs(result.n) > result.d) {
    const m = toMixed(result);
    steps.push({
      kind: "mixed",
      title: `Viết thành hỗn số: ${Math.abs(result.n)} : ${result.d} = ${m.whole} (dư ${m.n})`,
      lines: [[...fracParts(result), " = ", ...mixedParts(result)]],
    });
  }
  return Object.assign(out, { D, a2, b2, raw, g, result });
}

/** Index of the last step shown. */
export const shownStage = (s, steps = solve(s).steps) => int(s.stage, 0, steps.length - 1);

/**
 * The learner's answer n/d against the result: "correct" (equal and in lowest terms),
 * "unsimplified" (equal, not in lowest terms), "wrong", or "invalid" (no number, or d = 0).
 * An empty denominator means a whole number.
 */
export function check(nText, dText, result) {
  const parse = t => (String(t ?? "").trim() === "" ? NaN : Number(String(t).trim().replace("−", "-")));
  const n = parse(nText);
  const d = String(dText ?? "").trim() === "" ? 1 : parse(dText);
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) return "invalid";
  if (n * result.d !== result.n * d) return "wrong";
  return gcd(n, d) === 1 || (n === 0 && Math.abs(d) === 1) ? "correct" : "unsimplified";
}

/** A practice problem: two proper fractions with denominators 2..10. No negative result unless allowed. */
export function newProblem(rand, negative = false) {
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const d1 = pick(2, 10);
  const d2 = pick(2, 10);
  let p = { n1: pick(1, d1 - 1), d1, n2: pick(1, d2 - 1), d2, op: rand() < 0.5 ? "+" : "-" };
  if (p.op === "-" && !negative && p.n1 * p.d2 < p.n2 * p.d1) p = { n1: p.n2, d1: p.d2, n2: p.n1, d2: p.d1, op: "-" };
  return p;
}
