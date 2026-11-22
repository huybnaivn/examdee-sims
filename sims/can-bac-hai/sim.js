import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, N_MAX, M_MAX, area, bracket, range, setArea, tryX, midpoint, trapped, simplify, radicand, side } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const sq = x => `${fmt(x, 2)}²`;

/** One line of text, shrunk to fit `maxW`. */
function line(ctx, text, x, y, maxW, { size = 15, color = COLORS.ink, bold = false, align = "left" } = {}) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { size: w > maxW ? Math.max(9, (size * maxW) / w) : size, color, bold, align });
}

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  return { small, size: small ? 12 : 15, gap: small ? 17 : 23, pad: small ? 10 : 18 };
}

// ---------- events ----------
function areaSet(s, api) {
  setArea(s);
  const [lo, hi] = bracket(s.n);
  api.emit("area-set", { area: s.n, side: Math.sqrt(s.n), irrational: lo === hi ? 0 : 1 }, "result");
}

function attempt(s, api, x) {
  const before = trapped(s);
  tryX(s, x);
  s.trial = x;
  if (trapped(s) && !before) {
    const [lo, hi] = range(s);
    api.emit("sqrt-trapped", { area: area(s), lo, hi }, "goal");
  }
}

function simplified(s, api) {
  const m = radicand(s);
  const { a, b } = simplify(m);
  api.emit("simplified", { number: m, a, b }, "result");
}

function result(s) {
  if (s.mode === "diagonal") {
    const a = side(s);
    return `√${2 * a * a}${a > 1 ? ` = ${a}√2` : ""} ≈ ${fmt(a * Math.SQRT2)}`;
  }
  if (s.mode === "simplify") {
    const m = radicand(s);
    const { a, b } = simplify(m);
    return b === 1 ? `√${m} = ${a}` : a === 1 ? `√${m} ≈ ${fmt(Math.sqrt(m))}` : `√${m} = ${a}√${b}`;
  }
  const n = area(s);
  const [lo, hi] = range(s);
  return lo === hi ? `√${n} = ${lo}` : `${fmt(lo)} ≤ √${n} < ${fmt(hi)}`;
}

// ---------- drawing ----------
function rect(ctx, x, y, w, h, { fill, stroke, dash, width = 2 }) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}

function numberLine(ctx, x0, x1, y, from, to, g, marks, step = 0.1) {
  const X = v => x0 + ((v - from) / (to - from)) * (x1 - x0);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0 - 6, y);
  ctx.lineTo(x1 + 6, y);
  ctx.stroke();
  const per = Math.round(1 / step); // ticks per unit
  const tenths = Math.round((to - from) * per);
  for (let k = 0; k <= tenths; k++) {
    const whole = k % per === 0;
    const px = X(from + k / per);
    ctx.beginPath();
    ctx.moveTo(px, y - (whole ? 7 : 4));
    ctx.lineTo(px, y + (whole ? 7 : 4));
    ctx.stroke();
    if (whole || (x1 - x0) / tenths > 26) label(ctx, fmt(from + k / per, 1), px, y + 16, { size: g.size - 1, align: "center", color: whole ? COLORS.ink : COLORS.muted, bold: whole });
  }
  marks?.(X);
  return X;
}

