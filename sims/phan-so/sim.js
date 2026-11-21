import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { MAX, initialState, read, compare, simplify, toMixed, equivalents, terminates } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SIGN = { "-1": "<", 0: "=", 1: ">" };
const isFrac = p => typeof p === "object";
const plain = f => `${f.n}/${f.d}`;
const decimal = f => `${terminates(f) ? "=" : "≈"} ${fmt(f.n / f.d, 3)}`;

/** One centred line of text mixed with stacked fractions ({ n, d } parts). Shrinks to fit maxW. */
function rich(ctx, parts, cx, y, size, { color = COLORS.ink, bold = false, maxW = Infinity } = {}) {
  const weight = bold ? "600 " : "";
  const fonts = [`${weight}${size}px ${FONT}`, `${weight}${size * 0.88}px ${FONT}`];
  const widths = parts.map(p => {
    ctx.font = fonts[+isFrac(p)];
    return isFrac(p) ? Math.max(ctx.measureText(p.n).width, ctx.measureText(p.d).width) + size * 0.45 : ctx.measureText(p).width;
  });
  const total = widths.reduce((a, b) => a + b, 0);
  if (total > maxW && size > 7) return rich(ctx, parts, cx, y, (size * maxW) / total - 0.2, { color, bold });
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(1, size / 13);
  let x = cx - total / 2;
  parts.forEach((p, i) => {
    ctx.font = fonts[+isFrac(p)];
    if (isFrac(p)) {
      const mid = x + widths[i] / 2;
      ctx.textAlign = "center";
      ctx.fillText(p.n, mid, y - size * 0.56);
      ctx.fillText(p.d, mid, y + size * 0.62);
      ctx.beginPath();
      ctx.moveTo(x + 1.5, y);
      ctx.lineTo(x + widths[i] - 1.5, y);
      ctx.stroke();
    } else {
      ctx.textAlign = "left";
      ctx.fillText(p, x, y);
    }
    x += widths[i];
  });
  ctx.restore();
}

/** Text lines under a shape: lowest terms, mixed number, equal fractions. */
function facts(f) {
  const s = simplify(f);
  const whole = s.d === 1;
  const out = [];
  if (s.n === f.n && !whole) out.push([f, " là phân số tối giản"]);
  else out.push(["Rút gọn: ", f, " = ", whole ? String(s.n) : s]);
  if (f.n > f.d && !whole) {
    const m = toMixed(f);
    out.push(["Hỗn số: ", f, ` = ${m.whole}`, { n: m.n, d: m.d }]);
  }
  out.push([...equivalents(f, 4).flatMap(e => [e, " = "]), "…"]);
  return out;
}

/** f drawn as shaded parts: one circle or bar per unit, each cut into f.d equal parts. */
function shapes(ctx, f, shape, x, y, w, h, color) {
  const units = Math.max(1, Math.ceil(f.n / f.d));
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  const paint = filled => {
    ctx.fillStyle = filled ? color : "#fff";
    ctx.fill();
    ctx.stroke();
  };
  if (shape === "bar") {
    const bw = Math.min(w, 340);
    const gap = Math.min(10, (h / units) * 0.22);
    const bh = Math.min(56, (h - gap * (units - 1)) / units);
    const left = x + (w - bw) / 2;
    const top = y + (h - units * bh - (units - 1) * gap) / 2;
    for (let u = 0; u < units; u++)
      for (let i = 0; i < f.d; i++) {
        ctx.beginPath();
        ctx.rect(left + (i * bw) / f.d, top + u * (bh + gap), bw / f.d, bh);
        paint(u * f.d + i < f.n);
      }
  } else {
    let best = { cell: 0 };
    for (let cols = 1; cols <= units; cols++) {
      const rows = Math.ceil(units / cols);
      const cell = Math.min(w / cols, h / rows, 260);
      if (cell > best.cell) best = { cell, cols, rows };
    }
    const { cell, cols, rows } = best;
    const r = cell / 2 - Math.max(2, cell * 0.05);
    for (let u = 0; u < units; u++) {
      const cx = x + (w - cols * cell) / 2 + ((u % cols) + 0.5) * cell;
      const cy = y + (h - rows * cell) / 2 + (Math.floor(u / cols) + 0.5) * cell;
      for (let i = 0; i < f.d; i++) {
        const from = -Math.PI / 2 + (i * 2 * Math.PI) / f.d;
        ctx.beginPath();
        if (f.d > 1) ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, from, from + (2 * Math.PI) / f.d);
        ctx.closePath();
        paint(u * f.d + i < f.n);
      }
    }
  }
  ctx.restore();
}

