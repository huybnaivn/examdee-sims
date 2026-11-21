import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, x1, x2, x, resultant, classify, deltaDeg, piFrac, OMEGA, PERIOD } from "./model.js";

const rad = deg => (deg * Math.PI) / 180;
const CASES = {
  "cung-pha": "Hai dao động cùng pha: A = A₁ + A₂",
  "nguoc-pha": "Hai dao động ngược pha: A = |A₁ − A₂|",
  "vuong-pha": "Hai dao động vuông pha: A = √(A₁² + A₂²)",
};
const CASE_NAMES = { "cung-pha": "Cùng pha", "nguoc-pha": "Ngược pha", "vuong-pha": "Vuông pha", "": "Lệch pha bất kì" };
const phaseText = r => (r.amplitude ? `${fmt(r.phase)} rad (${fmt((r.phase * 180) / Math.PI, 1)}°)` : "không xác định");

// Report a special case once the learner has committed to it (slider released), not while a slider
// sweeps past it. The case the sim opens on is not a find.
const INITIAL_CASE = classify(initialState());
const watch = (s, api) => {
  const found = classify(s);
  if (found && found !== (s._case ?? INITIAL_CASE)) {
    api.emit("special-case", { case: found, amplitude: resultant(s).amplitude, a1: s.a1, a2: s.a2 }, "goal");
  }
  s._case = found;
};

function layout(view) {
  const small = view.w < 560 || view.h < 420;
  const side = view.w >= 560 && view.w > view.h * 1.2;
  const top = small ? 34 : 70;
  const h = view.h - top;
  const dw = side ? Math.min(view.w * 0.42, h) : view.w;
  const dh = side ? h : h * 0.5;
  return {
    small,
    top,
    diagram: { x: 0, y: top, w: dw, h: dh },
    graph: side ? { x: dw, y: top, w: view.w - dw, h } : { x: 0, y: top + dh, w: view.w, h: h - dh },
  };
}

function dot(ctx, px, py, r, fill) {
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawDiagram(ctx, s, b, small) {
  const size = small ? 12 : 14;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rMax = Math.max(20, Math.min(b.w / 2 - 34, b.h / 2 - (small ? 12 : 34)));
  const scale = rMax / (s.a1 + s.a2); // px per cm; rescaled so the longest possible sum just fits
  const r = resultant(s);
  const tip = (a, ang) => [cx + a * scale * Math.cos(ang), cy - a * scale * Math.sin(ang)];
  const ang1 = OMEGA * s.time + rad(s.phi1Deg);
  const ang2 = OMEGA * s.time + rad(s.phi2Deg);
  const p1 = tip(s.a1, ang1);
  const p2 = tip(s.a2, ang2);
  const p = [p1[0] + p2[0] - cx, p1[1] + p2[1] - cy];

  // axes
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - rMax - 4);
  ctx.lineTo(cx, cy + rMax + 4);
  ctx.stroke();
  arrow(ctx, cx - rMax - 12, cy, cx + rMax + 22, cy, COLORS.muted, 1.5);
  label(ctx, "x", cx + rMax + 24, cy - 11, { size: 12, color: COLORS.muted, align: "center" });
  label(ctx, "O", cx - 9, cy + 12, { size: 11, color: COLORS.muted, align: "center" });

  // parallelogram and the projection of the resultant on Ox
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(...p1);
  ctx.lineTo(...p);
  ctx.lineTo(...p2);
  ctx.stroke();
  ctx.strokeStyle = COLORS.red;
  ctx.beginPath();
  ctx.moveTo(...p);
  ctx.lineTo(p[0], cy);
  ctx.stroke();
  ctx.setLineDash([]);

  arrow(ctx, cx, cy, ...p1, COLORS.blue, 2.5);
  arrow(ctx, cx, cy, ...p2, COLORS.green, 2.5);
  arrow(ctx, cx, cy, ...p, COLORS.red, 3);
  dot(ctx, p[0], cy, 4.5, COLORS.red);
  // A₁ and A₂ are named beside their arrows, each on the side away from the other; A at its tip
  const turn = (p1[0] - cx) * (p2[1] - cy) - (p1[1] - cy) * (p2[0] - cx) >= 0 ? 1 : -1;
  const beside = (text, pt, side, color) => {
    const dx = pt[0] - cx;
    const dy = pt[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    label(ctx, text, cx + 0.6 * dx + (side * 13 * dy) / len, cy + 0.6 * dy - (side * 13 * dx) / len, { size, bold: true, color, align: "center" });
  };
  beside("A₁", p1, turn, COLORS.blue);
  beside("A₂", p2, -turn, COLORS.green);
  if (r.amplitude) {
    const ang = OMEGA * s.time + r.phase;
    label(ctx, "A", p[0] + 14 * Math.cos(ang), p[1] - 14 * Math.sin(ang), { size, bold: true, color: COLORS.red, align: "center" });
  }

  // scale bar
  const unit = [1, 2, 5, 10].find(u => u * scale >= 22) ?? 10;
  const bx = b.x + 12;
  const by = b.y + b.h - (small ? 8 : 20);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by - 4);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + unit * scale, by);
  ctx.lineTo(bx + unit * scale, by - 4);
  ctx.stroke();
  label(ctx, `${unit} cm`, bx + unit * scale + 6, by - 2, { size: 11, color: COLORS.muted });
}

