import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { INEQ, TYPES, initialState, f, analyze, solutionSet, newProblem } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SYMBOL = { gt: ">", ge: "≥", lt: "<", le: "≤" };
const n = (v, digits = 2) => fmt(v, digits);
const exact = v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9;

const poly = (a, b, c) => {
  const terms = [[a, "x²"], [b, "x"], [c, ""]].filter(([k]) => k !== 0);
  if (!terms.length) return "0";
  return terms.map(([k, v], i) => (i ? (k < 0 ? " − " : " + ") : k < 0 ? "−" : "") + (Math.abs(k) === 1 && v ? "" : n(Math.abs(k))) + v).join("");
};

const intervalText = i =>
  i.lo === i.hi ? `{${n(i.lo)}}` : `${i.loClosed ? "[" : "("}${i.lo === -Infinity ? "−∞" : n(i.lo)}; ${i.hi === Infinity ? "+∞" : n(i.hi)}${i.hiClosed ? "]" : ")"}`;

function setText(sol) {
  if (sol.type === "empty") return "∅";
  if (sol.type === "all") return "ℝ";
  const text = sol.intervals.map(intervalText).join(" ∪ ");
  const rounded = sol.intervals.some(i => [i.lo, i.hi].some(v => Number.isFinite(v) && !exact(v)));
  return (sol.type === "allExcept" ? `ℝ \\ {${n(sol.intervals[0].hi)}}` : text) + (rounded ? " (đã làm tròn)" : "");
}

const solved = s => solutionSet(s.a, s.b, s.c, s.ineq);
const correct = s => s.practice && s.answer === solved(s).type;
const revealed = s => !s.practice || correct(s);

function fit(ctx, text, x, y, width, opts) {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: w > width ? Math.max(8, (opts.size * width) / w) : opts.size });
}

function tag(ctx, text, x, y, color, align, size) {
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#fff";
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { color, align, size, bold: true });
}

const niceStep = raw => {
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
};

// The x-window shared by the graph and the number line: around the roots, the vertex and 0.
function windowX(s, t) {
  const xs = [0, ...t.roots];
  if (s.a !== 0) xs.push(-s.b / (2 * s.a));
  let lo = Math.min(...xs);
  let hi = Math.max(...xs);
  if (hi - lo < 4) [lo, hi] = [(lo + hi) / 2 - 2, (lo + hi) / 2 + 2];
  return [lo - 0.3 * (hi - lo), hi + 0.3 * (hi - lo)];
}