function drawArea(ctx, s, view, g) {
  const n = area(s);
  const [a, b] = bracket(n);
  const [lo, hi] = range(s);
  const perfect = a === b;
  const maxW = view.w - 2 * g.pad;

  // statement
  const text = [];
  if (perfect) {
    text.push([`S = ${n} = ${a}²  ⇒  cạnh = √${n} = ${a}`, COLORS.ink]);
    text.push([n ? "Số chính phương: cạnh là số tự nhiên." : "Diện tích 0: hình vuông thu về một điểm.", COLORS.green]);
  } else {
    text.push([`${a}² = ${a * a} < ${n} < ${b * b} = ${b}²  ⇒  ${a} < √${n} < ${b}`, COLORS.ink]);
    if (lo !== a || hi !== b) text.push([`${sq(lo)} = ${fmt(lo * lo, 4)} ≤ ${n} < ${fmt(hi * hi, 4)} = ${sq(hi)}  ⇒  ${fmt(lo)} ≤ √${n} < ${fmt(hi)}`, COLORS.blue]);
    text.push(
      trapped(s)
        ? [`Kẹp được đến 2 chữ số thập phân! √${n} = ${fmt(Math.sqrt(n), 7)}… là số vô tỉ.`, COLORS.green]
        : [`Thử cạnh x: x² ≤ ${n} thì √${n} ≥ x, x² > ${n} thì √${n} < x.`, COLORS.muted]
    );
  }
  text.forEach(([t, color], i) => line(ctx, t, g.pad, g.pad + 8 + i * g.gap, maxW, { size: g.size, color, bold: i === 0 }));

  // the square, anchored bottom-left, between a² (green) and (a + 1)² (orange)
  const top = g.pad + text.length * g.gap + 6;
  const lineH = perfect ? 0 : g.small ? 46 : 64;
  const box = Math.max(40, Math.min(view.h - top - lineH - g.pad, maxW * (g.small ? 0.62 : 0.5)));
  const unit = box / Math.max(b, 1);
  const x0 = g.pad + 18;
  const y1 = top + box;
  const sd = Math.sqrt(n) * unit;
  rect(ctx, x0, y1 - sd, sd, sd, { fill: "#dbe7fd" });
  ctx.strokeStyle = "rgba(47, 111, 237, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 1; k <= b; k++) {
    if (k * unit >= sd - 0.5) break;
    ctx.moveTo(x0 + k * unit, y1);
    ctx.lineTo(x0 + k * unit, y1 - sd);
    ctx.moveTo(x0, y1 - k * unit);
    ctx.lineTo(x0 + sd, y1 - k * unit);
  }
  ctx.stroke();
  rect(ctx, x0, y1 - sd, sd, sd, { stroke: COLORS.blue, width: 2.5 });
  if (!perfect) {
    rect(ctx, x0, y1 - a * unit, a * unit, a * unit, { stroke: COLORS.green, dash: [5, 4], width: 1.5 });
    rect(ctx, x0, y1 - b * unit, b * unit, b * unit, { stroke: COLORS.orange, dash: [5, 4], width: 1.5 });
  }
  if (n) label(ctx, `S = ${n}`, x0 + sd / 2, y1 - sd / 2, { align: "center", bold: true, size: g.size, color: COLORS.blue });
  label(ctx, perfect ? `${a}` : `√${n}`, x0 - 6, y1 - sd / 2, { align: "right", bold: true, size: g.size - 1, color: COLORS.blue });

  // legend to the right of the square
  const lx = x0 + box + 16;
  if (!perfect && view.w - lx > 120) {
    const items = [
      [COLORS.green, `cạnh ${a}, diện tích ${a * a}`],
      [COLORS.blue, `cạnh √${n}, diện tích ${n}`],
      [COLORS.orange, `cạnh ${b}, diện tích ${b * b}`],
    ];
    items.forEach(([color, t], i) => {
      const y = top + 10 + i * (g.gap - 2);
      rect(ctx, lx, y - 6, 12, 12, { stroke: color, width: 2 });
      line(ctx, t, lx + 18, y, view.w - lx - 22, { size: g.size - 2, color: COLORS.muted });
    });
    line(ctx, "1 ô = 1 đơn vị diện tích", lx, top + 10 + 3 * (g.gap - 2), view.w - lx - 6, { size: g.size - 2, color: COLORS.muted });
  }

  // number line from a to a + 1: the squeeze in blue, the last trial in orange
  if (!perfect) {
    const y = Math.min(view.h - lineH + (g.small ? 14 : 22), y1 + (g.small ? 22 : 36));
    numberLine(ctx, g.pad + 10, view.w - g.pad - 10, y, a, b, g, X => {
      ctx.fillStyle = COLORS.blue;
      ctx.fillRect(X(lo), y - 4, Math.max(3, X(hi) - X(lo)), 8);
      const t = s.trial;
      if (t > a && t < b) {
        const px = X(t);
        ctx.fillStyle = COLORS.orange;
        ctx.beginPath();
        ctx.moveTo(px, y - 6);
        ctx.lineTo(px - 6, y - 15);
        ctx.lineTo(px + 6, y - 15);
        ctx.fill();
      }
    });
  }
}