function numberLine(ctx, a, b, y, w, fs) {
  const values = [a.n / a.d, b.n / b.d];
  const top = Math.max(1, Math.ceil(Math.max(...values)));
  const x0 = 30;
  const x1 = w - 46;
  const X = v => x0 + ((x1 - x0) * v) / top;
  arrow(ctx, x0 - 12, y, x1 + 30, y, COLORS.ink, 2);

  // parts of each unit: A's above the line, B's below
  [[a, COLORS.blue, -1], [b, COLORS.orange, 1]].forEach(([f, color, side]) => {
    if ((x1 - x0) / (top * f.d) < 5) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= top * f.d; i++) {
      ctx.moveTo(X(i / f.d), y);
      ctx.lineTo(X(i / f.d), y + side * 7);
    }
    ctx.stroke();
  });
  const every = (x1 - x0) / top < 22 ? 2 : 1;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  for (let i = 0; i <= top; i++) {
    ctx.beginPath();
    ctx.moveTo(X(i), y - 9);
    ctx.lineTo(X(i), y + 9);
    ctx.stroke();
    if (i % every === 0) label(ctx, String(i), X(i), y + 19, { size: 12, align: "center", color: COLORS.muted });
  }

  const marks = [[a, values[0], COLORS.blue, -1, 7], [b, values[1], COLORS.orange, 1, 4.5]];
  for (const [f, v, color, side] of marks) {
    const tip = y + side * (side < 0 ? 16 : 30);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(v), y);
    ctx.lineTo(X(v), tip);
    ctx.stroke();
    rich(ctx, [f], clamp(X(v), 14, w - 14), tip + side * fs * 1.25, fs, { color, bold: true });
  }
  for (const [, v, color, , r] of marks) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(v), y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// One result per finished change of a fraction. The goal fires when the learner has just made
// A = B with different denominators (equal fractions), once until they are unequal again.
const report = (s, api) => {
  const { a, b } = read(s);
  const sign = compare(a, b);
  api.emit("comparison", { n1: a.n, d1: a.d, n2: b.n, d2: b.d, comparison: sign }, "result");
  const equal = sign === 0 && a.d !== b.d;
  if (equal && !s._equal) api.emit("equal-fractions", { n1: a.n, d1: a.d, n2: b.n, d2: b.d }, "goal");
  s._equal = equal;
};

const numerator = (key, label) => ({ type: "slider", key, label, min: 0, max: MAX, step: 1, digits: 0, onCommit: report });
const denominator = (key, label) => ({ type: "slider", key, label, min: 1, max: MAX, step: 1, digits: 0, onCommit: report });

mount({
  slug: "phan-so",
  version: "1.0.0",
  title: "Phân số",
  hint: "Thay đổi tử số và mẫu số để so sánh hai phân số, rút gọn và tìm các phân số bằng nhau.",
  initialState,
  controls: [
    { type: "heading", label: "Phân số A" },
    numerator("n1", "Tử số của A"),
    denominator("d1", "Mẫu số của A"),
    { type: "heading", label: "Phân số B" },
    numerator("n2", "Tử số của B"),
    denominator("d2", "Mẫu số của B"),
    {
      type: "select",
      key: "shape",
      label: "Hình minh họa",
      options: [
        { value: "circle", label: "Hình tròn" },
        { value: "bar", label: "Băng giấy (hình chữ nhật)" },
      ],
    },
  ],
  readouts: [
    {
      label: "So sánh",
      value: s => {
        const { a, b } = read(s);
        return `${plain(a)} ${SIGN[compare(a, b)]} ${plain(b)}`;
      },
    },
    {
      label: "Tử A × mẫu B",
      value: s => {
        const { a, b } = read(s);
        return `${a.n} × ${b.d} = ${a.n * b.d}`;
      },
    },
    {
      label: "Tử B × mẫu A",
      value: s => {
        const { a, b } = read(s);
        return `${b.n} × ${a.d} = ${b.n * a.d}`;
      },
    },
    { label: "Giá trị của A", value: s => decimal(read(s).a) },
    { label: "Giá trị của B", value: s => decimal(read(s).b) },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const { a, b } = read(s);
    const small = w < 520 || h < 440;
    const fs = small ? 11 : 15;
    const lineH = fs * 2.25;
    const headH = small ? 46 : 74;
    const lineY = h - (small ? 58 : 82); // number line
    const factsTop = lineY - (small ? 40 : 54) - 3 * lineH;
    const colW = w * 0.41;

    [[a, "A", colW / 2, COLORS.blue], [b, "B", w - colW / 2, COLORS.orange]].forEach(([f, name, cx, color]) => {
      rich(ctx, [`${name} = `, f], cx, headH / 2 + 2, small ? 17 : 26, { color, bold: true });
      shapes(ctx, f, s.shape, cx - colW / 2 + 12, headH, colW - 24, factsTop - headH - 10, color);
      facts(f).forEach((parts, i) => rich(ctx, parts, cx, factsTop + (i + 0.5) * lineH, fs, { maxW: colW - 10 }));
    });

    label(ctx, SIGN[compare(a, b)], w / 2, (headH + factsTop) / 2, { size: small ? 36 : 68, align: "center", bold: true });
    numberLine(ctx, a, b, lineY, w, fs);
  },
});
