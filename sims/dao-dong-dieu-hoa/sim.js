import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, phase, position, velocity, acceleration, period, vMax, aMax, piFrac } from "./model.js";

const A_MAX = 8; // cm, top of the amplitude slider; the circle is drawn to this scale
const CURVES = [
  { key: "showX", name: "x", unit: "cm", color: COLORS.blue, f: position, max: s => s.amplitude },
  { key: "showV", name: "v", unit: "cm/s", color: COLORS.green, f: velocity, max: vMax },
  { key: "showA", name: "a", unit: "cm/s²", color: COLORS.red, f: acceleration, max: aMax },
];

const restart = s => {
  s.time = 0;
};

const equation = s => {
  const p = s.phaseDeg;
  const tail = p === 0 ? "" : ` ${p < 0 ? "−" : "+"} ${piFrac(Math.abs(p))}`;
  return `x = ${fmt(s.amplitude, 1)}cos(${fmt(s.omega, 1)}t${tail}) (cm)`;
};

function layout(view) {
  const small = view.w < 560 || view.h < 420;
  const side = view.w >= 560 && view.w > view.h * 1.2;
  const cw = side ? Math.min(view.w * 0.4, view.h) : view.w;
  const ch = side ? view.h : view.h * 0.5;
  return {
    small,
    circle: { x: 0, y: 0, w: cw, h: ch },
    graph: side ? { x: cw, y: 0, w: view.w - cw, h: view.h } : { x: 0, y: ch, w: view.w, h: view.h - ch },
  };
}

function dot(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawCircle(ctx, s, b, small) {
  const size = small ? 11 : 13;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2 + (small ? 8 : 0);
  const rMax = Math.max(20, Math.min(b.w / 2 - 36, b.h / 2 - (small ? 26 : 60)));
  const r = (rMax * s.amplitude) / A_MAX;
  const th = phase(s);
  const mx = cx + r * Math.cos(th);
  const my = cy - r * Math.sin(th);
  const phi = (s.phaseDeg * Math.PI) / 180;

  label(ctx, equation(s), cx, b.y + (small ? 11 : 28), { align: "center", bold: true, size: small ? 12 : 16 });

  // axes
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - rMax - 6);
  ctx.lineTo(cx, cy + rMax + 6);
  ctx.stroke();
  arrow(ctx, cx - rMax - 14, cy, cx + rMax + 22, cy, COLORS.muted, 1.5);
  label(ctx, "x", cx + rMax + 24, cy - 11, { size, color: COLORS.muted, align: "center" });

  // reference circle and the amplitude marks
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  label(ctx, "−A", cx - r - 12, cy + 13, { size: 11, color: COLORS.muted, align: "center" });
  label(ctx, "A", cx + r + 10, cy + 13, { size: 11, color: COLORS.muted, align: "center" });

  // starting point M₀ (phase φ) and the swept angle ωt + φ
  dot(ctx, cx + r * Math.cos(phi), cy - r * Math.sin(phi), 4, COLORS.bg, COLORS.muted);
  const turn = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(18, r * 0.45), 0, -turn, true);
  ctx.stroke();

  // M on the circle, its projection P on Ox
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.lineTo(mx, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  arrow(ctx, cx, cy, mx, my, COLORS.blue, 2.5);
  dot(ctx, mx, my, 5, COLORS.blue);
  dot(ctx, mx, cy, 6, COLORS.orange, "#fff");
  if (r > 78 && turn > 1 && turn < 2 * Math.PI - 1) {
    // only when the angle is wide enough for the text to sit between its two sides
    const half = turn / 2;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(cx + 52 * Math.cos(half) - 23, cy - 52 * Math.sin(half) - 8, 46, 16);
    label(ctx, "ωt + φ", cx + 52 * Math.cos(half), cy - 52 * Math.sin(half), { size: 12, color: COLORS.purple, align: "center" });
  }
  label(ctx, "M", mx + 14 * Math.cos(th), my - 14 * Math.sin(th), { size, bold: true, color: COLORS.blue, align: "center" });
  const below = my <= cy; // P is named on the side of the axis away from M
  if (!(below && Math.abs(mx - (cx - 9)) < 16)) label(ctx, "O", cx - 9, cy + 13, { size: 11, color: COLORS.muted, align: "center" });
  label(ctx, "P", mx, below ? cy + 16 : cy - 15, { size, bold: true, color: COLORS.orange, align: "center" });
}