function drawDiagonal(ctx, s, view, g) {
  const a = side(s);
  const d = a * Math.SQRT2;
  const maxW = view.w - 2 * g.pad;
  const text = [
    [`Hình tô màu = 4 nửa hình vuông cạnh ${a}  ⇒  S = 4 · ${a * a}/2 = ${2 * a * a}`, COLORS.ink],
    [`Cạnh = đường chéo hình vuông cạnh ${a} = √${2 * a * a}${a > 1 ? ` = ${a}√2` : ""} ≈ ${fmt(d, 4)}`, COLORS.purple],
    ["√2 = 1,41421356… (vô hạn không tuần hoàn): số vô tỉ.", COLORS.muted],
  ];
  text.forEach(([t, color], i) => line(ctx, t, g.pad, g.pad + 8 + i * g.gap, maxW, { size: g.size, color, bold: i === 1 }));
  const top = g.pad + 3 * g.gap + 8;
  const avail = view.h - top - g.pad - 20;

  // left: square of side 2a cut into 4 squares; the tilted square joins the midpoints of its sides
  const big = Math.max(40, Math.min(avail, maxW * 0.42));
  const x0 = g.pad + 4;
  const y0 = top + (avail - big) / 2;
  const h = big / 2;
  const mid = [[x0 + h, y0], [x0 + big, y0 + h], [x0 + h, y0 + big], [x0, y0 + h]];
  ctx.fillStyle = "rgba(122, 90, 248, 0.22)";
  ctx.beginPath();
  mid.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  rect(ctx, x0, y0, big, big, { stroke: COLORS.ink, width: 1.5 });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + h, y0);
  ctx.lineTo(x0 + h, y0 + big);
  ctx.moveTo(x0, y0 + h);
  ctx.lineTo(x0 + big, y0 + h);
  ctx.stroke();
  label(ctx, `${a}`, x0 + h / 2, y0 + big + 11, { align: "center", size: g.size - 1, color: COLORS.muted });
  label(ctx, `S = ${2 * a * a}`, x0 + h * 1.45, y0 + h * 0.72, { align: "center", bold: true, size: g.size - 2, color: COLORS.purple });

  // right: the diagonal OB of the square on the number line, turned down onto the line with a compass
  const lx0 = x0 + big + (g.small ? 22 : 40);
  const lx1 = view.w - g.pad - 8;
  const to = Math.ceil(d + 0.3);
  const unit = Math.min((lx1 - lx0) / to, avail * 0.8 / a);
  const y = y0 + big * 0.5 + (a * unit) / 2;
  const X = numberLine(ctx, lx0, lx0 + to * unit, y, 0, to, g, () => {}, 1);
  const O = [X(0), y];
  const B = [X(a), y - a * unit];
  rect(ctx, O[0], y - a * unit, a * unit, a * unit, { fill: "rgba(47, 111, 237, 0.10)", stroke: COLORS.blue, width: 1.5 });
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(...O);
  ctx.lineTo(...B);
  ctx.stroke();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(O[0], O[1], d * unit, -Math.PI / 4, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.purple;
  ctx.beginPath();
  ctx.arc(X(d), y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "O", O[0] - 4, y - 10, { align: "right", bold: true, size: g.size - 1 });
  label(ctx, "B", B[0] + 4, B[1] - 8, { bold: true, size: g.size - 1 });
  label(ctx, a > 1 ? `${a}√2` : "√2", X(d) + 5, y - 14, { bold: true, size: g.size, color: COLORS.purple });
}