// Graph of y = f(x): green where f > 0, red where f < 0. The axes have different scales.
function drawGraph(ctx, R, s, t, x0, x1, small) {
  const g = x => f(s.a, s.b, s.c, x);
  let y0 = 0;
  let y1 = 0;
  for (let i = 0; i <= 80; i++) {
    const y = g(x0 + ((x1 - x0) * i) / 80);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (y1 - y0 < 1e-9) [y0, y1] = [-1, 1];
  // keep a strip on both sides of the axis so both colours and the tick numbers have room
  const span = y1 - y0;
  y0 = Math.min(y0 - 0.1 * span, -0.18 * span);
  y1 = Math.max(y1 + 0.1 * span, 0.18 * span);
  const sx = x => R.x + ((x - x0) / (x1 - x0)) * R.w;
  const sy = y => R.y + R.h - ((y - y0) / (y1 - y0)) * R.h;
  const ax = clamp(sx(0), R.x, R.x + R.w);
  const ay = sy(0);
  const size = small ? 10 : 12;

  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x, R.y, R.w, R.h);
  ctx.clip();
  ctx.fillStyle = "#fff";
  ctx.fillRect(R.x, R.y, R.w, R.h);
  const dx = niceStep((x1 - x0) / Math.max(2, R.w / 70));
  const dy = niceStep((y1 - y0) / Math.max(2, R.h / 36));
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil(x0 / dx) * dx; x <= x1; x += dx) {
    ctx.moveTo(sx(x), R.y);
    ctx.lineTo(sx(x), R.y + R.h);
  }
  for (let y = Math.ceil(y0 / dy) * dy; y <= y1; y += dy) {
    ctx.moveTo(R.x, sy(y));
    ctx.lineTo(R.x + R.w, sy(y));
  }
  ctx.stroke();

  // the region between the curve and the axis, then the curve itself, one colour per half-plane
  const curve = close => {
    ctx.beginPath();
    if (close) ctx.moveTo(sx(x0), ay);
    for (let i = 0; i <= 240; i++) {
      const x = x0 + ((x1 - x0) * i) / 240;
      ctx[i || close ? "lineTo" : "moveTo"](sx(x), sy(g(x)));
    }
    if (close) ctx.lineTo(sx(x1), ay);
  };
  for (const [top, height, color] of [[R.y, ay - R.y, COLORS.green], [ay, R.y + R.h - ay, COLORS.red]]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, top, R.w, height);
    ctx.clip();
    curve(true);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    curve(false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(R.x, ay);
  ctx.lineTo(R.x + R.w, ay);
  ctx.moveTo(ax, R.y);
  ctx.lineTo(ax, R.y + R.h);
  ctx.stroke();
  for (let x = Math.ceil(x0 / dx) * dx; x <= x1; x += dx) {
    if (Math.abs(x) > dx / 2) label(ctx, n(x), sx(x), ay + 10, { size, align: "center", color: COLORS.muted });
  }
  const leftSide = ax - 5 > R.x + 24;
  for (let y = Math.ceil(y0 / dy) * dy; y <= y1; y += dy) {
    if (Math.abs(y) > dy / 2) label(ctx, n(y), leftSide ? ax - 5 : ax + 5, sy(y), { size, align: leftSide ? "right" : "left", color: COLORS.muted });
  }
  label(ctx, "x", R.x + R.w - 6, ay - 10, { size: size + 1, align: "right", bold: true, color: COLORS.muted });
  label(ctx, "y", ax + 8, R.y + 9, { size: size + 1, bold: true, color: COLORS.muted });

  for (const r of t.roots) {
    ctx.fillStyle = COLORS.ink;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(r), ay, small ? 4 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // legend, on the side away from the y-axis
  const right = ax < R.x + R.w / 2;
  const lx = right ? R.x + R.w - 8 : R.x + 8;
  tag(ctx, small ? "f(x) > 0" : "f(x) > 0: phần đồ thị nằm trên trục Ox", lx, R.y + 12, COLORS.green, right ? "right" : "left", size + (small ? 1 : 0));
  tag(ctx, small ? "f(x) < 0" : "f(x) < 0: phần đồ thị nằm dưới trục Ox", lx, R.y + R.h - 11, COLORS.red, right ? "right" : "left", size + (small ? 1 : 0));
  ctx.restore();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(R.x, R.y, R.w, R.h);
}

// Number line under the graph, same x-scale: the solution set is the thick blue part;
// a filled dot is an endpoint that belongs to the set, a hollow dot one that does not.
function drawNumberLine(ctx, R, y, s, t, sol, x0, x1, small) {
  const sx = x => R.x + ((x - x0) / (x1 - x0)) * R.w;
  const size = small ? 10 : 12;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(R.x, y);
  ctx.lineTo(R.x + R.w, y);
  ctx.stroke();
  if (sol) {
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = small ? 5 : 6;
    for (const i of sol.intervals) {
      ctx.beginPath();
      ctx.moveTo(Math.max(R.x, sx(i.lo)), y);
      ctx.lineTo(Math.min(R.x + R.w, sx(i.hi)), y);
      ctx.stroke();
    }
  }
  t.roots.forEach((r, k) => {
    const inSet = sol && sol.intervals.some(i => (i.lo === r && i.loClosed) || (i.hi === r && i.hiClosed));
    const edge = sol && sol.intervals.some(i => i.lo === r || i.hi === r);
    ctx.beginPath();
    ctx.arc(sx(r), y, small ? 4.5 : 6, 0, Math.PI * 2);
    ctx.fillStyle = inSet ? COLORS.blue : "#fff";
    ctx.strokeStyle = edge ? COLORS.blue : COLORS.muted;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    label(ctx, n(r), sx(r), y + (small ? 13 : 16), { size, align: "center", bold: true });
  });
  // the legend goes on a side where it does not run into a root label, or is left out
  const free = (lo, hi) => t.roots.every(r => sx(r) < lo || sx(r) > hi);
  ctx.font = `${size}px ${FONT}`;
  for (const text of !sol ? ["Trục số: tập nghiệm đang ẩn"] : [...(small ? [] : ["Tập nghiệm: phần tô đậm (● lấy, ○ không lấy)"]), "● lấy, ○ không lấy"]) {
    const tw = ctx.measureText(text).width + 28;
    const side = free(R.x + R.w - tw, R.x + R.w) ? "right" : free(R.x, R.x + tw) ? "left" : null;
    if (!side) continue;
    label(ctx, text, side === "left" ? R.x : R.x + R.w, y + (small ? 13 : 16), { size, align: side, color: COLORS.muted });
    break;
  }
}

// Bảng xét dấu: x on the first row, the sign of f(x) on the second.
function drawTable(ctx, R, y, rowH, t, small) {
  const size = small ? 12 : 15;
  const first = small ? 38 : 64;
  const k = t.roots.length;
  const slots = 2 * k + 3; // −∞, sign, root, sign, …, +∞
  const cx = j => R.x + first + ((j + 0.5) * (R.w - first)) / slots;
  ctx.fillStyle = "#fff";
  ctx.fillRect(R.x, y, R.w, 2 * rowH);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.strokeRect(R.x, y, R.w, 2 * rowH);
  ctx.beginPath();
  ctx.moveTo(R.x, y + rowH);
  ctx.lineTo(R.x + R.w, y + rowH);
  ctx.moveTo(R.x + first, y);
  ctx.lineTo(R.x + first, y + 2 * rowH);
  ctx.stroke();
  label(ctx, "x", R.x + first / 2, y + rowH / 2, { size, align: "center", bold: true });
  label(ctx, "f(x)", R.x + first / 2, y + rowH * 1.5, { size, align: "center", bold: true });
  label(ctx, "−∞", cx(0), y + rowH / 2, { size, align: "center" });
  label(ctx, "+∞", cx(slots - 1), y + rowH / 2, { size, align: "center" });
  const names = k === 2 ? ["x₁", "x₂"] : ["x₀"];
  t.roots.forEach((r, i) => {
    const text = `${small && !exact(r) ? "" : names[i] + " "}${exact(r) ? (small ? "= " : "= ") : "≈ "}${n(r)}`;
    fit(ctx, text, cx(2 * i + 2), y + rowH / 2, ((R.w - first) / slots) * 1.9, { size, align: "center", bold: true });
    label(ctx, "0", cx(2 * i + 2), y + rowH * 1.5, { size, align: "center", bold: true });
  });
  t.signs.forEach((sign, i) => {
    label(ctx, sign > 0 ? "+" : sign < 0 ? "−" : "0", cx(2 * i + 1), y + rowH * 1.5, { size: size + 3, align: "center", bold: true, color: sign > 0 ? COLORS.green : sign < 0 ? COLORS.red : COLORS.ink });
  });
}

function rule(s, t, small) {
  if (t.degree === 0) return "a = b = 0: f(x) là hằng số, không phải tam thức bậc hai";
  if (t.degree === 1) return "a = 0: f(x) là nhị thức bậc nhất, không phải tam thức bậc hai";
  const sign = s.a > 0 ? "dương" : "âm";
  if (t.delta < 0) return `Δ < 0: f(x) cùng dấu với a (${sign}) với mọi x ∈ ℝ`;
  if (t.delta === 0) return `Δ = 0: f(x) cùng dấu với a (${sign}) với mọi x ≠ ${n(t.roots[0])}`;
  return small
    ? "“Trong trái, ngoài cùng”: so với dấu của a"
    : "“Trong trái, ngoài cùng”: trong khoảng hai nghiệm f(x) trái dấu với a, ngoài khoảng hai nghiệm f(x) cùng dấu với a";
}

const cmp = v => (v > 0 ? "> 0" : v < 0 ? "< 0" : "= 0");

// One result per committed setting.
const report = (s, api) => {
  const t = analyze(s.a, s.b, s.c);
  const data = {
    a: s.a,
    b: s.b,
    c: s.c,
    inequality: INEQ.indexOf(s.ineq),
    ...(t.degree === 2 && { delta: t.delta, deltaSign: Math.sign(t.delta) }),
    solutionType: TYPES.indexOf(solved(s).type),
  };
  api.emit("sign-analyzed", data, "result");
};
const changed = s => {
  s.answer = "none"; // a new question: the old choice no longer counts
};
const answered = (s, api) => {
  if (!correct(s)) return;
  const data = { a: s.a, b: s.b, c: s.c, inequality: INEQ.indexOf(s.ineq), solutionType: TYPES.indexOf(s.answer) };
  api.emit("solution-set-chosen", data, "goal");
};

mount({
  slug: "dau-tam-thuc-bac-hai",
  version: "1.0.0",
  title: "Dấu của tam thức bậc hai và bất phương trình bậc hai",
  hint: "Đổi a, b, c và dấu của bất phương trình; đối chiếu đồ thị, bảng xét dấu và tập nghiệm trên trục số. Bật luyện tập để tự chọn tập nghiệm.",
  initialState,
  controls: [
    { type: "slider", key: "a", label: "Hệ số a", min: -5, max: 5, step: 1, digits: 0, onChange: changed, onCommit: report },
    { type: "slider", key: "b", label: "Hệ số b", min: -12, max: 12, step: 1, digits: 0, onChange: changed, onCommit: report },
    { type: "slider", key: "c", label: "Hệ số c", min: -18, max: 18, step: 1, digits: 0, onChange: changed, onCommit: report },
    {
      type: "select",
      key: "ineq",
      label: "Bất phương trình",
      onChange: changed,
      onCommit: report,
      options: [
        { value: "gt", label: "f(x) > 0" },
        { value: "ge", label: "f(x) ≥ 0" },
        { value: "lt", label: "f(x) < 0" },
        { value: "le", label: "f(x) ≤ 0" },
      ],
    },
    { type: "checkbox", key: "practice", label: "Luyện tập: ẩn tập nghiệm", onChange: changed },
    {
      type: "select",
      key: "answer",
      label: "Tập nghiệm em chọn (x₁ < x₂ là hai nghiệm, x₀ là nghiệm kép)",
      visible: s => s.practice,
      onCommit: answered,
      options: [
        { value: "none", label: "— Chọn tập nghiệm —" },
        { value: "empty", label: "∅ (vô nghiệm)" },
        { value: "all", label: "ℝ" },
        { value: "point", label: "{x₀}" },
        { value: "allExcept", label: "ℝ \\ {x₀}" },
        { value: "between", label: "(x₁; x₂)" },
        { value: "betweenClosed", label: "[x₁; x₂]" },
        { value: "outside", label: "(−∞; x₁) ∪ (x₂; +∞)" },
        { value: "outsideClosed", label: "(−∞; x₁] ∪ [x₂; +∞)" },
      ],
    },
    {
      type: "button",
      label: "Đề mới",
      visible: s => s.practice,
      event: "new-problem",
      eventKind: "action",
      action(s) {
        Object.assign(s, newProblem(), { answer: "none" });
      },
    },
  ],
  readouts: [
    {
      label: "Biệt thức Δ",
      value: s => {
        const t = analyze(s.a, s.b, s.c);
        return t.degree === 2 ? n(t.delta) : "–";
      },
    },
    {
      label: "Nghiệm của f(x)",
      value: s => {
        const t = analyze(s.a, s.b, s.c);
        return t.roots.length ? t.roots.map(r => n(r)).join(" và ") : s.a === 0 && s.b === 0 && s.c === 0 ? "mọi x" : "không có";
      },
    },
    { label: "Tập nghiệm", value: s => (revealed(s) ? `${setText(solved(s))}` : "?") },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 430;
    const size = small ? 12 : 16;
    const lh = small ? 17 : 27;
    const rowH = small ? 19 : 30;
    const padX = small ? 10 : 22;
    const nl = small ? 26 : 36; // number line strip
    const w = view.w - 2 * padX;
    const t = analyze(s.a, s.b, s.c);
    const sol = solved(s);
    const [x0, x1] = windowX(s, t);

    const head = `f(x) = ${poly(s.a, s.b, s.c)};   a = ${n(s.a)}${s.a ? " " + cmp(s.a) : ""}${t.degree === 2 ? `;   Δ = ${n(t.delta)}${t.delta ? " " + cmp(t.delta) : ""}` : ""}`;
    fit(ctx, head, padX, small ? 12 : 24, w, { size: size + 1, bold: true });

    // bottom up: answer line, rule, sign table, number line; the graph takes what is left
    const bottom = view.h - (small ? 4 : 12);
    const yAnswer = bottom - lh / 2;
    const yRule = yAnswer - lh;
    const yTable = yRule - lh / 2 - 2 - 2 * rowH;
    const yLine = yTable - nl + (small ? 7 : 10);
    const R = { x: padX, y: small ? 23 : 44, w, h: yTable - nl - 4 - (small ? 23 : 44) };

    if (R.h >= 50) drawGraph(ctx, R, s, t, x0, x1, small);
    drawNumberLine(ctx, R, yLine, s, t, revealed(s) ? sol : null, x0, x1, small);
    drawTable(ctx, R, yTable, rowH, t, small);
    fit(ctx, rule(s, t, small), padX, yRule, w, { size: size - 1, color: COLORS.muted });

    const question = `f(x) ${SYMBOL[s.ineq]} 0`;
    let text = `Tập nghiệm của ${question}:  S = ${setText(sol)}`;
    let color = COLORS.blue;
    if (s.practice && t.degree < 2) [text, color] = ["Luyện tập cần tam thức bậc hai: hãy chọn a ≠ 0", COLORS.orange];
    else if (correct(s)) [text, color] = [`✓ Đúng: ${question} có S = ${setText(sol)}`, COLORS.green];
    else if (s.practice && s.answer !== "none") [text, color] = [`✗ Chưa đúng. Xem lại bảng xét dấu và dấu “${SYMBOL[s.ineq]}” của ${question}`, COLORS.red];
    else if (s.practice) [text, color] = [`Tập nghiệm của ${question} là gì? Hãy chọn ở bảng điều khiển`, COLORS.orange];
    fit(ctx, text, padX, yAnswer, w, { size: size + 1, bold: true, color });
  },
});
