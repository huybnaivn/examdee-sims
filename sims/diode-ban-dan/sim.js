import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, DIODES, current, operatingPoint, rectified, conducting, averageOutput, source, PERIOD } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const type = s => DIODES[s.diode] ?? DIODES.si;

// ---------- events ----------
const sweepPoint = (s, api) => {
  if (s.mode !== "dc") return;
  const op = operatingPoint(s);
  s._pts = [...(s._pts ?? []).slice(-11), { u: op.u, i: op.i }];
  api.emit("sweep-point", { voltage: op.u, current: op.i * 1000, conducting: op.conducting ? 1 : 0, emf: s.emf }, "result");
};
const rectifierChanged = (s, api) => {
  if (s.mode !== "ac") return;
  api.emit("rectifier-changed", { mode: s.rectifier === "full" ? 2 : 1, outputAverage: averageOutput(s), amplitude: s.amplitude }, "result");
};
const report = (s, api) => (s.mode === "dc" ? sweepPoint(s, api) : rectifierChanged(s, api));

// ---------- drawing helpers ----------
function wire(ctx, pts, color = COLORS.ink, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

/** Diode symbol on the wire from anode (ax, ay) to cathode (bx, by), centred between them. */
function diode(ctx, ax, ay, bx, by, size, { on, color, glow = 0 }) {
  const a = Math.atan2(by - ay, bx - ax);
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  if (glow > 0) {
    const g = ctx.createRadialGradient(cx, cy, size * 0.3, cx, cy, size * (1.5 + 2 * glow));
    g.addColorStop(0, color + "cc");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, size * (1.5 + 2 * glow), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = on ? color : "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.8, -size);
  ctx.lineTo(-size * 0.8, size);
  ctx.lineTo(size * 0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(size * 0.8, -size);
  ctx.lineTo(size * 0.8, size);
  ctx.stroke();
  ctx.restore();
}

function resistor(ctx, x, y, w, h, text, size) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  if (text) label(ctx, text, x, y, { size, align: "center", bold: true });
}

/** Cell on a vertical wire at (x, y); the long thin plate is the positive pole. */
function cell(ctx, x, y, plusUp) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x - 6, y - 7, 12, 14);
  const plus = plusUp ? -6 : 6;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 15, y + plus);
  ctx.lineTo(x + 15, y + plus);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - plus);
  ctx.lineTo(x + 8, y - plus);
  ctx.stroke();
  label(ctx, "+", x + 22, y + plus - 4, { color: COLORS.red, bold: true, align: "center" });
}

function acSource(ctx, x, y, r) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const px = x - r * 0.6 + 1.2 * r * t;
    const py = y - r * 0.35 * Math.sin(2 * Math.PI * t);
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
}

const niceStep = range => {
  const raw = range / 5;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * p).find(v => v >= raw);
};

