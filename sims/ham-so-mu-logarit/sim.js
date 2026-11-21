import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, validBase, power, log, increasing, nearestX, X_MIN, X_MAX } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };

const base = a => (Number.isInteger(a) ? fmt(a, 1) : `(${fmt(a, 1)})`);
const expName = a => `y = ${base(a)}ˣ`;
const logSub = a => `log${[...fmt(a, 1)].map(ch => SUB[ch] ?? ch).join("")}`;
const logName = a => `y = ${logSub(a)} x`;
const pt = (x, y) => `(${fmt(x)}; ${fmt(y)})`;

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(view) {
  const ppu = Math.min(view.w / 12, view.h / 10);
  const ox = view.w * 0.38;
  const oy = view.h * 0.64;
  return {
    ppu, ox, oy,
    X: x => ox + x * ppu,
    Y: y => oy - y * ppu,
    toWorld: p => ({ u: (p.x - ox) / ppu, v: (oy - p.y) / ppu }),
  };
}

const reportBase = (s, api) => {
  if (validBase(s.a)) api.emit("base-set", { a: s.a, increasing: increasing(s.a) ? 1 : 0 }, "result");
};
const reportPoint = (s, api, curve) => {
  if (validBase(s.a)) api.emit("point-released", { a: s.a, x: s.x, power: power(s.a, s.x), curve }, "result");
};

// Text with a halo so it stays readable over the grid and the curves.
function tag(ctx, text, x, y, opts = {}) {
  const size = opts.size ?? 13;
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { bold: true, size, ...opts });
}

function dot(ctx, x, y, color, r = 5.5) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

