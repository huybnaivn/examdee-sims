// Solving ax + b = cx + d on a balance scale.
// la·x + lb is the left pan, ra·x + rb the right pan. A negative count is drawn as balloons (they pull up).

export const MAX = 12; // most items of one kind a pan can hold
export const MAX_N = 9; // largest amount / number of groups the learner can pick

// [a, b, c, d] for ax + b = cx + d. The last two have no / infinitely many solutions.
export const PRESETS = [
  [3, 2, 1, 8],
  [2, 5, 0, 11],
  [5, -3, 2, 9],
  [2, 7, 4, 1],
  [-1, 7, 1, 1],
  [1, 4, 3, -6],
  [2, 3, 2, 5],
  [3, 6, 3, 6],
];

const presetOf = s => PRESETS[Number.isInteger(s.preset) && PRESETS[s.preset] ? s.preset : 0];

export const load = (s, preset = s.preset) => {
  const [a, b, c, d] = PRESETS[preset] ?? PRESETS[0];
  return Object.assign(s, { preset, la: a, lb: b, ra: c, rb: d, steps: 0, log: eqText([a, b, c, d]) });
};

export const initialState = () => ({
  ...load({}, 0),
  item: "x", // "x" (hộp x) or "1" (quả cân 1)
  amount: 1,
  side: "both", // "both", "left", "right"
});

/** The solution of ax + b = cx + d. */
export function solve([a, b, c, d]) {
  if (a === c) return { kind: b === d ? "infinite" : "none" };
  return { kind: "one", x: (d - b) / (a - c) };
}

const term = (k, unit) => (unit ? String(k) : k === 1 ? "x" : k === -1 ? "−x" : `${k}x`).replace("-", "−");
/** "3x + 2", "−x − 4", "0" in textbook notation. */
export function sideText(k, u) {
  if (!k) return term(u, true);
  return term(k, false) + (u > 0 ? ` + ${u}` : u < 0 ? ` − ${-u}` : "");
}
export const eqText = ([a, b, c, d]) => `${sideText(a, b)} = ${sideText(c, d)}`;

export const eqOf = s => [s.la, s.lb, s.ra, s.rb];

/** "working", "solved" (x alone on one pan), "none" (0 = k ≠ 0), "infinite" (k = k). */
export function status([a, b, c, d]) {
  if (a === 0 && c === 0) return b === d ? "infinite" : "none";
  if ((a === 1 && b === 0 && c === 0) || (c === 1 && d === 0 && a === 0)) return "solved";
  return "working";
}
export const answer = eq => (eq[0] === 1 ? eq[3] : eq[1]);

/**
 * The equation after doing `op` with `n` of `item` to both pans, or { error } if it cannot be done.
 * op: "add" | "remove" | "divide" (split each pan into n equal groups and keep one).
 */
export function next(eq, op, item, n) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_N) return { error: "Số lượng không hợp lệ." };
  if (op === "divide") {
    if (n < 2) return { error: "Cần chia thành ít nhất 2 phần." };
    if (eq.some(v => v % n !== 0)) return { error: `Không chia được mỗi đĩa thành ${n} phần bằng nhau.` };
    return { eq: eq.map(v => v / n || 0) };
  }
  const sign = op === "add" ? 1 : op === "remove" ? -1 : 0;
  if (!sign) return { error: "Thao tác không hợp lệ." };
  const i = item === "x" ? 0 : 1;
  const out = [...eq];
  out[i] += sign * n;
  out[i + 2] += sign * n;
  if (out.some(v => Math.abs(v) > MAX)) return { error: "Đĩa cân không đủ chỗ." };
  return { eq: out };
}

/** Value of x the scale is built with: the solution, or any number when every x works. */
export function hiddenX(s) {
  const r = solve(presetOf(s));
  return r.kind === "one" ? r.x : 2;
}

/** Left pan weight minus right pan weight, with x = hiddenX. 0 means level. */
export const imbalance = (s, eq = eqOf(s)) => {
  const x = hiddenX(s);
  return eq[0] * x + eq[1] - (eq[2] * x + eq[3]);
};

/**
 * Do one learner operation. side !== "both" is rejected: the scale would tip, so the
 * equation would no longer be true. Returns { ok, error?, tip? } and mutates s only when ok.
 */
export function apply(s, op, item, n, side = "both") {
  const eq = eqOf(s);
  if (status(eq) !== "working") return { ok: false, error: "Phương trình đã giải xong. Chọn đề khác hoặc Đặt lại." };
  const r = next(eq, op, item, n);
  if (r.error) return { ok: false, error: r.error };
  if (side !== "both") {
    // Only one pan changes: show what the scale would do, then refuse.
    const one = [...eq];
    const keep = side === "left" ? [2, 3] : [0, 1];
    for (const k of [0, 1, 2, 3]) one[k] = keep.includes(k) ? eq[k] : r.eq[k];
    const tip = Math.sign(imbalance(s, one)) || (side === "left" ? 1 : -1);
    return { ok: false, tip, eq: one, error: "Cân bị lệch: chỉ thay đổi một đĩa thì hai vế không còn bằng nhau." };
  }
  [s.la, s.lb, s.ra, s.rb] = r.eq;
  s.steps += 1;
  const what = op === "divide" ? `Chia hai vế cho ${n}` : `${op === "add" ? "Thêm" : "Bớt"} ${term(n, item !== "x")} ${op === "add" ? "vào" : "ở"} hai vế`;
  s.log = `${s.log}\n${what}: ${eqText(r.eq)}`.split("\n").slice(-30).join("\n");
  return { ok: true };
}

/** Fewest operations that reach "solved", "none" or "infinite" (breadth-first search). */
export function minSteps(eq, depth = 6) {
  const key = e => e.join(",");
  let frontier = [eq];
  const seen = new Set([key(eq)]);
  for (let d = 0; d <= depth; d++) {
    if (frontier.some(e => status(e) !== "working")) return d;
    const more = [];
    for (const e of frontier) {
      for (const [op, item] of [["add", "x"], ["remove", "x"], ["add", "1"], ["remove", "1"], ["divide", "x"]]) {
        for (let n = op === "divide" ? 2 : 1; n <= MAX_N; n++) {
          const r = next(e, op, item, n);
          if (r.eq && !seen.has(key(r.eq))) {
            seen.add(key(r.eq));
            more.push(r.eq);
          }
        }
      }
    }
    frontier = more;
  }
  return Infinity;
}

/** Forged or stale state: keep counts integral and inside the pan. */
export function clampState(s) {
  for (const k of ["la", "lb", "ra", "rb"]) s[k] = Math.max(-MAX, Math.min(MAX, Math.round(s[k]) || 0));
  s.steps = Math.max(0, Math.round(s.steps) || 0);
  if (!PRESETS[s.preset]) s.preset = 0;
  return s;
}