function axes(ctx, g, xr, yr, xLabel, yLabel, small) {
  const { x, y, w, h } = g;
  const X = v => x + ((v - xr[0]) / (xr[1] - xr[0])) * w;
  const Y = v => y + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  const size = small ? 10 : 12;
  const xs = niceStep(xr[1] - xr[0]);
  for (let v = Math.ceil(xr[0] / xs) * xs; v <= xr[1] + 1e-9; v += xs) {
    ctx.beginPath();
    ctx.moveTo(X(v), y);
    ctx.lineTo(X(v), y + h);
    ctx.stroke();
    label(ctx, fmt(v, 2), X(v), y + h + 9, { size, align: "center", color: COLORS.muted });
  }
  const ys = niceStep(yr[1] - yr[0]);
  for (let v = Math.ceil(yr[0] / ys) * ys; v <= yr[1] + 1e-9; v += ys) {
    ctx.beginPath();
    ctx.moveTo(x, Y(v));
    ctx.lineTo(x + w, Y(v));
    ctx.stroke();
    label(ctx, fmt(v, 2), x - 4, Y(v), { size, align: "right", color: COLORS.muted });
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (xr[0] <= 0 && xr[1] >= 0) {
    ctx.moveTo(X(0), y);
    ctx.lineTo(X(0), y + h);
  }
  ctx.moveTo(x, Y(0));
  ctx.lineTo(x + w, Y(0));
  ctx.stroke();
  label(ctx, xLabel, x + w, y + h + (small ? 20 : 24), { size, align: "right", bold: true });
  label(ctx, yLabel, x + 4, y + 9, { size, bold: true });
  return { X, Y };
}

function plot(ctx, X, Y, f, x0, x1, ymax, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  let started = false;
  for (let k = 0; k <= 300; k++) {
    const v = x0 + ((x1 - x0) * k) / 300;
    const f0 = f(v);
    if (f0 > ymax) break;
    started ? ctx.lineTo(X(v), Y(f0)) : ctx.moveTo(X(v), Y(f0));
    started = true;
  }
  ctx.stroke();
  ctx.restore();
}

// ---------- layout ----------
function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 10 : 24;
  const top = small ? 8 : 40;
  const split = Math.round(view.h * (small ? 0.46 : 0.48));
  const circuit = { x0: pad + (small ? 72 : 110), x1: view.w - pad - (small ? 108 : 170), y0: top + 14, y1: split - (small ? 16 : 22) };
  const gx = small ? 40 : 64;
  const graph = { x: gx, y: split + (small ? 6 : 16), w: view.w - gx - pad, h: view.h - split - (small ? 40 : 60) };
  return { small, circuit, graph, size: small ? 12 : 14 };
}

