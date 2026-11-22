// Sets and Venn diagrams. Every element carries a region mask: bit 0 = in A, bit 1 = in B, bit 2 = in C.
// Mask 0 means the element is in the universal set U but in none of the sets.

export const MAX_ELEMS = 12;
export const BITS = { A: 1, B: 2, C: 4 };

const words = (...ws) => ws.map(w => t => w.includes(t));
export const PRESETS = {
  boi: { items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], names: ["bội của 2", "bội của 3", "bội của 4"], tests: [2, 3, 4].map(k => n => n % k === 0) },
  uoc: { items: [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18], names: ["ước của 12", "ước của 18", "ước của 30"], tests: [12, 18, 30].map(k => n => k % n === 0) },
  chu: { items: ["T", "O", "A", "N", "I", "M", "H", "E"], names: ["chữ cái của TOAN", "chữ cái của TIN", "chữ cái của NAM"], tests: words("TOAN", "TIN", "NAM") },
  tu: { items: [1, 2, 3, 4, 5, 6, 7, 8], names: ["", "", ""], tests: [() => false, () => false, () => false] },
};

/** The elements of a preset, each with its region mask. */
export const presetElems = key => {
  const p = PRESETS[key] ?? PRESETS.tu;
  return p.items.map(t => ({ t: String(t), r: p.tests.reduce((m, test, i) => m | (test(t) ? 1 << i : 0), 0) }));
};

export const initialState = () => ({
  mode: "explore", // "explore" | "survey"
  sets: 2, // 2 or 3 sets
  preset: "boi",
  op: 2, // highlighted operation code, 0 = none
  sel: 1, // selected element, 1-based
  elems: presetElems("boi"),
  // survey problem
  qType: 0, // 0: how many like neither, 1: how many like at least one, 2: how many like both
  qCtx: 0,
  qN: 40,
  qA: 25,
  qB: 18,
  qBoth: 8,
  answer: 0,
  _solved: false,
  _tries: 0,
  _note: "",
  _drag: null,
});

const int = (v, lo, hi) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : lo;
};
export const setCount = s => (s.sets === 3 ? 3 : 2);
const fullMask = sets => (sets === 3 ? 7 : 3);

/** Valid elements only: at most 12, short distinct labels, masks 0..7. */
export function cleanElems(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const e of list) {
    if (out.length >= MAX_ELEMS) break;
    const t = typeof e?.t === "string" || typeof e?.t === "number" ? String(e.t).trim().slice(0, 3) : "";
    if (!t || out.some(o => o.t === t)) continue;
    out.push({ t, r: int(e.r, 0, 7) });
  }
  return out;
}

/** Untrusted state from the host: scalars of the right type, elements validated. */
export function sanitize(incoming, base) {
  const out = {};
  for (const key of Object.keys(base)) {
    if (key.startsWith("_") || key === "elems") continue;
    const v = incoming[key];
    if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
  }
  out.elems = cleanElems(incoming.elems) ?? base.elems;
  out.sets = incoming.sets === 3 ? 3 : 2;
  out.op = opOf({ ...base, ...out }).code;
  out.sel = int(out.sel ?? 1, 1, Math.max(1, out.elems.length));
  return out;
}

/** Region of an element when only `sets` sets are drawn (with two sets the C bit is ignored). */
export const regionOf = (e, sets) => e.r & fullMask(sets);

// ---------- operations ----------
// `test(mask)` says whether a region belongs to the result. Codes are stable: they go into events.
export const OPS = [
  { code: 0, label: "", test: () => false, sets: 2 },
  { code: 1, label: "A ∪ B", name: "hợp của A và B", test: m => (m & 3) !== 0, sets: 2 },
  { code: 2, label: "A ∩ B", name: "giao của A và B", test: m => (m & 3) === 3, sets: 2 },
  { code: 3, label: "A \\ B", name: "hiệu của A và B", test: m => (m & 3) === 1, sets: 2 },
  { code: 4, label: "B \\ A", name: "hiệu của B và A", test: m => (m & 3) === 2, sets: 2 },
  { code: 5, label: "Phần bù của A", name: "phần bù của A trong U", test: m => (m & 1) === 0, sets: 2 },
  { code: 6, label: "A ∪ B ∪ C", name: "hợp của ba tập hợp", test: m => m !== 0, sets: 3 },
  { code: 7, label: "A ∩ B ∩ C", name: "giao của ba tập hợp", test: m => m === 7, sets: 3 },
];

/** The highlighted operation; an unknown code, or a three-set one with two sets, is "none". */
export const opOf = s => {
  const op = OPS[int(s.op, 0, OPS.length - 1)];
  return op.sets > setCount(s) ? OPS[0] : op;
};

/** Labels of the elements whose region passes `test`. */
export const pick = (elems, sets, test) => elems.filter(e => test(regionOf(e, sets))).map(e => e.t);

/** The result of operation `code` as a list of labels. */
export const apply = (elems, sets, code) => pick(elems, sets, OPS[code].test);

const has = bits => m => (m & bits) === bits;

/** Sizes of the sets, their intersections, the union and what lies outside. */
export function counts(elems, sets) {
  const n = test => pick(elems, sets, test).length;
  const three = sets === 3;
  return {
    A: n(has(1)),
    B: n(has(2)),
    C: three ? n(has(4)) : 0,
    AB: n(has(3)),
    AC: three ? n(has(5)) : 0,
    BC: three ? n(has(6)) : 0,
    ABC: three ? n(has(7)) : 0,
    union: n(m => m !== 0),
    outside: n(m => m === 0),
    total: elems.length,
  };
}