function drawGraph(ctx, s, b, small) {
  const size = small ? 11 : 13;
  const win = 2 * PERIOD; // one page of the time axis
  const t0 = Math.floor(s.time / win + 1e-9) * win;
  const L = b.x + (small ? 28 : 46);
  const R = b.x + b.w - (small ? 18 : 30);
  let top = b.y + (small ? 22 : 50);
  let bot = b.y + b.h - (small ? 32 : 60);
  const extra = (bot - top - 340) / 2;
  if (extra > 0) {
    top += extra;
    bot -= extra;
  }
  const mid = (top + bot) / 2;
  const half = (bot - top) / 2;
  const full = s.a1 + s.a2; // cm at the top grid line
  const r = resultant(s);
  const X = t => L + ((t - t0) / win) * (R - L);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k <= 4; k++) {
    const t = t0 + (k * PERIOD) / 2;
    ctx.moveTo(X(t), top);
    ctx.lineTo(X(t), bot);
    label(ctx, `${fmt(t)} s`, X(t), bot + 11, { size: 11, color: COLORS.muted, align: "center" });
  }
  ctx.moveTo(L, top);
  ctx.lineTo(R, top);
  ctx.moveTo(L, bot);
  ctx.lineTo(R, bot);
  ctx.stroke();
  arrow(ctx, L, mid, R + 12, mid, COLORS.muted, 1.5);
  label(ctx, fmt(full, 1), L - 5, top, { size: 11, color: COLORS.muted, align: "right" });
  label(ctx, "0", L - 5, mid, { size: 11, color: COLORS.muted, align: "right" });
  label(ctx, fmt(-full, 1), L - 5, bot, { size: 11, color: COLORS.muted, align: "right" });
  label(ctx, "Li độ (cm) theo thời gian; cả hai dao động có ω = π rad/s (T = 2 s)", (L + R) / 2, bot + (small ? 24 : 32), { size: small ? 10 : 12, color: COLORS.muted, align: "center" });

  // ±A of the resultant
  ctx.strokeStyle = COLORS.red;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (const sign of [1, -1]) {
    ctx.moveTo(L, mid - (sign * r.amplitude * half) / full);
    ctx.lineTo(R, mid - (sign * r.amplitude * half) / full);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const cursor = X(s.time);
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(cursor, top);
  ctx.lineTo(cursor, bot);
  ctx.stroke();

  const curves = [
    { name: "x₁", f: x1, color: COLORS.blue, width: 2, on: s.showParts },
    { name: "x₂", f: x2, color: COLORS.green, width: 2, on: s.showParts },
    { name: "x", f: x, color: COLORS.red, width: 3, on: true },
  ];
  curves.forEach((c, i) => {
    if (!c.on) return;
    const Y = t => mid - (c.f(s, t) / full) * half;
    const trace = to => {
      ctx.beginPath();
      for (let px = L; px < to; px += 2) ctx.lineTo(px, Y(t0 + ((px - L) / (R - L)) * win));
      ctx.lineTo(to, Y(t0 + ((to - L) / (R - L)) * win));
      ctx.stroke();
    };
    ctx.strokeStyle = c.color;
    ctx.lineWidth = c.width;
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.25;
    trace(R);
    ctx.globalAlpha = 1;
    trace(cursor);
    dot(ctx, cursor, Y(s.time), 4.5, c.color);
    label(ctx, `${c.name} = ${fmt(c.f(s))} cm`, L + ((R - L) * i) / 3, top - (small ? 11 : 20), { size, bold: true, color: c.color });
  });
}

