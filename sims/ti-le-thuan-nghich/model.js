// Direct and inverse proportion from real situations.
// The learner picks four values of x; y comes from the situation. The table is classified from its
// numbers alone: y/x constant ⇒ tỉ lệ thuận (y = kx), x·y constant ⇒ tỉ lệ nghịch (xy = a), else neither.

export const SCENARIOS = {
  "gia-tien": {
    label: "Mua vở: mỗi quyển giá 8 nghìn đồng",
    x: "Số quyển vở",
    xu: "quyển",
    y: "Số tiền",
    yu: "nghìn đồng",
    f: x => 8 * x,
    known: 3, // the question gives y at this x
    ask: 15, // and asks for y at this x (outside the stepper range on purpose)
  },
  "cong-nhan": {
    label: "Làm một công việc: 1 công nhân làm xong trong 60 giờ (mọi người làm như nhau)",
    x: "Số công nhân",
    xu: "người",
    y: "Thời gian làm xong",
    yu: "giờ",
    f: x => 60 / x,
    known: 4,
    ask: 20,
  },
  "quang-duong": {
    label: "Xe đạp đi đều với vận tốc 12 km/h",
    x: "Thời gian đi",
    xu: "giờ",
    y: "Quãng đường",
    yu: "km",
    f: x => 12 * x,
    known: 2,
    ask: 15,
  },
  taxi: {
    label: "Đi taxi: mở cửa 10 nghìn đồng, mỗi km thêm 12 nghìn đồng",
    x: "Số km",
    xu: "km",
    y: "Số tiền",
    yu: "nghìn đồng",
    f: x => 12 * x + 10,
    known: 1,
    ask: 15,
  },
};
export const SCENARIO_KEYS = Object.keys(SCENARIOS);
export const X_RANGE = [1, 12];

export const initialState = () => ({
  scenario: "gia-tien",
  x1: 1,
  x2: 2,
  x3: 4,
  x4: 5,
  answer: 0, // the learner's value of y at x = ask
  showGraph: true,
});

export const DIRECT = 1;
export const INVERSE = 2;
export const NEITHER = 0;
export const UNKNOWN = -1; // fewer than two different x values: cannot tell

const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Classify a table of positive x and y. Returns { type, constant } (k for direct, a for inverse). */
export function classify(xs, ys) {
  if (new Set(xs).size < 2) return { type: UNKNOWN, constant: NaN };
  const ratios = xs.map((x, i) => ys[i] / x);
  if (ratios.every(r => same(r, ratios[0]))) return { type: DIRECT, constant: ratios[0] };
  const products = xs.map((x, i) => x * ys[i]);
  if (products.every(p => same(p, products[0]))) return { type: INVERSE, constant: products[0] };
  return { type: NEITHER, constant: NaN };
}

export const xs = s => [s.x1, s.x2, s.x3, s.x4];
export const table = s => {
  const sc = SCENARIOS[s.scenario];
  const x = xs(s);
  const y = x.map(sc.f);
  return { x, y, ratio: x.map((v, i) => y[i] / v), product: x.map((v, i) => v * y[i]), ...classify(x, y) };
};

/** y at x from one known pair (x0, y0), using the proportion type. */
export function missing(type, x0, y0, x) {
  if (type === DIRECT) return (y0 / x0) * x;
  if (type === INVERSE) return (x0 * y0) / x;
  return NaN;
}

/** The type of the situation itself, read from a full table x = 1…12. */
export const situationType = key => {
  const x = Array.from({ length: 12 }, (_, i) => i + 1);
  return classify(x, x.map(SCENARIOS[key].f));
};

/** The correct answer to the question of a situation. */
export function answerOf(key) {
  const sc = SCENARIOS[key];
  const { type } = situationType(key);
  return type === NEITHER ? sc.f(sc.ask) : missing(type, sc.known, sc.f(sc.known), sc.ask);
}

/** Graph of the situation: "line-origin" (y = kx), "hyperbola" (y = a/x) or "line" (not through O). */
export function graphKind(key) {
  const { type } = situationType(key);
  return type === DIRECT ? "line-origin" : type === INVERSE ? "hyperbola" : "line";
}
