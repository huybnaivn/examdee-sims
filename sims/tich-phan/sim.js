import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { X_MIN, X_MAX, N_MAX, FUNCS, RULES, initialState, summary } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const HALF_X = 3.4; // the graph shows −3,4 ≤ x ≤ 3,4
const Y_WINDOW = { lin: [-1, 3], sq: [-1.5, 9.5], cap: [-5.5, 4.8], sin: [-1.4, 1.4], exp: [-2, 21] };
const UP = "rgba(31, 157, 107, 0.28)"; // area above the x axis
const DOWN = "rgba(229, 72, 77, 0.26)"; // area below the x axis
const SHORT = { left: "đầu trái", right: "đầu phải", mid: "trung điểm", trap: "hình thang" };

const num = v => fmt(v, 3);
const snap = x => clamp(Math.round(x * 10) / 10, X_MIN, X_MAX) + 0;

// One result per finished change of a, b, n, the rule or the function.
const commit = (s, api) => {
  const r = summary(s);
  api.emit("integral-approximated", { a: r.a, b: r.b, n: r.n, method: RULES[r.rule].code, approx: r.sum, exact: r.exact, error: r.error }, "result");
};

// Text lines of the box above the graph; its height decides where the graph starts.
function boxLines(s, r, small) {
  const lines = [{ text: `f(x) = ${FUNCS[s.fn].name}`, color: COLORS.blue, big: true }];
  lines.push({ integral: true, text: `f(x)dx = F(${fmt(r.b, 1)}) − F(${fmt(r.a, 1)}) = ${num(r.exact)}`, color: COLORS.ink });
  lines.push({ text: `${small ? "Xấp xỉ" : `Tổng xấp xỉ (${SHORT[r.rule]}, n = ${r.n})`}: ${num(r.sum)}`, color: COLORS.orange });
  lines.push({ text: `Sai số: ${num(r.error)}`, color: COLORS.muted });
  if (!small) lines.push({ text: `Phần trên trục: ${num(r.above)}   Phần dưới trục: ${num(r.below)}`, color: COLORS.green, split: true });
  if (r.a > r.b) lines.push({ text: "a > b: tích phân đổi dấu so với từ b đến a", color: COLORS.purple });
  return lines;
}

function geom(s, view, nLines) {
  const { w, h } = view;
  const size = w < 520 || h < 420 ? 12 : 14;
  const lineH = size * 1.5;
  const top = 8 + lineH * nLines + 16; // the graph starts under the box, so the box never covers it
  const bottom = h - 22;
  const [lo, hi] = Y_WINDOW[s.fn] ?? Y_WINDOW.cap;
  const ppx = (w - 16) / (2 * HALF_X);
  const ppy = (bottom - top) / (hi - lo);
  return { w, h, size, lineH, top, bottom, ppx, ppy, lo, hi, X: x => w / 2 + x * ppx, Y: y => top + (hi - y) * ppy, toX: px => (px - w / 2) / ppx };
}

// ∫ with the limits drawn small, then the rest of the line. Returns nothing; draws at (x, y).
function integralLine(ctx, text, x, y, size, color, a, b) {
  label(ctx, "∫", x, y, { size: size + 6, color });
  label(ctx, fmt(b, 1), x + size * 0.55, y - size * 0.75, { size: size - 3, color });
  label(ctx, fmt(a, 1), x + size * 0.35, y + size * 0.8, { size: size - 3, color });
  ctx.font = `${size - 3}px ${FONT}`;
  const lim = Math.max(ctx.measureText(fmt(b, 1)).width + size * 0.55, ctx.measureText(fmt(a, 1)).width + size * 0.35);
  label(ctx, text, x + lim + 4, y, { size, color, bold: true });
}

let drag = null; // "a" | "b" while an end is dragged

