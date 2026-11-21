// Right triangle ABC, right angle at A, acute angle α at B. BC is the hypotenuse.
// With angle B: opposite side AC, adjacent side AB. With angle C = 90° − α the roles swap.

export const initialState = () => ({
  alpha: 35, // góc B, độ
  bc: 6, // cạnh huyền, cm
  atC: false, // xét góc C thay vì góc B
  showSimilar: true,
  task: 0,
  taskDone: false,
});

export const rad = deg => (deg * Math.PI) / 180;
export const deg = r => (r * 180) / Math.PI;

/** Side lengths for angle B = alpha (deg) and hypotenuse bc. */
export function sides(alpha, bc) {
  return { ab: bc * Math.cos(rad(alpha)), ac: bc * Math.sin(rad(alpha)), bc };
}

/** The four ratios computed from the side lengths, for angle B (or C when atC). */
export function ratios(alpha, bc = 1, atC = false) {
  const { ab, ac } = sides(alpha, bc);
  const opp = atC ? ab : ac;
  const adj = atC ? ac : ab;
  return { opp, adj, hyp: bc, sin: opp / bc, cos: adj / bc, tan: opp / adj, cot: adj / opp };
}

// Exact values from the textbook table.
export const EXACT = {
  30: { sin: "1/2", cos: "√3/2", tan: "√3/3", cot: "√3" },
  45: { sin: "√2/2", cos: "√2/2", tan: "1", cot: "1" },
  60: { sin: "√3/2", cos: "1/2", tan: "√3", cot: "√3/3" },
};
const S2 = Math.SQRT2 / 2;
const S3 = Math.sqrt(3);
export const EXACT_VALUES = {
  30: { sin: 0.5, cos: S3 / 2, tan: S3 / 3, cot: S3 },
  45: { sin: S2, cos: S2, tan: 1, cot: 1 },
  60: { sin: S3 / 2, cos: 0.5, tan: S3, cot: S3 / 3 },
};

// Find α (angle B) from a ratio. 0 is "no task".
export const TASKS = [
  null,
  { fn: "sin", value: 0.5, text: "sin α = 0,5" },
  { fn: "cos", value: 0.5, text: "cos α = 0,5" },
  { fn: "tan", value: 1, text: "tan α = 1" },
  { fn: "sin", value: 0.8, text: "sin α = 0,8" },
  { fn: "tan", value: 2, text: "tan α = 2" },
  { fn: "cos", value: 0.9, text: "cos α = 0,9" },
  { fn: "cot", value: 3, text: "cot α = 3" },
];

/** The requested angle in degrees, exact (before rounding). */
export function taskAngle(t) {
  const inv = { sin: Math.asin, cos: Math.acos, tan: Math.atan, cot: v => Math.atan(1 / v) };
  return deg(inv[t.fn](t.value));
}

/** True when alpha is the requested angle rounded to the nearest degree. */
export const taskMet = (alpha, task) => !!TASKS[task] && Math.round(alpha) === Math.round(taskAngle(TASKS[task]));
