// An angle xOy and a protractor. Directions are in degrees, counter-clockwise from "pointing right".
// Lengths are in units of the arm length; the vertex O is the origin.

export const norm = d => (((Number.isFinite(d) ? d : 0) % 360) + 360) % 360;
/** Smallest turn between two directions, 0…180. */
const turn = (a, b) => {
  const x = norm(b - a);
  return x > 180 ? 360 - x : x;
};

/** Measure of the angle formed by two rays from the same point: 0° … 180°. */
export const angleBetween = (dir1, dir2) => turn(dir1, dir2);

/** nhọn < 90°, vuông = 90°, 90° < tù < 180°, bẹt = 180°. */
export const classify = deg => (deg <= 0 ? "zero" : deg < 90 ? "acute" : deg === 90 ? "right" : deg < 180 ? "obtuse" : "straight");
export const TYPE_CODE = { zero: 0, acute: 1, right: 2, obtuse: 3, straight: 4 };

/** Arms snap to whole degrees (or to any other step). */
export const snapDegree = (deg, step = 1) => norm(Math.round(deg / step) * step);

// ---------- protractor ----------
// `rot` is the direction of the half of the base line that carries the 0 of the INNER scale.
// The inner scale grows counter-clockwise from there; the OUTER scale starts with 0 at the other end
// of the base line and grows clockwise, so the two readings of one mark always add up to 180.
export const RADIUS = 0.8;
export const CENTER_TOL = 0.03; // how far the centre may be from O for a reading
export const ZERO_TOL = 0.5; // degrees an arm may be off the 0 mark
export const SNAP_DIST = 0.1;
export const SNAP_ROT = 6;

/** Both scale values under a ray of direction `dir`, or null when the ray is on the open side. */
export function scales(rot, dir) {
  const rel = norm(dir - rot);
  return rel <= 180 ? { inner: rel, outer: 180 - rel } : null;
}

/**
 * What the protractor shows for the angle. A reading needs the centre on O and one arm through a 0 mark;
 * the scale to read is the one whose 0 lies on that arm.
 */
export function readProtractor(s) {
  if (Math.hypot(s.px, s.py) > CENTER_TOL) return { ok: false, reason: "center" };
  const rel = [norm(s.dir1 - s.rot), norm(s.dir2 - s.rot)];
  let outside = false;
  for (const [zero, other] of [[0, 1], [1, 0]]) {
    for (const [mark, scale] of [[0, "inner"], [180, "outer"]]) {
      if (turn(rel[zero], mark) > ZERO_TOL) continue;
      const r = turn(rel[other], 0) <= ZERO_TOL ? 0 : rel[other];
      if (r > 180 + ZERO_TOL) {
        outside = true;
        continue;
      }
      const inner = Math.min(r, 180);
      return { ok: true, scale, zeroArm: zero + 1, value: scale === "inner" ? inner : 180 - inner };
    }
  }
  return { ok: false, reason: outside ? "outside" : "zero" };
}

/** On release the centre jumps onto O when close, and the base line onto an arm when nearly along it. */
export function snapProtractor(s) {
  let { px, py } = s;
  let rot = snapDegree(s.rot);
  if (Math.hypot(px, py) <= SNAP_DIST) {
    px = py = 0;
    const options = [s.dir1, s.dir1 - 180, s.dir2, s.dir2 - 180].map(norm);
    const best = options.reduce((a, b) => (turn(rot, b) < turn(rot, a) ? b : a));
    if (turn(rot, best) <= SNAP_ROT) rot = best;
  }
  return { px, py, rot };
}

// ---------- practice ----------
// [measure, direction of Ox, side on which Oy opens: 1 counter-clockwise, −1 clockwise]
const QUESTIONS = [
  [60, 0, 1], [135, 180, -1], [25, 0, 1], [90, 180, -1], [150, 0, 1], [45, 20, 1],
  [110, 180, -1], [70, 0, 1], [165, 180, -1], [30, 200, -1], [120, 340, 1], [180, 0, 1],
];
export const QUESTION_COUNT = QUESTIONS.length;
const index = i => ((Math.round(Number.isFinite(i) ? i : 0) % QUESTION_COUNT) + QUESTION_COUNT) % QUESTION_COUNT;

export function question(i) {
  const [target, base, side] = QUESTIONS[index(i)];
  return { target, base, side };
}

export const initialState = () => ({
  mode: "measure", // "measure" | "read" | "draw"
  dir1: 0, // direction of ray Ox, degrees
  dir2: 55, // direction of ray Oy
  px: 0, // protractor centre, in arm lengths, y up
  py: 0,
  rot: 0, // protractor rotation, degrees
  showMeasure: true,
  qIndex: 0,
  answer: 90, // what the learner read (practice)
  status: "", // "" | "right" | "wrong"
  solved: 0,
});

/** Set the scene for the current practice question; the protractor is put aside. */
export function startQuestion(s) {
  const q = question(s.qIndex);
  s.dir1 = q.base;
  s.dir2 = norm(q.base + q.side * (s.mode === "draw" ? 10 : q.target)); // drawing starts from a narrow angle
  s.px = 0.1;
  s.py = -0.55;
  s.rot = 12;
  s.answer = 90;
  s.status = "";
  return s;
}

export function nextQuestion(s) {
  s.qIndex = index(s.qIndex + 1);
  return startQuestion(s);
}

export const angleOf = s => angleBetween(s.dir1, s.dir2);

/** A reading or a drawing within 1° counts as correct. */
export const TOLERANCE = 1;
export const isCorrect = s =>
  s.mode === "draw" ? Math.abs(angleOf(s) - question(s.qIndex).target) <= TOLERANCE : s.mode === "read" ? Math.abs(s.answer - angleOf(s)) <= TOLERANCE : false;