mount({
  slug: "tich-phan",
  version: "1.0.0",
  title: "Tích phân và diện tích hình thang cong",
  hint: "Kéo hai đầu a, b trên trục hoành, chọn cách xấp xỉ và tăng số phần n để thấy tổng xấp xỉ tiến tới tích phân.",
  initialState,
  controls: [
    {
      type: "select",
      key: "fn",
      label: "Hàm số",
      options: Object.entries(FUNCS).map(([value, f]) => ({ value, label: `f(x) = ${f.name}` })),
      onCommit: commit,
    },
    { type: "slider", key: "a", label: "Cận dưới a", min: X_MIN, max: X_MAX, step: 0.1, digits: 1, onCommit: commit },
    { type: "slider", key: "b", label: "Cận trên b", min: X_MIN, max: X_MAX, step: 0.1, digits: 1, onCommit: commit },
    {
      type: "select",
      key: "rule",
      label: "Cách xấp xỉ",
      options: Object.entries(RULES).map(([value, r]) => ({ value, label: r.name })),
      onCommit: commit,
    },
    { type: "slider", key: "n", label: "Số phần n", min: 1, max: N_MAX, step: 1, digits: 0, onCommit: commit },
  ],
  readouts: [
    { label: "Nguyên hàm", value: s => `F(x) = ${FUNCS[s.fn].Fname}` },
    { label: "Độ dài mỗi phần h = (b − a)/n", value: s => num(summary(s).h) },
    { label: "Tích phân F(b) − F(a)", value: s => num(summary(s).exact) },
    { label: "Tổng xấp xỉ", value: s => num(summary(s).sum) },
    { label: "Sai số", value: s => num(summary(s).error) },
    { label: "Diện tích phần trên trục", value: s => num(summary(s).above) },
    { label: "Diện tích phần dưới trục", value: s => num(summary(s).below) },
  ],
  pointer: {
    // Grab the nearer end of [a; b] if the press is within 28 px of it.
    down(p, s, api, view) {
      const g = geom(s, view, boxLines(s, summary(s), view.w < 520 || view.h < 420).length + 0.6);
      const da = Math.abs(p.x - g.X(s.a));
      const db = Math.abs(p.x - g.X(s.b));
      if (Math.min(da, db) > 28 || p.y < g.top - 10) return false;
      drag = da <= db ? "a" : "b";
    },
    move(p, s, api, view) {
      if (drag) s[drag] = snap(geom(s, view, 0).toX(p.x));
    },
    up(p, s, api) {
      if (!drag) return;
      api.emit("limit-dragged", { end: drag === "a" ? 1 : 2, value: s[drag] }, "action");
      drag = null;
      commit(s, api);
    },
  },
  draw(ctx, s, view) {
    const r = summary(s);
    const small = view.w < 520 || view.h < 420;
    const lines = boxLines(s, r, small);
    const g = geom(s, view, lines.length + 0.6); // the ∫ line is 1,6 lines tall
    const { w, top, bottom, X, Y, lo, hi } = g;
    const f = (FUNCS[s.fn] ?? FUNCS.cap).f;
    const y0 = Y(0);
    const ticks = { size: 11, color: COLORS.muted };

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top - 6, w, bottom - top + 12);
    ctx.clip();

    // grid: x every 1, y at a step that keeps about 6–10 lines
    const span = hi - lo;
    const stepY = span > 15 ? 5 : span > 6 ? 2 : span > 3 ? 1 : 0.5;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) {
      ctx.moveTo(X(i), top - 6);
      ctx.lineTo(X(i), bottom + 6);
    }
    for (let v = Math.ceil(lo / stepY) * stepY; v <= hi; v += stepY) {
      ctx.moveTo(0, Y(v));
      ctx.lineTo(w, Y(v));
    }
    ctx.stroke();

    // exact region between the graph and the axis, green above and red below
    const xa = Math.min(r.a, r.b);
    const xb = Math.max(r.a, r.b);
    if (xb > xa) {
      ctx.beginPath();
      ctx.moveTo(X(xa), y0);
      const steps = Math.max(2, Math.ceil((X(xb) - X(xa)) / 2));
      for (let i = 0; i <= steps; i++) {
        const x = xa + ((xb - xa) * i) / steps;
        ctx.lineTo(X(x), Y(f(x)));
      }
      ctx.lineTo(X(xb), y0);
      ctx.closePath();
      for (const [color, y, hgt] of [[UP, 0, y0], [DOWN, y0, view.h]]) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(0, y, w, hgt - y);
        ctx.restore();
      }
    }

    // the n cells of the approximation (rectangles, or trapezoids)
    const cellPx = Math.abs(r.h) * g.ppx;
    ctx.lineWidth = cellPx < 4 ? 0.75 : 1.5;
    ctx.strokeStyle = COLORS.orange;
    ctx.fillStyle = "rgba(240, 140, 46, 0.16)";
    for (const c of r.cells) {
      ctx.beginPath();
      ctx.moveTo(X(c.x0), y0);
      ctx.lineTo(X(c.x0), Y(c.y0));
      ctx.lineTo(X(c.x1), Y(c.y1));
      ctx.lineTo(X(c.x1), y0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // sample points of the rectangle rules, when they are far enough apart to see
    if (r.rule !== "trap" && cellPx >= 10) {
      ctx.fillStyle = COLORS.orange;
      for (const c of r.cells) {
        const x = r.rule === "left" ? c.x0 : r.rule === "right" ? c.x1 : (c.x0 + c.x1) / 2;
        ctx.beginPath();
        ctx.arc(X(x), Y(c.y0), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // axes
    arrow(ctx, 0, y0, w - 3, y0, COLORS.ink, 1.5);
    arrow(ctx, w / 2, bottom + 6, w / 2, top - 4, COLORS.ink, 1.5);
    label(ctx, "x", w - 12, y0 - 13, { bold: true });
    label(ctx, "y", w / 2 + 11, top + 4, { bold: true });
    for (let i = -3; i <= 3; i++) if (i) label(ctx, fmt(i, 0), X(i), y0 + 12, { ...ticks, align: "center" });
    for (let v = Math.ceil(lo / stepY) * stepY; v <= hi; v += stepY) {
      if (Math.abs(v) > 1e-9 && Y(v) > top + 10) label(ctx, fmt(v, 1), w / 2 - 6, Y(v), { ...ticks, align: "right" });
    }

    // graph of f
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let px = 0; px <= w; px += 1.5) {
      const py = clamp(Y(f(g.toX(px))), top - 60, bottom + 60);
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // the ends a and b: guides and handles on the x axis
    for (const [key, x] of [["a", r.a], ["b", r.b]]) {
      const px = X(x);
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(px, y0);
      ctx.lineTo(px, clamp(Y(f(x)), top, bottom));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.purple;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, y0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // tag under the axis (above it if the axis is at the bottom); the right-hand end steps one row
      // further when the two ends are close, and every tag is kept inside the canvas
      if (key === "b" && r.a === r.b) continue;
      const text = r.a === r.b ? `a = b = ${fmt(x, 1)}` : `${key} = ${fmt(x, 1)}`;
      ctx.font = `600 12px ${FONT}`;
      const tw = ctx.measureText(text).width;
      const close = Math.abs(X(r.a) - X(r.b)) < 80 && x === Math.max(r.a, r.b) && r.a !== r.b;
      const dir = y0 + 44 < view.h - 14 ? 1 : -1;
      const tx = clamp(px - tw / 2, 4, w - tw - 4);
      const ty = y0 + dir * (close ? 42 : 24);
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.strokeStyle = COLORS.bg;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.strokeText(text, tx, ty); // halo over ticks and grid
      label(ctx, text, tx, ty, { size: 12, bold: true, color: COLORS.purple });
    }

    // box above the graph
    ctx.font = `600 ${g.size}px ${FONT}`;
    const boxW = Math.min(w - 16, Math.max(...lines.map(l => ctx.measureText(l.text).width + (l.integral ? 30 : 0) + (l.big ? 12 : 0))) + 22);
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(8, 8, boxW, g.lineH * (lines.length + 0.6) + 6, 10);
    ctx.fill();
    ctx.stroke();
    let y = 11;
    lines.forEach(l => {
      const lh = g.lineH * (l.integral ? 1.6 : 1);
      y += lh / 2;
      if (l.integral) integralLine(ctx, l.text, 18, y, g.size, l.color, r.a, r.b);
      else if (l.split) {
        const [up, down] = l.text.split("   ");
        label(ctx, up, 18, y, { size: g.size, bold: true, color: COLORS.green });
        ctx.font = `600 ${g.size}px ${FONT}`;
        label(ctx, down, 30 + ctx.measureText(up).width, y, { size: g.size, bold: true, color: COLORS.red });
      } else label(ctx, l.text, 18, y, { size: l.big ? g.size + 2 : g.size, bold: true, color: l.color });
      y += lh / 2;
    });

    label(ctx, "Hai trục có đơn vị khác nhau", w - 8, view.h - 9, { size: 11, color: COLORS.muted, align: "right" });
  },
});
