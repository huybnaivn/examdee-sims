import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, vertices, formulaArea, rectWidth, heightToBase, apex, pieces, cellCoverage, handles, SHAPE_ID } from "./model.js";

const LIMITS = { a: [1, 8], b: [1, 6], h: [0, 6], s: [-3, 8] };
const NAMES = { parallelogram: "Hình bình hành", triangle: "Tam giác", trapezoid: "Hình thang" };
const FILL = { orig: "rgba(47, 111, 237, 0.28)", copy: "rgba(240, 140, 46, 0.32)" };
const EDGE = { orig: COLORS.blue, copy: COLORS.orange };

const fixLimits = s => {
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) s[k] = clamp(Math.round(s[k]), lo, hi);
};

/** Grid window that holds the shape at every stage of the animation (so it does not jump while playing). */
function extents(s) {
  let x0 = 0, x1 = rectWidth(s), y0 = 0, y1 = s.h;
  // ponytail: rest stages only; the half turn of the copy may sweep past the grid edge for a moment
  for (const t of [0, 0.5, 1])
    for (const p of pieces(s, t)) for (const [x, y] of p.pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  return { x0: Math.floor(x0) - 1, x1: Math.ceil(x1) + 1, y0: Math.floor(y0) - 1, y1: Math.max(Math.ceil(y1), 1) + 1 };
}

function geom(s, view) {
  const small = view.w < 520 || view.h < 420;
  const top = small ? 46 : 70;
  const bottom = small ? 22 : 30;
  const win = s._win ?? extents(s);
  const k = Math.min(64, (view.w - 24) / (win.x1 - win.x0), (view.h - top - bottom) / (win.y1 - win.y0));
  const ox = (view.w - k * (win.x1 - win.x0)) / 2;
  const oy = top + (view.h - top - bottom + k * (win.y1 - win.y0)) / 2; // screen y of win.y0
  const X = x => ox + (x - win.x0) * k;
  const Y = y => oy - (y - win.y0) * k;
  return { small, win, k, X, Y, inv: p => ({ x: win.x0 + (p.x - ox) / k, y: win.y0 + (oy - p.y) / k }) };
}

/** Shrink the font so one line of text fits the stage width. */
function fit(ctx, text, size, width, bold) {
  ctx.font = `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  return Math.min(size, (size * (width - 12)) / ctx.measureText(text).width);
}

function poly(ctx, g, pts, fill, stroke, width = 2) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(g.X(x), g.Y(y)) : ctx.moveTo(g.X(x), g.Y(y))));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

function seg(ctx, g, p, q, color, width, dash) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  ctx.moveTo(g.X(p[0]), g.Y(p[1]));
  ctx.lineTo(g.X(q[0]), g.Y(q[1]));
  ctx.stroke();
  ctx.setLineDash([]);
}

const formula = s => {
  const S = fmt(formulaArea(s));
  if (s.shape === "triangle") return `S = a × h : 2 = ${s.a} × ${s.h} : 2 = ${S} cm²`;
  if (s.shape === "trapezoid") return `S = (a + b) × h : 2 = (${s.a} + ${s.b}) × ${s.h} : 2 = ${S} cm²`;
  return `S = a × h = ${s.a} × ${s.h} = ${S} cm²`;
};

const explain = s => {
  if (s.t <= 0) return "Bấm “Cắt và ghép” để biến hình thành hình chữ nhật";
  if (s.shape === "parallelogram") return "Cắt theo đường cao, ghép lại: hình chữ nhật cùng đáy a, cùng chiều cao h";
  if (s.t >= 1) return "Hình chữ nhật gồm hai hình bằng nhau ⇒ S bằng một nửa của nó";
  const what = s.shape === "triangle" ? "tam giác" : "hình thang";
  return `Thêm một ${what} bằng nó (quay nửa vòng) → hình bình hành đáy ${s.shape === "triangle" ? "a" : "a + b"}`;
};

// One result per finished change; the goal fires once each time the area reaches the target.
function report(s, api) {
  const area = formulaArea(s);
  api.emit("shape-measured", { shape: SHAPE_ID[s.shape], base: s.a, ...(s.shape === "trapezoid" && { top: s.b }), height: s.h, area }, "result");
  const hit = Math.abs(area - s.target) < 1e-9;
  if (hit && !s._hit) api.emit("target-area", { shape: SHAPE_ID[s.shape], area }, "goal");
  s._hit = hit;
}

const restart = s => {
  s.t = 0;
};

mount({
  slug: "dien-tich-da-giac",
  version: "1.0.0",
  title: "Diện tích tam giác, hình bình hành, hình thang",
  hint: "Kéo các đỉnh B, C, D trên lưới (A cố định), rồi bấm “Cắt và ghép” để xem hình được ghép thành hình chữ nhật.",
  initialState,
  timeScale: s => (s.shape === "parallelogram" ? 0.4 : 0.25), // the whole animation takes 2,5 s or 4 s
  step(s, dt, api) {
    if (s.t >= 1) s.t = 0; // ▶ after the end plays it again
    s.t = Math.min(1, s.t + dt);
    if (s.t >= 1) api.pause();
  },
  controls: [
    {
      type: "select",
      key: "shape",
      label: "Hình",
      options: Object.entries(NAMES).map(([value, label]) => ({ value, label })),
      onChange: restart,
      onCommit: report,
    },
    { type: "slider", key: "a", label: "Đáy a (cạnh AB)", min: 1, max: 8, step: 1, unit: "cm", onChange: restart, onCommit: report },
    { type: "slider", key: "b", label: "Đáy b (cạnh DC)", min: 1, max: 6, step: 1, unit: "cm", onChange: restart, onCommit: report, visible: s => s.shape === "trapezoid" },
    { type: "slider", key: "h", label: "Chiều cao h", min: 0, max: 6, step: 1, unit: "cm", onChange: restart, onCommit: report },
    { type: "slider", key: "s", label: "Độ lệch của đỉnh trên so với A", min: -3, max: 8, step: 1, unit: "cm", onChange: restart, onCommit: report },
    { type: "heading", label: "Cắt ghép" },
    {
      type: "button",
      label: "✂ Cắt và ghép",
      primary: true,
      action: (s, api) => {
        s.t = 0;
        api.play();
      },
      event: "cut-rearrange",
    },
    { type: "slider", key: "t", label: "Tiến trình", min: 0, max: 1, step: 0.01, format: v => `${Math.round(v * 100)} %` },
    { type: "checkbox", key: "showCells", label: "Đếm ô vuông đơn vị" },
    { type: "heading", label: "Thử thách" },
    { type: "stepper", key: "target", label: "Tạo hình có diện tích (cm²)", min: 1, max: 40, onChange: s => (s._hit = Math.abs(formulaArea(s) - s.target) < 1e-9) },
  ],
  readouts: [
    { label: "Đáy", value: s => (s.shape === "trapezoid" ? `a = ${s.a} cm, b = ${s.b} cm` : `a = ${s.a} cm`) },
    { label: "Chiều cao", value: s => `h = ${s.h} cm` },
    { label: "Diện tích", value: s => `${fmt(formulaArea(s))} cm²` },
    {
      label: "Đếm ô: nguyên + bị cắt",
      value: s => {
        const c = cellCoverage(vertices(s));
        return `${c.full} + ${c.partial} ô (cộng phần diện tích: ${fmt(c.sum)} cm²)`;
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.t > 0) return false; // vertices are handled on the uncut shape
      const g = geom(s, view);
      let best = null;
      let bestD = g.small ? 24 : 20;
      for (const hd of handles(s)) {
        const d = Math.hypot(p.x - g.X(hd.x), p.y - g.Y(hd.y));
        if (d < bestD) [best, bestD] = [hd.name, d];
      }
      if (!best) return false;
      s._drag = best;
      s._win = g.win; // keep the grid still under the finger
      s._from = JSON.stringify([s.a, s.b, s.h, s.s]);
    },
    move(p, s, api, view) {
      const hd = handles(s).find(h => h.name === s._drag);
      if (!hd) return;
      const w = geom(s, view).inv(p);
      hd.set(s, Math.round(w.x), Math.round(w.y));
      fixLimits(s);
    },
    up(p, s, api) {
      const name = s._drag;
      s._drag = null;
      s._win = null;
      if (!name || JSON.stringify([s.a, s.b, s.h, s.s]) === s._from) return;
      const hd = handles(s).find(h => h.name === name);
      api.emit("vertex-moved", { vertex: name, x: hd.x, y: hd.y }, "action");
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const { win, X, Y, small } = g;
    const fs = small ? 12 : 14;

    // grid of unit squares
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = win.x0; x <= win.x1; x++) {
      ctx.moveTo(X(x), Y(win.y0));
      ctx.lineTo(X(x), Y(win.y1));
    }
    for (let y = win.y0; y <= win.y1; y++) {
      ctx.moveTo(X(win.x0), Y(y));
      ctx.lineTo(X(win.x1), Y(y));
    }
    ctx.stroke();

    const V = vertices(s);
    const L = rectWidth(s);
    const rect = [[0, 0], [L, 0], [L, s.h], [0, s.h]];

    // counting squares on the uncut shape, or on the finished rectangle
    if (s.showCells && (s.t === 0 || s.t >= 1)) {
      const cov = cellCoverage(s.t >= 1 ? rect : V);
      for (const c of cov.cells) {
        const full = c.area > 1 - 1e-9;
        ctx.fillStyle = full ? "rgba(31, 157, 107, 0.22)" : "rgba(245, 197, 24, 0.3)";
        ctx.fillRect(X(c.i) + 1, Y(c.j + 1) + 1, g.k - 2, g.k - 2);
        if (full && g.k > 14) {
          ctx.fillStyle = COLORS.green;
          ctx.beginPath();
          ctx.arc(X(c.i + 0.5), Y(c.j + 0.5), Math.min(3, g.k / 8), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // where the pieces end up
    if (s.h > 0) {
      ctx.setLineDash([6, 5]);
      poly(ctx, g, rect, null, COLORS.green, 1.5);
      ctx.setLineDash([]);
    }

    for (const piece of pieces(s, s.t)) poly(ctx, g, piece.pts, FILL[piece.kind], EDGE[piece.kind], s.t > 0 ? 1.5 : 2.5);

    if (s.t === 0) {
      // base, extended when the foot of the height falls outside it
      const P = apex(s);
      const { foot, inside } = heightToBase(P, [0, 0], [s.a, 0]);
      if (!inside) seg(ctx, g, foot[0] < 0 ? foot : [s.a, 0], foot[0] < 0 ? [0, 0] : foot, COLORS.muted, 1.5, [4, 4]);
      seg(ctx, g, [0, 0], [s.a, 0], COLORS.red, 4);
      label(ctx, `a = ${s.a}`, X(s.a / 2), Y(0) + fs + 2, { align: "center", size: fs, bold: true, color: COLORS.red });
      if (s.shape === "trapezoid") label(ctx, `b = ${s.b}`, X(s.s + s.b / 2), Y(s.h) - fs, { align: "center", size: fs, bold: true, color: COLORS.red });
      // height, perpendicular to the base, with its right-angle mark
      if (s.h > 0) {
        seg(ctx, g, P, foot, COLORS.purple, 2, [6, 4]);
        const m = Math.min(10, g.k * 0.4);
        const dir = foot[0] < s.a ? 1 : -1; // the box sits on the side where the base (or its extension) is
        ctx.strokeStyle = COLORS.purple;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(dir > 0 ? X(foot[0]) : X(foot[0]) - m, Y(0) - m, m, m);
        const side = P[0] < s.a / 2 ? -1 : 1;
        label(ctx, `h = ${s.h}`, X(P[0]) + side * 6, Y(s.h / 2), { align: side < 0 ? "right" : "left", size: fs, bold: true, color: COLORS.purple });
      }
      // vertices
      const names = s.shape === "triangle" ? ["A", "B", "C"] : ["A", "B", "C", "D"];
      const drag = new Set(handles(s).map(h => h.name));
      V.forEach(([x, y], i) => {
        ctx.fillStyle = drag.has(names[i]) ? COLORS.blue : COLORS.ink;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X(x), Y(y), drag.has(names[i]) ? (small ? 7 : 8) : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const up = y > 0 || (y === 0 && s.h === 0 && i > 1);
        const dx = i === 0 || i === 3 ? -12 : 12;
        label(ctx, names[i], X(x) + dx, Y(y) + (up ? -12 : 12), { align: "center", size: fs + 1, bold: true });
      });
    } else if (s.t >= 1 && s.h > 0) {
      const text = s.shape === "parallelogram" ? `${L} × ${s.h} = ${L * s.h}` : `${L} × ${s.h} = ${L * s.h} = 2S`;
      label(ctx, text, X(L / 2), Y(s.h / 2), { align: "center", size: fs + 2, bold: true, color: COLORS.green });
      label(ctx, s.shape === "trapezoid" ? "a + b" : "a", X(L / 2), Y(0) + fs + 2, { align: "center", size: fs, bold: true, color: COLORS.green });
    }

    // headline, explanation and the challenge
    const head = formula(s);
    const note = explain(s);
    label(ctx, head, view.w / 2, small ? 14 : 22, { align: "center", size: fit(ctx, head, small ? 14 : 19, view.w, true), bold: true });
    label(ctx, note, view.w / 2, small ? 33 : 48, { align: "center", size: fit(ctx, note, small ? 11 : 13, view.w), color: COLORS.muted });
    const hit = Math.abs(formulaArea(s) - s.target) < 1e-9;
    const challenge = `Thử thách: tạo hình có S = ${s.target} cm²${hit ? "  ✓ Đạt!" : ""}`;
    label(ctx, challenge, 10, view.h - (small ? 11 : 15), { size: fs, bold: hit, color: hit ? COLORS.green : COLORS.ink });
    if (!small) label(ctx, "Mỗi ô vuông nhỏ có cạnh 1 cm", view.w - 10, view.h - 15, { align: "right", size: 12, color: COLORS.muted });
  },
});