// ---------- DC mode ----------
function drawDC(ctx, s, view, g) {
  const d = type(s);
  const op = operatingPoint(s);
  const { x0, x1, y0, y1 } = g.circuit;
  const ym = (y0 + y1) / 2;
  const xm = (x0 + x1) / 2;
  const size = g.size;
  wire(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
  cell(ctx, x0, ym, s.emf >= 0);
  label(ctx, `E = ${fmt(s.emf)} V`, x0 - (g.small ? 18 : 24), ym, { size, bold: true, align: "right" });
  resistor(ctx, xm, y0, g.small ? 42 : 60, g.small ? 16 : 20, "", size);
  label(ctx, `R = ${fmt(s.resistance, 0)} Ω`, xm, y0 - (g.small ? 15 : 20), { size, align: "center" });
  const ds = g.small ? 9 : 15;
  const glow = d.n === 2 && op.conducting ? Math.min(1, Math.log10(op.i / 1e-3 + 1) / 1.6) : 0;
  diode(ctx, x1, ym - ds * 2, x1, ym + ds * 2, ds, { on: op.conducting, color: d.n === 2 ? d.color : COLORS.green, glow });
  label(ctx, `U_D = ${fmt(op.u)} V`, x1 + ds + 8, ym - (g.small ? 8 : 10), { size, bold: true });
  const state = op.conducting ? "dẫn điện" : s.emf <= 0 ? (g.small ? "không dẫn" : "phân cực ngược") : "chưa dẫn";
  label(ctx, state, x1 + ds + 8, ym + (g.small ? 8 : 12), { size, color: op.conducting ? COLORS.green : COLORS.red, bold: true });
  // conventional current, clockwise when forward biased
  if (op.conducting) {
    arrow(ctx, xm + 40, y1, xm - 10, y1, COLORS.red, 2);
    label(ctx, `I = ${fmt(op.i * 1000, 1)} mA`, xm + 46, y1 + (g.small ? 10 : 12), { size, color: COLORS.red, bold: true });
  } else {
    label(ctx, "I ≈ 0", xm, y1 + (g.small ? 10 : 12), { size, color: COLORS.red, bold: true, align: "center" });
  }
  if (!g.small) label(ctx, `${d.name} · mũi tên đỏ: chiều dòng điện quy ước`, view.w / 2, 18, { size: 13, align: "center", color: COLORS.muted });

  // I–U characteristic
  const umin = -2;
  const umax = Math.max(1, d.uth + 0.6);
  const imax = Math.max(20, Math.ceil((op.i * 1000 * 1.25) / 10) * 10);
  const { X, Y } = axes(ctx, g.graph, [umin, umax], [-0.08 * imax, imax], "U (V)", "I (mA)", g.small);
  const mA = u => current(d, u) * 1000;
  // threshold
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = COLORS.orange;
  ctx.beginPath();
  ctx.moveTo(X(d.uth), g.graph.y);
  ctx.lineTo(X(d.uth), g.graph.y + g.graph.h);
  ctx.stroke();
  // load line I = (E − U)/R
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  const ll = u => ((s.emf - u) / s.resistance) * 1000;
  const ua = Math.max(umin, s.emf - (imax * s.resistance) / 1000);
  const ub = Math.min(umax, s.emf + (0.08 * imax * s.resistance) / 1000);
  if (ub > ua) {
    ctx.moveTo(X(ua), Y(ll(ua)));
    ctx.lineTo(X(ub), Y(ll(ub)));
  }
  ctx.stroke();
  ctx.restore();
  label(ctx, "U_ng", X(d.uth) + 4, g.graph.y + 10, { size: g.small ? 10 : 12, color: COLORS.orange, bold: true });
  plot(ctx, X, Y, mA, umin, umax, imax, d.n === 2 ? d.color : COLORS.blue, 2.5);
  ctx.fillStyle = COLORS.muted;
  for (const p of s._pts ?? []) {
    if (p.u < umin || p.u > umax) continue;
    ctx.beginPath();
    ctx.arc(X(p.u), Y(p.i * 1000), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const px = X(Math.max(umin, op.u));
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.arc(px, Y(op.i * 1000), 6, 0, Math.PI * 2);
  ctx.fill();
  if (op.u < umin) label(ctx, `← U_D = ${fmt(op.u, 1)} V`, px + 10, Y(0) - 12, { size: g.small ? 10 : 12, color: COLORS.red });
  if (!g.small) label(ctx, "đường xám: I = (E − U)/R", g.graph.x + 6, g.graph.y + 28, { size: 12, color: COLORS.muted });
}

// ---------- AC mode ----------
function drawAC(ctx, s, view, g) {
  const d = type(s);
  const u = source(s, s.phase);
  const on = conducting(s, u);
  const out = rectified(s, u);
  const { x0, x1, y0, y1 } = g.circuit;
  const size = g.size;
  const r = g.small ? 12 : 16;
  const ds = g.small ? 7 : 12;
  const look = k => ({ on: on[k], color: d.n === 2 ? d.color : COLORS.green, glow: d.n === 2 && on[k] ? 0.6 : 0 });
  const ym = (y0 + y1) / 2;
  let loadTop;
  let loadBottom;
  if (s.rectifier === "full") {
    const cx = (x0 + x1) / 2 - (g.small ? 6 : 10);
    const dd = Math.min((y1 - y0) / 2 - 4, (x1 - x0) / 3);
    const T = [cx, ym - dd];
    const B = [cx, ym + dd];
    const Lf = [cx - dd, ym];
    const Rt = [cx + dd, ym];
    const low = B[1] + (g.small ? 10 : 18);
    wire(ctx, [[x0, ym], [x0, T[1]], T, Lf, B, [x0, B[1]], [x0, ym]]);
    wire(ctx, [T, Rt, B]);
    wire(ctx, [Rt, [x1, ym], [x1, low], [Lf[0], low], [Lf[0], B[1] + 5]]);
    // the output wire hops over the source wire (no junction)
    ctx.beginPath();
    ctx.arc(Lf[0], B[1], 5, Math.PI / 2, -Math.PI / 2, true);
    ctx.stroke();
    wire(ctx, [[Lf[0], B[1] - 5], Lf]);
    for (const p of [T, B, Lf, Rt]) {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const parts = [[T, Rt], [B, Rt], [Lf, T], [Lf, B]];
    parts.forEach(([a, b], k) => {
      const ex = (b[0] - a[0]) / 4;
      const ey = (b[1] - a[1]) / 4;
      diode(ctx, a[0] + ex, a[1] + ey, b[0] - ex, b[1] - ey, ds, look(k));
      if (!g.small || (y1 - y0) > 110) {
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const ox = mx < cx ? -1 : 1;
        const oy = my < ym ? -1 : 1;
        label(ctx, `D${"₁₂₃₄"[k]}`, mx + ox * (ds + 6), my + oy * (ds + 4), { size: size - 2, align: "center", color: on[k] ? COLORS.green : COLORS.muted, bold: on[k] });
      }
    });
    loadTop = [x1, ym];
    loadBottom = [x1, low];
  } else {
    wire(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
    diode(ctx, (x0 + x1) / 2 - ds * 2, y0, (x0 + x1) / 2 + ds * 2, y0, ds, look(0));
    label(ctx, on[0] ? "D dẫn" : "D chặn", (x0 + x1) / 2, y0 + ds + 12, { size, align: "center", bold: true, color: on[0] ? COLORS.green : COLORS.red });
    loadTop = [x1, y0];
    loadBottom = [x1, y1];
  }
  acSource(ctx, x0, ym, r);
  label(ctx, "+", x0 - r - 8, ym + (u >= 0 ? -r : r), { size, bold: true, align: "center", color: COLORS.red });
  label(ctx, `u = ${fmt(u, 1)} V`, g.small ? 4 : x0 - r - 6, ym + r + (g.small ? 10 : 14), { size, align: g.small ? "left" : "right", bold: true });
  const lm = (loadTop[1] + loadBottom[1]) / 2;
  resistor(ctx, x1, lm, g.small ? 14 : 18, Math.min(g.small ? 34 : 48, (loadBottom[1] - loadTop[1]) * 0.6), "", size);
  label(ctx, "R_t", x1 + 14, lm - (g.small ? 9 : 12), { size, bold: true });
  label(ctx, `u_ra = ${fmt(out, 1)} V`, x1 + 14, lm + (g.small ? 9 : 12), { size, bold: true, color: COLORS.red });
  if (!g.small) {
    const title = s.rectifier === "full" ? "Chỉnh lưu cả chu kỳ (cầu bốn điốt)" : "Chỉnh lưu nửa chu kỳ (một điốt)";
    label(ctx, `${title} · ${d.name}`, view.w / 2, 18, { size: 13, align: "center", color: COLORS.muted });
  }

  // u(t) and u_ra(t) over one period
  const A = s.amplitude;
  const { X, Y } = axes(ctx, g.graph, [0, 1], [-A * 1.1, A * 1.1], g.small ? "t/T" : "t/T (chậm lại: 1 chu kỳ = 2 s)", "u (V)", g.small);
  plot(ctx, X, Y, x => source(s, x), 0, 1, Infinity, COLORS.blue, 1.5);
  plot(ctx, X, Y, x => rectified(s, source(s, x)), 0, 1, Infinity, COLORS.red, 3);
  const avg = averageOutput(s);
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(avg));
  ctx.lineTo(X(1), Y(avg));
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(X(s.phase), g.graph.y);
  ctx.lineTo(X(s.phase), g.graph.y + g.graph.h);
  ctx.stroke();
  ctx.restore();
  const ls = g.small ? 10 : 12;
  label(ctx, `U_tb = ${fmt(avg)} V`, X(1) - 4, Y(avg) - 9, { size: ls, align: "right", color: COLORS.green, bold: true });
  label(ctx, "u (nguồn)", X(0.27) + 6, Y(A) + 4, { size: ls, color: COLORS.blue });
  label(ctx, "u_ra", X(0.75), Y(-A * 0.55), { size: ls, color: COLORS.red, bold: true, align: "center" });
}

mount({
  slug: "diode-ban-dan",
  version: "1.0.0",
  title: "Điốt bán dẫn và chỉnh lưu",
  hint: "Đổi nguồn E để dò đặc tuyến vôn – ampe của điốt; chuyển sang nguồn xoay chiều để xem chỉnh lưu.",
  initialState,
  step,
  autoplay: true,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Nguồn điện",
      options: [
        { value: "dc", label: "Một chiều (đặc tuyến I–U)" },
        { value: "ac", label: "Xoay chiều (chỉnh lưu)" },
      ],
    },
    { type: "select", key: "diode", label: "Loại điốt", options: Object.entries(DIODES).map(([value, d]) => ({ value, label: `${d.name} (U_ng ≈ ${fmt(d.uth, 1)} V)` })), onChange: s => (s._pts = []) },
    { type: "slider", key: "emf", label: "Suất điện động E", min: -10, max: 10, step: 0.05, unit: "V", visible: s => s.mode === "dc" },
    { type: "slider", key: "resistance", label: "Điện trở R", min: 20, max: 1000, step: 10, unit: "Ω", digits: 0, visible: s => s.mode === "dc" },
    {
      type: "select",
      key: "rectifier",
      label: "Mạch chỉnh lưu",
      visible: s => s.mode === "ac",
      options: [
        { value: "half", label: "Nửa chu kỳ (một điốt)" },
        { value: "full", label: "Cả chu kỳ (cầu bốn điốt)" },
      ],
    },
    { type: "slider", key: "amplitude", label: "Biên độ U₀ của nguồn", min: 1, max: 20, step: 0.5, unit: "V", digits: 1, visible: s => s.mode === "ac" },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "Điện áp ngưỡng U_ng", value: s => `${fmt(type(s).uth, 1)} V` },
    {
      label: "Kết quả",
      value: s => {
        if (s.mode === "ac") return `U_tb = ${fmt(averageOutput(s))} V`;
        const op = operatingPoint(s);
        return `U_D = ${fmt(op.u)} V; I = ${op.i * 1000 < 0.01 ? "≈ 0" : fmt(op.i * 1000, 2)} mA`;
      },
    },
    {
      label: "Trạng thái",
      value: s => {
        if (s.mode === "dc") return operatingPoint(s).conducting ? "điốt dẫn điện" : "điốt không dẫn";
        const on = conducting(s, source(s, s.phase));
        if (s.rectifier !== "full") return on[0] ? "D dẫn" : "D chặn";
        const names = on.map((v, k) => (v ? `D${"₁₂₃₄"[k]}` : "")).filter(Boolean);
        return names.length ? `${names.join(", ")} dẫn` : "cả bốn điốt chặn";
      },
    },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    ctx.font = `12px ${FONT}`;
    if (s.mode === "ac") drawAC(ctx, s, view, g);
    else drawDC(ctx, s, view, g);
    if (s.mode === "ac") {
      const note = g.small ? "Mô hình: điốt dẫn có U = U_ng" : `Mô hình đơn giản: điốt dẫn có hiệu điện thế không đổi U_ng; điốt chặn không cho dòng đi qua. Chu kỳ ${fmt(PERIOD)} s là đã làm chậm.`;
      label(ctx, note, 8, view.h - 8, { size: g.small ? 10 : 12, color: COLORS.muted });
    } else if (!g.small) {
      label(ctx, "Phương trình Shockley I = I_s(e^(U/nU_T) − 1); U_ng là hiệu điện thế ứng với I = 10 mA. Chưa xét hiện tượng đánh thủng.", 8, view.h - 8, { size: 12, color: COLORS.muted });
    }
  },
});
