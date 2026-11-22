// Area and volume models of the "hằng đẳng thức đáng nhớ".
// 2D pieces are rectangles in units of length, x to the right and y downwards, origin at the top-left corner.
// Each piece has a start place (`from`, the assembled figure) and an end place (`to`, after rearranging);
// `to.rot` = 90 means the piece is turned a quarter turn, so its width and height swap.
// 3D blocks are boxes { x, y, z, dx, dy, dz } with z upwards.

export const initialState = () => ({
  identity: "binh-phuong-tong",
  a: 5,
  b: 3,
  apart: false, // target of the animation: false = assembled figure, true = pieces moved apart / rearranged
  t: 0, // animation progress, 0 = assembled, 1 = rearranged
  quiz: false,
});

export const AB_MAX = 8;
export const GAP = 0.7; // units between exploded pieces
export const NEEDS_A_GE_B = new Set(["binh-phuong-hieu", "hieu-hai-binh-phuong"]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rect = (x, y, w, h) => ({ x, y, w, h });
const piece = (term, from, to) => ({ term, from, to: { rot: 0, ...to } });
const moved = (r, dx, dy) => ({ ...r, x: r.x + dx, y: r.y + dy });

export const IDENTITIES = {
  "binh-phuong-tong": {
    lhs: "(a + b)²",
    rhs: "a² + 2ab + b²",
    terms: ["a²", "ab", "b²"],
    value: (a, b) => (a + b) ** 2,
    parts: (a, b) => [a * a, 2 * a * b, b * b], // the terms of the right-hand side, in order
    whole: (a, b) => (a + b) ** 2,
    pieces(a, b) {
      const g = GAP;
      return [
        piece(0, rect(0, 0, a, a), moved(rect(0, 0, a, a), 0, 0)),
        piece(1, rect(a, 0, b, a), moved(rect(a, 0, b, a), g, 0)),
        piece(1, rect(0, a, a, b), moved(rect(0, a, a, b), 0, g)),
        piece(2, rect(a, a, b, b), moved(rect(a, a, b, b), g, g)),
      ];
    },
  },
  "binh-phuong-hieu": {
    lhs: "(a − b)²",
    rhs: "a² − 2ab + b²",
    terms: ["(a − b)²", "b(a − b)", "b²"],
    value: (a, b) => (a - b) ** 2,
    parts: (a, b) => [a * a, -2 * a * b, b * b],
    whole: a => a * a, // the assembled figure is the square a²
    pieces(a, b) {
      const c = a - b;
      const g = GAP;
      return [
        piece(0, rect(0, 0, c, c), rect(0, 0, c, c)),
        piece(1, rect(c, 0, b, c), moved(rect(c, 0, b, c), g, 0)),
        piece(1, rect(0, c, c, b), moved(rect(0, c, c, b), 0, g)),
        piece(2, rect(c, c, b, b), moved(rect(c, c, b, b), g, g)),
      ];
    },
  },
  "hieu-hai-binh-phuong": {
    lhs: "a² − b²",
    rhs: "(a − b)(a + b)",
    terms: ["a(a − b)", "b(a − b)"],
    value: (a, b) => a * a - b * b,
    parts: (a, b) => [(a - b) * (a + b)],
    whole: (a, b) => a * a - b * b, // square a² with the corner b² cut away
    hole: (a, b) => rect(a - b, 0, b, b), // the cut-away square b²
    pieces(a, b) {
      const c = a - b;
      // the strip under the hole turns a quarter turn and goes under the left strip:
      // together they make a rectangle (a − b) × (a + b)
      return [piece(0, rect(0, 0, c, a), rect(0, 0, c, a)), piece(1, rect(c, b, b, c), { x: 0, y: a, w: c, h: b, rot: 90 })];
    },
  },
  "lap-phuong-tong": {
    lhs: "(a + b)³",
    rhs: "a³ + 3a²b + 3ab² + b³",
    terms: ["a³", "a²b", "ab²", "b³"],
    value: (a, b) => (a + b) ** 3,
    parts: (a, b) => [a ** 3, 3 * a * a * b, 3 * a * b * b, b ** 3],
    whole: (a, b) => (a + b) ** 3,
    solid: true,
    blocks(a, b) {
      // wide gaps, the upper layer lifted most, so the back block a³ shows when moved apart
      const g = 0.25 * (a + b);
      const gz = 1.2 * (a + b);
      const out = [];
      for (const i of [0, 1]) {
        for (const j of [0, 1]) {
          for (const k of [0, 1]) {
            const side = n => (n ? b : a);
            const at = n => (n ? a : 0);
            const box = { x: at(i), y: at(j), z: at(k), dx: side(i), dy: side(j), dz: side(k) };
            out.push({ term: i + j + k, cell: i + j + k, from: box, to: { ...box, x: box.x + i * g, y: box.y + j * g, z: box.z + k * gz } });
          }
        }
      }
      return out;
    },
  },
};
export const IDENTITY_KEYS = Object.keys(IDENTITIES);

/** Clamp a, b (and b ≤ a where the figure needs it), and t; mutates and returns s. */
export function normalize(s) {
  const base = initialState();
  if (!IDENTITIES[s.identity]) s.identity = base.identity;
  s.a = clamp(Number.isFinite(s.a) ? s.a : base.a, 0.5, AB_MAX);
  s.b = clamp(Number.isFinite(s.b) ? s.b : base.b, 0, AB_MAX);
  if (NEEDS_A_GE_B.has(s.identity)) s.b = Math.min(s.b, s.a);
  s.t = clamp(Number.isFinite(s.t) ? s.t : 0, 0, 1);
  return s;
}

/** Advance the animation towards `apart`. Returns true while still moving. */
export function step(s, dt) {
  const goal = s.apart ? 1 : 0;
  s.t = goal > s.t ? Math.min(goal, s.t + dt * 0.8) : Math.max(goal, s.t - dt * 0.8);
  return s.t !== goal;
}

export const area = r => r.w * r.h;
export const volume = box => box.dx * box.dy * box.dz;

/** Right-hand side evaluated term by term. */
export const expand = (id, a, b) => IDENTITIES[id].parts(a, b).reduce((x, y) => x + y, 0);

/** The pieces of a figure that have a nonzero size (only these take part in the quiz). */
export function quizItems(id, a, b) {
  const I = IDENTITIES[id];
  const list = I.solid ? I.blocks(a, b) : I.pieces(a, b);
  return list.map((p, i) => ({ i, term: p.term, size: I.solid ? volume(p.from) : area(p.from) })).filter(p => p.size > 1e-12);
}

/** True when every nonzero piece carries its own term. */
export const quizSolved = (id, a, b, labels) => quizItems(id, a, b).every(p => labels[p.i] === p.term);