mount({
  slug: "tong-hop-dao-dong",
  version: "1.0.0",
  title: "Tổng hợp hai dao động điều hòa",
  hint: "Chỉnh biên độ và pha ban đầu của hai dao động cùng phương, cùng tần số. Vectơ tổng A = A₁ + A₂ biểu diễn dao động tổng hợp.",
  initialState,
  step,
  controls: [
    { type: "heading", label: "Dao động thứ nhất" },
    { type: "slider", key: "a1", label: "Biên độ A₁", min: 1, max: 6, step: 0.5, unit: "cm", digits: 1, onCommit: watch },
    { type: "slider", key: "phi1Deg", label: "Pha ban đầu φ₁", min: -180, max: 180, step: 15, format: v => `${piFrac(v)} rad (${fmt(v, 0)}°)`, onCommit: watch },
    { type: "heading", label: "Dao động thứ hai" },
    { type: "slider", key: "a2", label: "Biên độ A₂", min: 1, max: 6, step: 0.5, unit: "cm", digits: 1, onCommit: watch },
    { type: "slider", key: "phi2Deg", label: "Pha ban đầu φ₂", min: -180, max: 180, step: 15, format: v => `${piFrac(v)} rad (${fmt(v, 0)}°)`, onCommit: watch },
    { type: "checkbox", key: "showParts", label: "Hiện x₁ và x₂ trên đồ thị" },
  ],
  readouts: [
    { label: "Độ lệch pha Δφ = φ₂ − φ₁", value: s => `${piFrac(deltaDeg(s))} rad` },
    { label: "Trường hợp", value: s => CASE_NAMES[classify(s)] },
    { label: "Biên độ tổng hợp A", value: s => `${fmt(resultant(s).amplitude)} cm` },
    { label: "Pha ban đầu tổng hợp φ", value: s => phaseText(resultant(s)) },
    { label: "Thời gian t", value: s => `${fmt(s.time)} s` },
    { label: "Li độ x = x₁ + x₂", value: s => `${fmt(x1(s))} + ${fmt(x2(s)).replace(/^−(.*)$/, "(−$1)")} = ${fmt(x(s))} cm` },
  ],
  draw(ctx, s, view) {
    const g = layout(view);
    const r = resultant(s);
    const found = classify(s);
    label(ctx, CASES[found] ?? `Độ lệch pha Δφ = φ₂ − φ₁ = ${piFrac(deltaDeg(s))} rad`, view.w / 2, g.small ? 10 : 22, {
      align: "center",
      bold: true,
      size: g.small ? 13 : 17,
      color: found ? COLORS.purple : COLORS.ink,
    });
    label(ctx, `A = ${fmt(r.amplitude)} cm   ·   φ = ${phaseText(r)}`, view.w / 2, g.small ? 26 : 48, { align: "center", size: g.small ? 12 : 15, color: COLORS.red, bold: true });
    drawDiagram(ctx, s, g.diagram, g.small);
    drawGraph(ctx, s, g.graph, g.small);
  },
});