mount({
  slug: "ham-so-mu-logarit",
  version: "1.0.0",
  title: "Hàm số mũ và hàm số lôgarit",
  hint: "Chọn cơ số a (0 < a ≠ 1). Kéo điểm M trên đồ thị y = aˣ hoặc điểm M' trên đồ thị y = logₐ x: hai điểm luôn đối xứng nhau qua đường thẳng y = x.",
  initialState,
  controls: [
    {
      type: "slider",
      key: "a",
      label: "Cơ số a",
      min: 0.1,
      max: 5,
      step: 0.1,
      digits: 1,
      format: a => (validBase(a) ? fmt(a, 1) : `${fmt(a, 1)} (không hợp lệ)`),
      onCommit: reportBase,
    },
    {
      type: "slider",
      key: "x",
      label: "Hoành độ x₀ của M",
      min: X_MIN,
      max: X_MAX,
      step: 0.1,
      disabled: s => !validBase(s.a),
      onCommit: (s, api) => reportPoint(s, api, 0),
    },
    { type: "slider", key: "t", label: "Số t để tính logₐ t", min: -2, max: 10, step: 0.5, digits: 1 },
  ],
  readouts: [
    { label: "Hàm số mũ", value: s => (validBase(s.a) ? expName(s.a) : "–") },
    { label: "Hàm số lôgarit", value: s => (validBase(s.a) ? logName(s.a) : "–") },
    { label: "Tập xác định của aˣ", value: s => (validBase(s.a) ? "ℝ" : "–") },
    { label: "Tập giá trị của aˣ", value: s => (validBase(s.a) ? "(0; +∞)" : "–") },
    { label: "Tập xác định của logₐ x", value: s => (validBase(s.a) ? "(0; +∞)" : "–") },
    { label: "Tập giá trị của logₐ x", value: s => (validBase(s.a) ? "ℝ" : "–") },
    {
      label: "Tính đơn điệu",
      value: s => (validBase(s.a) ? (increasing(s.a) ? "a > 1: cả hai đồng biến" : "0 < a < 1: cả hai nghịch biến") : "Cần 0 < a ≠ 1"),
    },
    { label: "M(x₀; a^x₀)", value: s => (validBase(s.a) ? pt(s.x, power(s.a, s.x)) : "–") },
    { label: "M'(a^x₀; x₀)", value: s => (validBase(s.a) ? pt(power(s.a, s.x), s.x) : "–") },
    {
      label: "logₐ t",
      value: s => {
        if (!validBase(s.a)) return "–";
        const v = log(s.a, s.t);
        const arg = s.t < 0 ? `(${fmt(s.t, 1)})` : ` ${fmt(s.t, 1)}`;
        return v === null ? `${logSub(s.a)}${arg} không xác định` : `${logSub(s.a)}${arg} ${Number.isInteger(Math.round(v * 1e9) / 1e9) ? "=" : "≈"} ${fmt(v, 3)}`;
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      if (!validBase(s.a)) return false;
      const g = geom(view);
      const y = power(s.a, s.x);
      const dM = Math.hypot(p.x - g.X(s.x), p.y - g.Y(y));
      const dN = Math.hypot(p.x - g.X(y), p.y - g.Y(s.x));
      if (Math.min(dM, dN) > 24) return false;
      s._drag = dM <= dN ? "M" : "N";
      return true;
    },
    move(p, s, api, view) {
      const { u, v } = geom(view).toWorld(p);
      // M' on y = log_a x is M on y = aˣ with the axes swapped
      const x = s._drag === "M" ? nearestX(s.a, u, v) : nearestX(s.a, v, u);
      if (x !== null) s.x = Math.round(x * 100) / 100;
    },
    up(p, s, api) {
      reportPoint(s, api, s._drag === "M" ? 0 : 1);
      s._drag = null;
    },
  },
  draw(ctx, s, view) {
    const { w, h } = view;
    const g = geom(view);
    const { X, Y, ppu } = g;
    const small = w < 520 || h < 420;
    const xLo = -g.ox / ppu, xHi = (w - g.ox) / ppu;
    const yLo = (g.oy - h) / ppu, yHi = g.oy / ppu;

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.ceil(xLo); i <= xHi; i++) (ctx.moveTo(X(i), 0), ctx.lineTo(X(i), h));
    for (let i = Math.ceil(yLo); i <= yHi; i++) (ctx.moveTo(0, Y(i)), ctx.lineTo(w, Y(i)));
    ctx.stroke();

    // axes
    arrow(ctx, 0, g.oy, w - 3, g.oy, COLORS.ink, 1.5);
    arrow(ctx, g.ox, h, g.ox, 3, COLORS.ink, 1.5);
    label(ctx, "x", w - 12, g.oy - 14, { bold: true });
    label(ctx, "y", g.ox + 12, 12, { bold: true });
    label(ctx, "O", g.ox - 10, g.oy + 12, { size: 12, color: COLORS.muted });
    const every = ppu < 34 ? 2 : 1;
    const ticks = { size: 11, color: COLORS.muted };
    for (let i = Math.ceil(xLo + 0.4); i <= xHi - 0.6; i++) if (i && i % every === 0) label(ctx, fmt(i, 0), X(i), g.oy + 12, { ...ticks, align: "center" });
    for (let i = Math.ceil(yLo + 0.4); i <= yHi - 0.4; i++) if (i && i % every === 0) label(ctx, fmt(i, 0), g.ox - 7, Y(i), { ...ticks, align: "right" });

    // y = x
    const lo = Math.max(xLo, yLo), hi = Math.min(xHi, yHi);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(X(lo), Y(lo));
    ctx.lineTo(X(hi), Y(hi));
    ctx.stroke();
    ctx.setLineDash([]);
    tag(ctx, "y = x", X(hi) - 6, Y(hi) + 14, { color: COLORS.muted, align: "right", size: 12 });

    if (!validBase(s.a)) {
      const text = "a = 1: không phải cơ số hợp lệ (cần 0 < a ≠ 1)";
      const size = small ? 12 : 15;
      ctx.font = `600 ${size}px ${FONT}`;
      const bw = Math.min(ctx.measureText(text).width + 24, w - 20);
      ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
      ctx.strokeStyle = COLORS.red;
      ctx.beginPath();
      ctx.roundRect(10, 10, bw, size + 18, 10);
      ctx.fill();
      ctx.stroke();
      label(ctx, text, 22, 19 + size / 2, { size, bold: true, color: COLORS.red });
      return;
    }

    const a = s.a;
    // y = aˣ sampled along x; y = log_a x is the same curve with the axes swapped, sampled along y
    const curve = (color, pts) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    };
    const n = Math.ceil(Math.max(w, h) / 2);
    const exp = [], lg = [];
    for (let i = 0; i <= n; i++) {
      const x = xLo + ((xHi - xLo) * i) / n;
      exp.push([X(x), clamp(Y(a ** x), -h, 2 * h)]);
      const y = yLo + ((yHi - yLo) * i) / n;
      lg.push([clamp(X(a ** y), -w, 2 * w), Y(y)]);
    }
    curve(COLORS.blue, exp);
    curve(COLORS.red, lg);

    // fixed points
    dot(ctx, X(0), Y(1), COLORS.green, 4.5);
    dot(ctx, X(1), Y(0), COLORS.green, 4.5);
    const up = a > 1;
    // labels on the side the curves leave free: above-left / below-right when a > 1, below-left when a < 1
    tag(ctx, "(0; 1)", X(0) - 8, Y(1) + (up ? -10 : 12), { color: COLORS.green, align: "right", size: 12 });
    tag(ctx, "(1; 0)", X(1) + (up ? 8 : -8), Y(0) + 12, { color: COLORS.green, align: up ? "left" : "right", size: 12 });

    // M and its mirror M'
    const y = a ** s.x;
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(s.x), Y(y));
    ctx.lineTo(X(y), Y(s.x));
    ctx.stroke();
    ctx.setLineDash([]);
    dot(ctx, X(s.x), Y(y), COLORS.blue, 7);
    dot(ctx, X(y), Y(s.x), COLORS.red, 7);
    const right = y > s.x; // M above y = x: its label goes up-left, M' down-right
    tag(ctx, small ? "M" : `M${pt(s.x, y)}`, X(s.x) + (right ? -10 : 10), Y(y) - 14, { color: COLORS.blue, align: right ? "right" : "left" });
    tag(ctx, small ? "M'" : `M'${pt(y, s.x)}`, X(y) + (right ? 10 : -10), Y(s.x) + 16, { color: COLORS.red, align: right ? "left" : "right" });

    // legend in the quadrant both curves leave free: top-left when a > 1, top-right when a < 1
    const lines = [[expName(a), COLORS.blue], [logName(a), COLORS.red]];
    if (!small) lines.push([up ? "a > 1: đồng biến" : "0 < a < 1: nghịch biến", COLORS.muted]);
    const size = small ? 13 : 16;
    ctx.font = `600 ${size}px ${FONT}`;
    const bw = Math.max(...lines.map(([t]) => ctx.measureText(t).width)) + 24;
    const bx = up ? 10 : w - 10 - bw;
    const lh = size * 1.45;
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, 10, bw, lh * lines.length + 10, 10);
    ctx.fill();
    ctx.stroke();
    lines.forEach(([t, color], i) => label(ctx, t, bx + 12, 15 + lh * (i + 0.5), { size: i < 2 ? size : size - 3, bold: i < 2, color }));
    if (!small) tag(ctx, "M và M' đối xứng nhau qua đường thẳng y = x", w - 10, h - 14, { size: 12, align: "right", color: COLORS.muted });
  },
});