function drawGraph(ctx, s, b, small) {
  const size = small ? 11 : 13;
  const T = period(s);
  const win = 2 * T; // one page of the time axis
  const t0 = Math.floor(s.time / win + 1e-9) * win;
  const L = b.x + (small ? 26 : 44);
  const R = b.x + b.w - (small ? 18 : 30);
  let top = b.y + (small ? 44 : 76);
  let bot = b.y + b.h - (small ? 32 : 60);
  const extra = (bot - top - 340) / 2;
  if (extra > 0) {
    top += extra;
    bot -= extra;
  }
  const mid = (top + bot) / 2;
  const half = (bot - top) / 2;
  const X = t => L + ((t - t0) / win) * (R - L);

  // grid and axes
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k <= 4; k++) {
    ctx.moveTo(X(t0 + (k * T) / 2), top);
    ctx.lineTo(X(t0 + (k * T) / 2), bot);
    label(ctx, `${fmt(t0 + (k * T) / 2)} s`, X(t0 + (k * T) / 2), bot + 11, { size: 11, color: COLORS.muted, align: "center" });
  }
  ctx.moveTo(L, top);
  ctx.lineTo(R, top);
  ctx.moveTo(L, bot);
  ctx.lineTo(R, bot);
  ctx.stroke();
  arrow(ctx, L, mid, R + 12, mid, COLORS.muted, 1.5);
  label(ctx, "1", L - 5, top, { size: 11, color: COLORS.muted, align: "right" });
  label(ctx, "0", L - 5, mid, { size: 11, color: COLORS.muted, align: "right" });
  label(ctx, "−1", L - 5, bot, { size: 11, color: COLORS.muted, align: "right" });
  label(ctx, "Mỗi đường vẽ theo thang riêng: x/A, v/vₘₐₓ, a/aₘₐₓ", (L + R) / 2, bot + (small ? 24 : 32), { size: small ? 10 : 12, color: COLORS.muted, align: "center" });

  // phase relations, marked at the first crest of x on this page
  const phi = (s.phaseDeg * Math.PI) / 180;
  const n = Math.ceil((s.omega * (t0 + T / 4) + phi) / (2 * Math.PI) - 1e-9);
  const tx = (2 * Math.PI * n - phi) / s.omega;
  if (s.showX && s.showA) {
    ctx.strokeStyle = COLORS.muted;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(X(tx), top);
    ctx.lineTo(X(tx), bot);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, "a ngược pha với x", R, top - 16, { size: small ? 10 : 12, color: COLORS.red, align: "right" });
  }
  if (s.showX && s.showV) {
    const xa = X(tx - T / 4);
    const xb = X(tx);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xa, top);
    ctx.lineTo(xa, top - 6);
    ctx.lineTo(xb, top - 6);
    ctx.lineTo(xb, top);
    ctx.stroke();
    // keep clear of the "a ngược pha" note at the right end of the same row
    const tx0 = Math.max(L + 70, Math.min((xa + xb) / 2, R - (s.showA ? (small ? 160 : 200) : 70)));
    label(ctx, "v sớm pha π/2 so với x (T/4)", tx0, top - 16, { size: small ? 10 : 12, align: "center" });
  }

  // curves: the whole page faintly, the part already travelled in full colour
  const shown = CURVES.filter(c => s[c.key]);
  const cursor = X(s.time);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cursor, top);
  ctx.lineTo(cursor, bot);
  ctx.stroke();
  shown.forEach(c => {
    const Y = t => mid - (c.f(s, t) / c.max(s)) * half;
    const trace = to => {
      ctx.beginPath();
      for (let px = L; px < to; px += 2) ctx.lineTo(px, Y(t0 + ((px - L) / (R - L)) * win));
      ctx.lineTo(to, Y(t0 + ((to - L) / (R - L)) * win));
      ctx.stroke();
    };
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.25;
    trace(R);
    ctx.globalAlpha = 1;
    trace(cursor);
    dot(ctx, cursor, Y(s.time), 4.5, c.color, "#fff");
  });
  CURVES.forEach((c, i) => {
    if (!s[c.key]) return;
    label(ctx, `${c.name} = ${fmt(c.f(s))} ${c.unit}`, L + ((R - L) * i) / 3, top - (small ? 33 : 40), { size, bold: true, color: c.color });
  });
}

mount({
  slug: "dao-dong-dieu-hoa",
  version: "1.0.0",
  title: "Dao động điều hòa",
  hint: "Bấm Chạy: điểm M chuyển động tròn đều, hình chiếu P của nó trên trục Ox dao động điều hòa.",
  initialState,
  step(s, dt, api) {
    // One result when the first full period after a (re)start completes.
    if (step(s, dt)) {
      api.emit("period-completed", { period: period(s), amplitude: s.amplitude, vmax: vMax(s), amax: aMax(s) }, "result");
    }
  },
  controls: [
    { type: "slider", key: "amplitude", label: "Biên độ A", min: 1, max: A_MAX, step: 0.5, unit: "cm", digits: 1, onChange: restart },
    { type: "slider", key: "omega", label: "Tần số góc ω", min: 0.5, max: 6, step: 0.5, unit: "rad/s", digits: 1, onChange: restart },
    { type: "slider", key: "phaseDeg", label: "Pha ban đầu φ", min: -180, max: 180, step: 15, format: v => `${piFrac(v)} rad (${fmt(v, 0)}°)`, onChange: restart },
    { type: "heading", label: "Đồ thị" },
    { type: "checkbox", key: "showX", label: "Li độ x(t)" },
    { type: "checkbox", key: "showV", label: "Vận tốc v(t)" },
    { type: "checkbox", key: "showA", label: "Gia tốc a(t)" },
  ],
  readouts: [
    { label: "Chu kỳ T = 2π/ω", value: s => `${fmt(period(s))} s` },
    { label: "Tần số f = 1/T", value: s => `${fmt(1 / period(s))} Hz` },
    { label: "Tốc độ cực đại vₘₐₓ = Aω", value: s => `${fmt(vMax(s))} cm/s` },
    { label: "Gia tốc cực đại aₘₐₓ = Aω²", value: s => `${fmt(aMax(s))} cm/s²` },
    { label: "Thời gian t", value: s => `${fmt(s.time)} s` },
    { label: "Pha ωt + φ", value: s => `${fmt(phase(s))} rad` },
    { label: "Li độ x", value: s => `${fmt(position(s))} cm` },
    { label: "Vận tốc v", value: s => `${fmt(velocity(s))} cm/s` },
    { label: "Gia tốc a = −ω²x", value: s => `${fmt(acceleration(s))} cm/s²` },
  ],
  draw(ctx, s, view) {
    const g = layout(view);
    drawCircle(ctx, s, g.circle, g.small);
    drawGraph(ctx, s, g.graph, g.small);
  },
});