function drawSimplify(ctx, s, view, g) {
  const m = radicand(s);
  const { a, b } = simplify(m);
  const maxW = view.w - 2 * g.pad;
  const r = fmt(Math.sqrt(m), 2);
  let text;
  if (b === 1) text = [[`√${m} = √(${a}²) = ${a}`, COLORS.ink], [`${m} là số chính phương.`, COLORS.green]];
  else if (a === 1) text = [[`√${m} ≈ ${r}`, COLORS.ink], [`${m} không chia hết cho số chính phương nào lớn hơn 1: không đưa được thừa số ra ngoài dấu căn.`, COLORS.muted]];
  else
    text = [
      [`√${m} = √(${a}² · ${b}) = √${a * a} · √${b} = ${a}√${b} ≈ ${r}`, COLORS.ink],
      [`√(A·B) = √A · √B với A, B ≥ 0; ${b} không còn ước chính phương nào lớn hơn 1.`, COLORS.muted],
    ];
  text.forEach(([t, color], i) => line(ctx, t, g.pad, g.pad + 8 + i * g.gap, maxW, { size: g.size, color, bold: i === 0 }));

  // a square of area m made of a × a small squares of area b (side √b each)
  const top = g.pad + text.length * g.gap + 10;
  const box = Math.max(40, Math.min(view.h - top - g.pad - 18, maxW - 130));
  const x0 = (view.w - box) / 2 - 20;
  const cell = box / a;
  for (let i = 0; i < a; i++) {
    for (let j = 0; j < a; j++) {
      rect(ctx, x0 + i * cell, top + j * cell, cell, cell, { fill: (i + j) % 2 ? "#dbe7fd" : "#cfeee0", stroke: "#fff", width: 1 });
      if (cell > 26) label(ctx, `${b}`, x0 + (i + 0.5) * cell, top + (j + 0.5) * cell, { align: "center", size: Math.min(g.size, cell / 2.2), color: COLORS.muted });
    }
  }
  rect(ctx, x0, top, box, box, { stroke: COLORS.blue, width: 2.5 });
  label(ctx, `S = ${m}`, x0 + box + 8, top + box / 2, { size: g.size, bold: true, color: COLORS.blue });
  const sideText = b === 1 ? `${a}` : a === 1 ? `√${m}` : `${a}√${b}`;
  label(ctx, b === 1 || a === 1 ? `cạnh ${sideText}` : `cạnh ${a} · √${b} = ${sideText}`, x0 + box / 2, top + box + 12, { align: "center", size: g.size - 1, bold: true, color: COLORS.blue });
}

mount({
  slug: "can-bac-hai",
  version: "1.0.0",
  title: "Căn bậc hai và số vô tỉ",
  hint: "Cạnh của hình vuông có diện tích S là √S. Số âm không có căn bậc hai: không hình vuông nào có diện tích âm.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Nội dung",
      options: [
        { value: "area", label: "Cạnh hình vuông biết diện tích" },
        { value: "diagonal", label: "√2 và đường chéo hình vuông" },
        { value: "simplify", label: "Đưa thừa số ra ngoài dấu căn" },
      ],
    },
    { type: "slider", key: "n", label: "Diện tích S", min: 0, max: N_MAX, step: 1, digits: 0, visible: s => s.mode === "area", onChange: setArea, onCommit: areaSet },
    {
      type: "slider",
      key: "trial",
      label: "Thử cạnh x",
      min: 0,
      max: 15,
      step: 0.01,
      format: v => `${fmt(v)}  →  x² = ${fmt(v * v, 4)}`,
      visible: s => s.mode === "area" && bracket(area(s))[0] !== bracket(area(s))[1],
      onCommit: (s, api) => attempt(s, api, s.trial),
    },
    {
      type: "button",
      label: "Chia đôi khoảng",
      primary: true,
      visible: s => s.mode === "area" && bracket(area(s))[0] !== bracket(area(s))[1],
      disabled: s => trapped(s),
      action: (s, api) => attempt(s, api, midpoint(s)),
      event: "halved",
    },
    { type: "slider", key: "a", label: "Cạnh hình vuông nhỏ a", min: 1, max: 5, step: 1, digits: 0, visible: s => s.mode === "diagonal" },
    { type: "slider", key: "m", label: "Số dưới dấu căn", min: 1, max: M_MAX, step: 1, digits: 0, visible: s => s.mode === "simplify", onCommit: simplified },
  ],
  readouts: [
    { label: "Kết quả", value: result },
    { label: "Độ rộng khoảng kẹp", value: s => (s.mode === "area" ? fmt(range(s)[1] - range(s)[0], 2) : "–") },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    if (s.mode === "diagonal") drawDiagonal(ctx, s, view, g);
    else if (s.mode === "simplify") drawSimplify(ctx, s, view, g);
    else drawArea(ctx, s, view, g);
  },
});
