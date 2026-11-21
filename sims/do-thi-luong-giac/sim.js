import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, analyze, evaluate, parent, zeros, peakX, phase, piText, formula } from "./model.js";

const PI = Math.PI;
const Y_MAX = 5.5; // |a| + |d| never exceeds 5
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const pi = x => piText(x) ?? `≈ ${fmt(x)}`;
const piApprox = x => (piText(x)?.includes("π") ? `${piText(x)} ≈ ${fmt(x)}` : pi(x));

// Text with a halo so it stays readable over the grid and the curves.
function tag(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = `600 ${opts.size ?? 13}px ${FONT}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { size: 13, bold: true, ...opts });
}

const geom = view => {
  const small = view.w < 520 || view.h < 400;
  const scale = Math.min((view.w - 16) / (4 * PI + 0.8), (view.h - 16) / (2 * Y_MAX + 0.4));
  const cx = view.w / 2;
  const cy = view.h / 2;
  return { small, scale, xHalf: cx / scale, X: x => cx + x * scale, Y: y => cy - y * scale };
};

// Draw y = f(x) across the stage; `cell(x)` changes value across a vertical asymptote.
function plot(ctx, g, view, f, cell) {
  ctx.beginPath();
  let pen = false;
  let last = null;
  for (let px = 0; px <= view.w; px++) {
    const x = (px - view.w / 2) / g.scale;
    const y = f(x);
    const k = cell(x);
    if (y === null || k !== last) pen = false;
    last = k;
    if (y === null) continue;
    const py = g.Y(Math.max(-40, Math.min(40, y)));
    if (pen) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
    pen = true;
  }
  ctx.stroke();
}

const both = (ctx, x1, y1, x2, y2, color) => {
  arrow(ctx, x1, y1, x2, y2, color, 2);
  arrow(ctx, x2, y2, x1, y1, color, 2);
};

// One `result` per finished adjustment (slider released, function picked), not one per slider tick.
const settle = (s, api) => {
  const an = analyze(s);
  const data = { amplitude: an.amplitude ?? 0, period: an.period ?? 0, phaseShift: an.phaseShift ?? 0, verticalShift: an.verticalShift };
  api.emit("curve-settled", data, "result");
};

const coefficient = (key, name, max) => ({ type: "slider", key, label: name, min: -max, max, step: 0.25, onCommit: settle });

mount({
  slug: "do-thi-luong-giac",
  version: "1.0.0",
  title: "Đồ thị hàm số lượng giác",
  hint: "Thay đổi a, b, c, d và so sánh với đồ thị hàm số gốc (nét đứt).",
  initialState,
  controls: [
    {
      type: "select",
      key: "fn",
      label: "Hàm số",
      onCommit: settle,
      options: [
        { value: "sin", label: "y = a·sin(bx + c) + d" },
        { value: "cos", label: "y = a·cos(bx + c) + d" },
        { value: "tan", label: "y = a·tan(bx + c) + d" },
      ],
    },
    coefficient("a", "Hệ số a", 3),
    coefficient("b", "Hệ số b", 3),
    { type: "slider", key: "c", label: "Hệ số c", min: -12, max: 12, step: 1, onCommit: settle, format: (v, s) => pi(phase(s)) },
    coefficient("d", "Hệ số d", 2),
    { type: "checkbox", key: "showParent", label: "Hiện đồ thị hàm số gốc" },
  ],
  readouts: [
    { label: "Hàm số", value: formula },
    {
      label: "Biên độ |a|",
      value: s => (s.fn === "tan" ? "không có (hàm tan)" : fmt(analyze(s).amplitude)),
    },
    {
      label: "Chu kì T",
      value: s => {
        const T = analyze(s).period;
        return T === null ? "hàm hằng" : `${s.fn === "tan" ? "π" : "2π"}/|b| = ${piApprox(T)}`;
      },
    },
    {
      label: "Dịch ngang −c/b",
      value: s => {
        const x0 = analyze(s).phaseShift;
        if (x0 === null) return "–";
        return x0 === 0 ? "0 (không dịch)" : `${pi(x0)} (sang ${x0 < 0 ? "trái" : "phải"})`;
      },
    },
    {
      label: "Dịch dọc d",
      value: s => (s.d === 0 ? "0 (không dịch)" : `${fmt(s.d)} (${s.d > 0 ? "lên trên" : "xuống dưới"})`),
    },
    {
      label: "Tập giá trị",
      value: s => {
        const { range, constant } = analyze(s);
        if (range === null) return "không xác định";
        if (constant) return `{${fmt(range[0])}}`;
        return s.fn === "tan" ? "ℝ" : `[${fmt(range[0])}; ${fmt(range[1])}]`;
      },
    },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const { X, Y, small, xHalf } = g;
    const an = analyze(s);
    const size = small ? 11 : 13;
    const tan = s.fn === "tan";
    const wave = !an.constant && !tan;

    // grid: every π/2 across, every unit up
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const nx = Math.floor(xHalf / (PI / 2));
    for (let k = -nx; k <= nx; k++) {
      ctx.moveTo(X((k * PI) / 2), 0);
      ctx.lineTo(X((k * PI) / 2), view.h);
    }
    for (let y = -Math.floor(Y_MAX); y <= Y_MAX; y++) {
      ctx.moveTo(0, Y(y));
      ctx.lineTo(view.w, Y(y));
    }
    ctx.stroke();

    // band of values
    if (wave) {
      ctx.fillStyle = "rgba(47, 111, 237, 0.07)";
      ctx.fillRect(0, Y(an.range[1]), view.w, Y(an.range[0]) - Y(an.range[1]));
    }

    // axes
    arrow(ctx, 0, Y(0), view.w - 2, Y(0), COLORS.ink, 1.5);
    arrow(ctx, X(0), view.h, X(0), 2, COLORS.ink, 1.5);
    label(ctx, "x", view.w - 10, Y(0) - 12, { size, color: COLORS.ink });
    label(ctx, "y", X(0) + 9, 9, { size, color: COLORS.ink });
    const every = small ? 2 : 1; // label every π when the stage is narrow
    ctx.strokeStyle = COLORS.ink;
    ctx.beginPath();
    for (let k = -nx; k <= nx; k++) {
      if (k === 0) continue;
      const x = X((k * PI) / 2);
      if (x < 14 || x > view.w - 22) continue;
      ctx.moveTo(x, Y(0) - 3);
      ctx.lineTo(x, Y(0) + 3);
      if (k % every === 0) tag(ctx, piText((k * PI) / 2), x, Y(0) + 13, { size: size - 1, align: "center", color: COLORS.muted, bold: false });
    }
    ctx.stroke();
    for (let y = -5; y <= 5; y++) {
      if (y === 0 || (small && y % 2)) continue;
      tag(ctx, fmt(y), X(0) - 7, Y(y), { size: size - 1, align: "right", color: COLORS.muted, bold: false });
    }
    tag(ctx, "O", X(0) - 7, Y(0) + 13, { size: size - 1, align: "right", color: COLORS.muted, bold: false });

    // midline y = d
    ctx.lineWidth = 1.5;
    if (!an.constant) {
      ctx.strokeStyle = COLORS.orange;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(0, Y(s.d));
      ctx.lineTo(view.w, Y(s.d));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // asymptotes of tan
    if (tan && !an.constant) {
      ctx.strokeStyle = COLORS.red;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      const u0 = s.b * -xHalf + phase(s);
      const u1 = s.b * xHalf + phase(s);
      for (let k = Math.ceil((Math.min(u0, u1) - PI / 2) / PI); k <= Math.floor((Math.max(u0, u1) - PI / 2) / PI); k++) {
        const x = X((PI / 2 + k * PI - phase(s)) / s.b);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, view.h);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // parent function, dashed
    const tanCell = u => (tan ? Math.floor((u - PI / 2) / PI) : 0);
    if (s.showParent) {
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      plot(ctx, g, view, x => parent(s.fn, x), tanCell);
      ctx.setLineDash([]);
    }

    // the curve
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    if (an.constant) {
      if (an.value !== null) plot(ctx, g, view, () => an.value, () => 0);
    } else {
      plot(ctx, g, view, x => evaluate(s, x), x => tanCell(s.b * x + phase(s)));
    }

    // where the curve meets Ox
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 2;
    for (const x of zeros(s, -xHalf, xHalf)) {
      ctx.beginPath();
      ctx.arc(X(x), Y(0), 3.5, 0, 2 * PI);
      ctx.fill();
      ctx.stroke();
    }

    if (!an.constant) tag(ctx, `y = ${fmt(s.d)}`, view.w - 6, Y(s.d) - 10, { size, align: "right", color: COLORS.orange });

    // horizontal shift: the parent's point at x = 0 now sits at x = −c/b
    const x0 = an.phaseShift;
    if (!an.constant && Math.abs(x0) < xHalf - 0.1) {
      if (Math.abs(x0) * g.scale > 16) {
        arrow(ctx, X(0), Y(s.d), X(x0), Y(s.d), COLORS.red, 2.5);
        tag(ctx, small ? pi(x0) : `−c/b = ${pi(x0)}`, X(x0 / 2), Y(s.d) + 13, { size, align: "center", color: COLORS.red });
      }
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(X(x0), Y(evaluate(s, x0)), 4.5, 0, 2 * PI);
      ctx.fill();
    }

    if (wave) {
      const T = an.period;
      const [lo, hi] = an.range;
      const into = x => x - Math.floor(x / T) * T; // first one to the right of Oy
      // amplitude, at a maximum
      let xa = into(peakX(s));
      if (xa > T / 2) xa -= T; // the maximum nearest to Oy
      if (Math.abs(xa) < xHalf - 0.3) {
        both(ctx, X(xa), Y(s.d), X(xa), Y(hi), COLORS.green);
        tag(ctx, `|a| = ${fmt(Math.abs(s.a))}`, X(xa) + 7, Y(s.d + Math.abs(s.a) / 2), { size, color: COLORS.green });
      }
      // period: between two maxima, or two minima when there is no room above
      const above = Y(hi) - 14 > (small ? 40 : 58);
      let x1 = into(peakX(s) + (above ? 0 : T / 2));
      while (x1 + T > xHalf - 0.1 && x1 - T > -xHalf + 0.1) x1 -= T;
      if (x1 + T <= xHalf - 0.1) {
        const y = above ? Y(hi) - 14 : Y(lo) + 14;
        both(ctx, X(x1), y, X(x1 + T), y, COLORS.purple);
        tag(ctx, `T = ${pi(T)}`, X(x1 + T / 2), y + (above ? -12 : 12), { size, align: "center", color: COLORS.purple });
      }
    }

    // formula and legend, on a backdrop so curves passing behind do not hide them
    ctx.font = `600 ${small ? 13 : 17}px ${FONT}`;
    ctx.fillStyle = "rgba(247, 249, 253, 0.88)";
    ctx.fillRect(0, 0, ctx.measureText(formula(s)).width + 20, s.showParent ? (small ? 38 : 54) : small ? 24 : 32);
    tag(ctx, formula(s), 10, small ? 12 : 18, { size: small ? 13 : 17, color: COLORS.blue });
    if (s.showParent) tag(ctx, `- - -  y = ${s.fn} x`, 10, small ? 29 : 42, { size, color: COLORS.muted });
    const note = an.value === null && an.constant
      ? "tan không xác định tại giá trị này"
      : an.constant
        ? `${s.a === 0 ? "a" : "b"} = 0: hàm hằng, đồ thị song song hoặc trùng với Ox`
        : tan
          ? "Nét đứt đỏ: đường tiệm cận đứng"
          : "";
    if (note) tag(ctx, note, 10, view.h - 12, { size, color: an.constant ? COLORS.red : COLORS.muted });
  },
});