/** n(A ∪ B) = n(A) + n(B) − n(A ∩ B) */
export const union2 = (a, b, ab) => a + b - ab;
/** n(A ∪ B ∪ C) = n(A) + n(B) + n(C) − n(A ∩ B) − n(A ∩ C) − n(B ∩ C) + n(A ∩ B ∩ C) */
export const union3 = (a, b, c, ab, ac, bc, abc) => a + b + c - ab - ac - bc + abc;

/** Is set i (bit) a subset of set j (bit)? The empty set is a subset of every set. */
export const isSubset = (elems, i, j) => elems.every(e => !(e.r & i) || (e.r & j) !== 0);

/** Put the element in or take it out of one set. */
export const toggle = (e, bit) => ({ t: e.t, r: e.r ^ bit });

/** Smallest natural number ≥ 1 not yet used as a label. */
export function nextLabel(elems) {
  for (let n = 1; ; n++) if (!elems.some(e => e.t === String(n))) return String(n);
}

/** {a; b; c} in textbook notation, ∅ for the empty set. */
export const braces = list => (list.length ? `{${list.join("; ")}}` : "∅");

// ---------- geometry ----------
/** Circles of the diagram inside `box` = { x, y, w, h }. */
export function circles(sets, box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (sets === 3) {
    const r = Math.min(box.w * 0.27, box.h * 0.3);
    return [
      { x: cx - 0.65 * r, y: cy - 0.56 * r, r },
      { x: cx + 0.65 * r, y: cy - 0.56 * r, r },
      { x: cx, y: cy + 0.56 * r, r },
    ];
  }
  const r = Math.min(box.w * 0.29, box.h * 0.43);
  return [
    { x: cx - 0.58 * r, y: cy, r },
    { x: cx + 0.58 * r, y: cy, r },
  ];
}

/** Region mask of a point, or −1 outside the box of U. */
export function regionAt(x, y, rings, box) {
  if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) return -1;
  return rings.reduce((m, c, i) => m | (Math.hypot(x - c.x, y - c.y) < c.r ? 1 << i : 0), 0);
}

/**
 * A position for every element inside its own region: candidate points on a grid, kept away
 * from the outlines (and from the `avoid` discs, where the names are written), then chosen greedily so that chips of radius `pad` do not overlap.
 */
export function layout(elems, sets, box, pad, avoid = []) {
  const rings = circles(sets, box);
  const step = Math.max(4, Math.min(box.w, box.h) / 40);
  const byRegion = new Map();
  for (let y = box.y + step / 2; y < box.y + box.h; y += step)
    for (let x = box.x + step / 2; x < box.x + box.w; x += step) {
      const m = regionAt(x, y, rings, box);
      const clear = Math.min(x - box.x, box.x + box.w - x, y - box.y, box.y + box.h - y, ...rings.map(c => Math.abs(Math.hypot(x - c.x, y - c.y) - c.r)), ...avoid.map(o => Math.hypot(x - o.x, y - o.y) - o.r));
      if (!byRegion.has(m)) byRegion.set(m, []);
      byRegion.get(m).push({ x, y, clear });
    }
  const chosen = new Map();
  return elems.map(e => {
    const m = regionOf(e, sets);
    const cand = byRegion.get(m) ?? [{ x: box.x + box.w / 2, y: box.y + box.h / 2, clear: 0 }];
    const taken = chosen.get(m) ?? [];
    let best = cand[0];
    let bestScore = -Infinity;
    for (const p of cand) {
      const apart = taken.length ? Math.min(...taken.map(q => Math.hypot(p.x - q.x, p.y - q.y))) : Infinity;
      // a chip's width apart from the others and a chip's radius away from the outlines, as far as both fit
      const score = Math.min(apart, pad * 2.2) + 0.8 * Math.min(p.clear, pad) + 0.01 * p.clear;
      if (score > bestScore) (bestScore = score), (best = p);
    }
    chosen.set(m, [...taken, best]);
    return { x: best.x, y: best.y };
  });
}

// ---------- survey problems ----------
export const CONTEXTS = [
  { who: "Lớp 6A có", unit: "học sinh", verb: "thích", a: "bóng đá", b: "cầu lông", none: "không thích môn nào" },
  { who: "Một câu lạc bộ có", unit: "bạn", verb: "biết chơi", a: "cờ vua", b: "cờ tướng", none: "không biết chơi loại cờ nào" },
  { who: "Một nhóm có", unit: "bạn", verb: "nuôi", a: "chó", b: "mèo", none: "không nuôi con nào" },
];

/** The survey numbers, made consistent whatever the state holds. */
export function surveyOf(s) {
  const type = int(s.qType, 0, 2);
  const a = int(s.qA, 1, 30);
  const b = int(s.qB, 1, 30);
  const both = int(s.qBoth, 0, Math.min(a, b));
  const union = union2(a, b, both);
  const total = type === 2 ? union : int(s.qN, union, 60);
  const neither = total - union;
  return { type, ctx: int(s.qCtx, 0, CONTEXTS.length - 1), total, a, b, both, union, neither, onlyA: a - both, onlyB: b - both, answer: [neither, union, both][type] };
}

/** A new survey problem, different from the current one. */
export function newSurvey(rand, current = {}) {
  const pick = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  for (;;) {
    const qType = pick(0, 2);
    const qA = pick(8, 28);
    const qB = pick(8, 28);
    const qBoth = pick(2, Math.min(qA, qB) - 2);
    const union = union2(qA, qB, qBoth);
    const q = { qType, qCtx: pick(0, CONTEXTS.length - 1), qA, qB, qBoth, qN: qType === 2 ? union : union + pick(1, 9) };
    if (q.qN <= 50 && (q.qA !== current.qA || q.qB !== current.qB)) return q;
  }
}
