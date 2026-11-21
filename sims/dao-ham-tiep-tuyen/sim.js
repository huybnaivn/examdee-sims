import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { X_MIN, X_MAX, STEP, FUNCS, initialState, value, derivative, summary } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const HALF_X = 4.6; // the graph always shows at least −4,6 ≤ x ≤ 4,6
// Visible y range of the graph of f (same unit length as x) and of the graph of f′ (own vertical scale).
const WINDOW = {
  sq: { y: [-1.5, 7.5], d: [-9, 9] },
  cubic: { y: [-4.5, 4.5], d: [-5, 11] },
  sin: { y: [-3, 3], d: [-1.7, 1.7] },
  exp: { y: [-1.5, 7.5], d: [-1.5, 8] },
  inv: { y: [-4.5, 4.5], d: [-9, 2] },
  sqrt: { y: [-2, 4], d: [-0.8, 3.2] },
};

const num = (v, digits = 3) => fmt(v, digits);
const point = (x, y) => `(${num(x, 2)}; ${num(y)})`;
const lineEq = t => {
  if (t.slope === 0) return `y = ${num(t.intercept)}`;
  const k = Math.abs(t.slope) === 1 ? (t.slope < 0 ? "−" : "") : num(t.slope);
  const b = Math.abs(t.intercept) < 5e-4 ? "" : ` ${t.intercept < 0 ? "−" : "+"} ${num(Math.abs(t.intercept))}`;
  return `y = ${k}x${b}`;
};

// Shared by draw() and the pointer, so both agree on where x is.
function geom(s, view) {
  const { w, h } = view;
  const top = s.showDerivative ? Math.round(h * 0.62) : h; // height of the graph of f
  const [lo, hi] = WINDOW[s.fn].y;
  const ppu = Math.min(w / (2 * HALF_X), top / (hi - lo));
  const mid = (lo + hi) / 2;
  return { w, h, top, ppu, yLo: mid - top / 2 / ppu, yHi: mid + top / 2 / ppu, X: x => w / 2 + x * ppu, Y: y => top / 2 - (y - mid) * ppu, toX: px => (px - w / 2) / ppu };
}

// Text with a halo so it stays readable over the grid and the curves.
function tag(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = `600 ${opts.size ?? 13}px ${FONT}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = opts.halo ?? COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { size: 13, bold: true, ...opts });
}

// Curve of g between screen rows y0..y1; the path breaks where g is undefined or jumps across an asymptote.
function plot(ctx, g, geo, toY, y0, y1, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  let side = null; // null: pen up
  for (let px = 0; px <= geo.w + 1; px += 1.5) {
    const v = g(geo.toX(px));
    if (v === null) {
      side = null;
      continue;
    }
    const py = toY(v);
    const now = py < y0 ? -1 : py > y1 ? 1 : 0;
    if (side === null || (now !== 0 && side === -now)) ctx.moveTo(px, clamp(py, y0 - 60, y1 + 60));
    else ctx.lineTo(px, clamp(py, y0 - 60, y1 + 60));
    side = now;
  }
  ctx.stroke();
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

function dashed(ctx, x1, y1, x2, y2, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// "Released": one result per release, and one goal each time a stationary point is newly found.
function commit(s, api) {
  const r = summary(s);
  if (r.y === null || r.slope === null) {
    s._stationary = false;
    return;
  }
  api.emit("point-released", { x: r.x, y: r.y, slope: r.slope }, "result");
  if (r.stationary && !s._stationary) api.emit("stationary-point", { x: r.x, y: r.y }, "goal");
  s._stationary = r.stationary;
}

const trendText = r => {
  if (r.y === null) return "f không xác định tại x₀";
  if (r.slope === null) return "f′(x₀) không tồn tại";
  if (r.slope === 0) return "f′(x₀) = 0: tiếp tuyến nằm ngang";
  if (r.stationary) return "f′(x₀) ≈ 0: tiếp tuyến gần như nằm ngang";
  return r.slope > 0 ? "f′(x₀) > 0: đồ thị đi lên" : "f′(x₀) < 0: đồ thị đi xuống";
};

mount({
  slug: "dao-ham-tiep-tuyen",
  version: "1.0.0",
  title: "Đạo hàm và tiếp tuyến",
  hint: "Kéo điểm M trên đồ thị, rồi giảm h về 0 để cát tuyến MN tiến dần tới tiếp tuyến. Thử tìm điểm có f′(x₀) = 0.",
  initialState,
  controls: [
    {
      type: "select",
      key: "fn",
      label: "Hàm số",
      onChange: s => {
        s._stationary = false;
      },
      options: Object.entries(FUNCS).map(([value, f]) => ({ value, label: `f(x) = ${f.name}` })),
    },
    { type: "slider", key: "x0", label: "Hoành độ x₀ của M", min: X_MIN, max: X_MAX, step: STEP, onCommit: commit },
    { type: "slider", key: "h", label: "Số gia h (N ở x₀ + h)", min: 0.01, max: 2, step: 0.01 },
    { type: "checkbox", key: "showDerivative", label: "Vẽ đồ thị của đạo hàm f′ ở bên dưới" },
  ],
  readouts: [
    { label: "Đạo hàm", value: s => `f′(x) = ${FUNCS[s.fn].dname}` },
    {
      label: "Điểm M",
      value: s => {
        const r = summary(s);
        return r.y === null ? "không xác định" : point(r.x, r.y);
      },
    },
    {
      label: "Hệ số góc cát tuyến MN",
      value: s => {
        const r = summary(s);
        return r.secant === null ? "không xác định" : num(r.secant);
      },
    },
    {
      label: "Hệ số góc tiếp tuyến tại M",
      value: s => {
        const r = summary(s);
        return r.slope === null ? "không tồn tại" : num(r.slope);
      },
    },
    {
      label: "Đạo hàm tại x₀",
      value: s => {
        const r = summary(s);
        return `f′(${num(r.x, 2)}) ${r.slope === null ? "không tồn tại" : "= " + num(r.slope)}`;
      },
    },
    {
      label: "Chênh lệch cát tuyến – tiếp tuyến",
      value: s => {
        const r = summary(s);
        return r.gap === null ? "–" : num(r.gap);
      },
    },
    {
      label: "Tiếp tuyến tại M",
      value: s => {
        const r = summary(s);
        return r.tangent ? lineEq(r.tangent) : "–";
      },
    },
    { label: "Nhận xét", value: s => trendText(summary(s)) },
  ],
  pointer: {
    // Press anywhere: M jumps to that abscissa and follows the pointer.
    down(p, s, api, view) {
      this.move(p, s, api, view);
    },
    move(p, s, api, view) {
      s.x0 = clamp(Math.round(geom(s, view).toX(p.x) / STEP) * STEP, X_MIN, X_MAX);
      s.x0 = Math.round(s.x0 * 100) / 100 + 0;
    },
    up(p, s, api) {
      commit(s, api);
    },
  },
  draw(ctx, s, view) {
    const geo = geom(s, view);
    const { w, h, top, ppu, yLo, yHi, X, Y } = geo;
    const r = summary(s);
    const small = w < 520;
    const xMax = w / 2 / ppu;
    const mx = X(r.x);
    const every = ppu < 34 ? 2 : 1;
    const ticks = { size: 11, color: COLORS.muted };
    const inView = y => y !== null && y >= yLo && y <= yHi;

    // ----- graph of f -----
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, top);
    ctx.clip();

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -Math.floor(xMax); i <= xMax; i++) {
      ctx.moveTo(X(i), 0);
      ctx.lineTo(X(i), top);
    }
    for (let i = Math.ceil(yLo); i <= yHi; i++) {
      ctx.moveTo(0, Y(i));
      ctx.lineTo(w, Y(i));
    }
    ctx.stroke();

    arrow(ctx, 0, Y(0), w - 3, Y(0), COLORS.ink, 1.5);
    arrow(ctx, w / 2, top, w / 2, 3, COLORS.ink, 1.5);
    label(ctx, "x", w - 12, Y(0) - 14, { bold: true });
    label(ctx, "y", w / 2 + 12, 12, { bold: true });
    label(ctx, "O", w / 2 - 11, Y(0) + 12, { size: 12, color: COLORS.muted });
    for (let i = -Math.floor(xMax - 0.4); i <= xMax - 0.4; i++) {
      if (i && i % every === 0) label(ctx, fmt(i, 0), X(i), Y(0) + 12, { ...ticks, align: "center" });
    }
    for (let i = Math.ceil(yLo + 0.4); i <= yHi - 0.4; i++) {
      if (i && i % every === 0) label(ctx, fmt(i, 0), w / 2 - 7, Y(i), { ...ticks, align: "right" });
    }

    plot(ctx, x => value(s.fn, x), geo, Y, 0, top, COLORS.blue, 3);

    const through = (x, y, k, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(0, Y(y + k * (geo.toX(0) - x)));
      ctx.lineTo(w, Y(y + k * (geo.toX(w) - x)));
      ctx.stroke();
    };

    if (r.y === null) {
      dashed(ctx, mx, 0, mx, top, COLORS.red);
    } else {
      // secant MN with its run h and rise Δy
      if (r.secant !== null) {
        through(r.x, r.y, r.secant, COLORS.purple, 2);
        const nx = X(r.x2);
        if (!small && nx - mx > 30) {
          dashed(ctx, mx, Y(r.y), nx, Y(r.y), COLORS.purple);
          dashed(ctx, nx, Y(r.y), nx, Y(r.y2), COLORS.purple);
          tag(ctx, "h", (mx + nx) / 2, Y(r.y) + (r.secant >= 0 ? 12 : -12), { color: COLORS.purple, align: "center", size: 12 });
          if (Math.abs(Y(r.y2) - Y(r.y)) > 30) tag(ctx, "Δy", nx + 7, (Y(r.y) + Y(r.y2)) / 2, { color: COLORS.purple, size: 12 });
        }
      }
      if (r.tangent) through(r.x, r.y, r.slope, COLORS.orange, 2.5);
      if (r.secant !== null && inView(r.y2)) {
        dot(ctx, X(r.x2), Y(r.y2), COLORS.purple, 4.5);
        tag(ctx, "N", X(r.x2) - 9, Y(r.y2) + (r.secant >= 0 ? -13 : 13), { color: COLORS.purple, align: "right" });
      }
      if (inView(r.y)) {
        dot(ctx, mx, Y(r.y), COLORS.blue, 7);
        const below = r.slope !== null && r.slope < 0;
        tag(ctx, small ? "M" : `M${point(r.x, r.y)}`, mx - 10, Y(r.y) + (below ? 16 : -15), { color: COLORS.blue, align: "right" });
      } else {
        // M is above or below the visible part of the plane
        const up = r.y > yHi;
        dashed(ctx, mx, Y(0), mx, up ? 0 : top, COLORS.blue);
        const right = mx > w - 150;
        tag(ctx, `M ở ngoài khung hình ${up ? "↑" : "↓"}`, mx + (right ? -8 : 8), up ? 62 : top - 14, { color: COLORS.blue, size: 12, align: right ? "right" : "left" });
      }
    }

    // summary box
    const x0 = num(r.x, 2);
    const lines = [{ text: `f(x) = ${FUNCS[s.fn].name}`, color: COLORS.blue, big: true }];
    if (r.y === null) lines.push({ text: `f không xác định tại x₀ = ${x0}`, color: COLORS.red });
    else {
      lines.push({
        text: r.slope === null ? `f′(${x0}) không tồn tại` : `${small ? "" : "Tiếp tuyến tại M: k = "}f′(${x0}) = ${num(r.slope)}`,
        color: r.slope === null ? COLORS.red : COLORS.orange,
      });
      lines.push({ text: `Cát tuyến MN: k = ${r.secant === null ? "không xác định" : num(r.secant)}`, color: COLORS.purple });
      if (r.stationary && !small) lines.push({ text: "f′(x₀) = 0: M là điểm dừng", color: COLORS.green });
    }
    const size = small ? 12 : 14;
    const fontOf = l => `600 ${l.big ? size + 2 : size}px ${FONT}`;
    const boxW = Math.max(...lines.map(l => ((ctx.font = fontOf(l)), ctx.measureText(l.text).width))) + 22;
    const lineH = size * 1.45;
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(8, 8, boxW, lineH * lines.length + 12, 10);
    ctx.fill();
    ctx.stroke();
    lines.forEach((l, i) => label(ctx, l.text, 19, 14 + lineH * (i + 0.5), { size: l.big ? size + 2 : size, bold: true, color: l.color }));
    ctx.restore();

    if (!s.showDerivative) return;

    // ----- graph of f′, same x axis, its own vertical scale -----
    const [dLo, dHi] = WINDOW[s.fn].d;
    const pad = 10;
    const Yd = v => top + pad + ((dHi - v) / (dHi - dLo)) * (h - top - 2 * pad);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, w, h - top);
    ctx.clip();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, top, w, h - top);
    const span = dHi - dLo;
    const stepY = span > 12 ? 4 : span > 6 ? 2 : 1;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -Math.floor(xMax); i <= xMax; i++) {
      ctx.moveTo(X(i), top);
      ctx.lineTo(X(i), h);
    }
    for (let v = Math.ceil(dLo / stepY) * stepY; v <= dHi; v += stepY) {
      ctx.moveTo(0, Yd(v));
      ctx.lineTo(w, Yd(v));
    }
    ctx.moveTo(0, top + 0.5);
    ctx.lineTo(w, top + 0.5);
    ctx.stroke();
    arrow(ctx, 0, Yd(0), w - 3, Yd(0), COLORS.ink, 1.5);
    arrow(ctx, w / 2, h, w / 2, top + 4, COLORS.ink, 1.5);
    label(ctx, "x", w - 12, Yd(0) - 12, { bold: true });
    for (let v = Math.ceil(dLo / stepY) * stepY; v <= dHi; v += stepY) {
      if (v && Yd(v) > top + 16) label(ctx, fmt(v, 0), w / 2 - 7, Yd(v), { ...ticks, align: "right" });
    }
    plot(ctx, x => derivative(s.fn, x), geo, Yd, top, h, COLORS.orange, 2.5);
    const title = `y = f′(x) = ${FUNCS[s.fn].dname}`;
    tag(ctx, title, 12, top + 15, { color: COLORS.orange, halo: "#fff" });
    if (!small) {
      ctx.font = `600 13px ${FONT}`;
      label(ctx, "(trục tung có tỉ lệ riêng)", 20 + ctx.measureText(title).width, top + 15, { size: 12, color: COLORS.muted });
    }
    ctx.restore();

    // the height of this point is the slope of the tangent above
    if (r.slope !== null) {
      const py = Yd(r.slope);
      const shown = py >= top + 4 && py <= h - 4;
      dashed(ctx, mx, clamp(Y(r.y), 0, top), mx, clamp(py, top, h), COLORS.muted);
      if (shown) dot(ctx, mx, py, COLORS.orange);
      // free corner next to the point: left of the guide, above a rising f′ and below a falling one
      const rising = (derivative(s.fn, r.x + STEP) ?? r.slope) >= r.slope;
      const left = mx > 130;
      const ty = clamp(py + (rising === left ? -14 : 15), top + 32, h - 10);
      tag(ctx, `f′(${x0}) = ${num(r.slope)}`, mx + (left ? -9 : 9), ty, { color: COLORS.orange, halo: "#fff", align: left ? "right" : "left", size: 12 });
    }
  },
});
