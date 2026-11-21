import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, step, start, unsettle, skipTransient, addPoint, force, sanitizePoints,
  naturalFrequency, steadyAmplitude, resonanceFrequency, envelope, settleTime,
} from "./model.js";

const WINDOW = 8; // s of x(t) kept on the graph
const cm = m => fmt(m * 100, 1);

// Spring on top; x(t) and the resonance curve side by side on a wide stage, stacked on a narrow one.
function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 6 : 14;
  const top = { x: pad, y: pad, w: view.w - 2 * pad, h: small ? 78 : 104 };
  const y = top.y + top.h + pad;
  const h = view.h - y - pad;
  const wide = view.w >= 760;
  const half = wide ? (view.w - 3 * pad) / 2 : view.w - 2 * pad;
  const gh = wide ? h : (h - pad) / 2;
  return {
    small,
    top,
    xt: { x: pad, y, w: half, h: gh },
    res: wide ? { x: 2 * pad + half, y, w: half, h: gh } : { x: pad, y: y + gh + pad, w: half, h: gh },
  };
}

// Plot frame with axes; returns world -> screen maps for the inner area.
function axes(ctx, box, { x0, x1, y0, y1, xl, yl, small, zero = false }) {
  const m = { l: small ? 30 : 44, r: 10, t: small ? 16 : 22, b: small ? 18 : 28 };
  ctx.fillStyle = "#fff";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  const L = box.x + m.l, R = box.x + box.w - m.r, T = box.y + m.t, B = box.y + box.h - m.b;
  const X = v => L + ((v - x0) / (x1 - x0)) * (R - L);
  const Y = v => B - ((v - y0) / (y1 - y0)) * (B - T);
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  const yAxis = zero ? Y(0) : B;
  ctx.moveTo(L, T);
  ctx.lineTo(L, B);
  ctx.moveTo(L, yAxis);
  ctx.lineTo(R, yAxis);
  ctx.stroke();
  const size = small ? 10 : 12;
  label(ctx, yl, L + 4, box.y + m.t / 2 + 1, { size, color: COLORS.muted });
  label(ctx, xl, R, B + m.b / 2 + 1, { size, color: COLORS.muted, align: "right" });
  label(ctx, fmt(y1, 1), L - 3, T, { size, color: COLORS.muted, align: "right" });
  label(ctx, fmt(y0, 1), L - 3, B, { size, color: COLORS.muted, align: "right" });
  return { X, Y, L, R, T, B, size };
}

function line(ctx, pts, X, Y, color, width = 2, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([a, b], i) => (i ? ctx.lineTo(X(a), Y(b)) : ctx.moveTo(X(a), Y(b))));
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSpring(ctx, s, box, ref, small) {
  const cy = box.y + box.h * (small ? 0.55 : 0.62);
  const wallX = box.x + 14;
  const center = box.x + box.w * 0.55;
  const k = (box.w * 0.22) / ref; // px per metre, the largest recent |x| fills 22 % of the box
  const bw = small ? 28 : 40;
  const mx = center + s.x * k;
  // floor and wall
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(box.x, cy + bw / 2, box.w, 4);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(wallX - 6, cy - bw / 2 - 8, 6, bw + 12);
  // equilibrium O
  ctx.strokeStyle = COLORS.muted;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(center, cy - bw / 2 - 6);
  ctx.lineTo(center, cy + bw / 2 + 4);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, "O", center, cy + bw / 2 + 12, { size: small ? 10 : 12, color: COLORS.muted, align: "center" });
  // spring
  const x1 = mx - bw / 2;
  const n = 14;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wallX, cy);
  for (let i = 0; i <= n; i++) {
    const px = wallX + 8 + ((x1 - wallX - 16) * i) / n;
    ctx.lineTo(px, cy + (i === 0 || i === n ? 0 : i % 2 ? -9 : 9));
  }
  ctx.lineTo(x1, cy);
  ctx.stroke();
  // mass
  ctx.fillStyle = COLORS.blue;
  ctx.fillRect(x1, cy - bw / 2, bw, bw);
  label(ctx, "m", mx, cy, { color: "#fff", bold: true, align: "center", size: small ? 12 : 15 });
  // the external force on the mass
  const F = force(s);
  const Fmax = s.mode === "driven" ? s.force : s.damping * naturalFrequency(s) * (s.amp0 / 100);
  if (s.mode !== "free" && Fmax > 0) {
    const len = (F / Fmax) * (small ? 26 : 40);
    const ay = cy - bw / 2 - (small ? 7 : 10);
    arrow(ctx, mx, ay, mx + len, ay, COLORS.red, 2.5);
    if (!small || box.w > 300) label(ctx, "F", mx + len + (len >= 0 ? 6 : -12), ay, { color: COLORS.red, bold: true, size: 13 });
  }
  const title = { free: "Dao động tắt dần", maintained: "Dao động duy trì", driven: "Dao động cưỡng bức" }[s.mode];
  const sub = {
    free: "chỉ có lực đàn hồi và lực cản",
    maintained: "nguồn năng lượng bù đúng phần mất do lực cản",
    driven: "ngoại lực F = F₀cos(Ωt)",
  }[s.mode];
  const size = small ? 12 : 15;
  label(ctx, title, box.x + 2, box.y + 8, { bold: true, size });
  ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const subX = box.x + 14 + ctx.measureText(title).width;
  const wide = box.w > 640;
  if (wide || box.w > 420) label(ctx, sub, subX, box.y + 8, { size: small ? 11 : 13, color: COLORS.muted });
  if (wide) label(ctx, "Vị trí vật phóng to, không theo tỉ lệ", box.x + box.w, box.y + 8, { size: 11, color: COLORS.muted, align: "right" });
  else label(ctx, "Hình phóng to, không theo tỉ lệ", box.x + 2, cy + bw / 2 + 13, { size: small ? 10 : 11, color: COLORS.muted });
}

function drawXt(ctx, s, box, ref, small) {
  const hist = s._hist ?? [];
  const t1 = Math.max(WINDOW, s.time);
  const t0 = t1 - WINDOW;
  const yr = ref * 100 * 1.15;
  const g = axes(ctx, box, { x0: t0, x1: t1, y0: -yr, y1: yr, xl: "t (s)", yl: "x (cm)", small, zero: true });
  if (s.mode === "free") {
    const env = [];
    for (let i = 0; i <= 60; i++) env.push([t0 + (WINDOW * i) / 60, envelope(s, t0 + (WINDOW * i) / 60) * 100]);
    line(ctx, env, g.X, g.Y, COLORS.orange, 1.5, [5, 4]);
    line(ctx, env.map(([t, a]) => [t, -a]), g.X, g.Y, COLORS.orange, 1.5, [5, 4]);
    if (!small) label(ctx, "A₀·e^(−bt/2m)", g.R - 4, g.T + 8, { size: 12, color: COLORS.orange, align: "right" });
  }
  if (s.mode === "driven" && s.amplitude) {
    for (const a of [s.amplitude, -s.amplitude]) line(ctx, [[t0, a * 100], [t1, a * 100]], g.X, g.Y, COLORS.green, 1, [3, 4]);
  }
  line(ctx, hist.filter(([t]) => t >= t0).map(([t, x]) => [t, x * 100]), g.X, g.Y, COLORS.blue, 2);
  if (s.mode === "driven") {
    const text = s.amplitude
      ? `Ổn định: A = ${cm(s.amplitude)} cm`
      : `Đang chuyển tiếp… (còn ≈ ${fmt(Math.max(0, settleTime(s) - s.settle), 0)} s)`;
    label(ctx, text, g.R - 2, box.y + (small ? 8 : 11), { size: small ? 10 : 12, align: "right", bold: true, color: s.amplitude ? COLORS.green : COLORS.muted });
  }
}

function drawResonance(ctx, s, box, small) {
  const w0 = naturalFrequency(s);
  const top = resonanceFrequency(s);
  const pts = s.points;
  const x1 = Math.min(25, Math.max(2 * w0, s.drive * 1.15, ...pts.map(p => p.w * 1.1)));
  const peak = steadyAmplitude(s, top);
  const y1 = Math.max(0.01, ...pts.map(p => p.A), s.showTheory ? peak : 0) * 100 * 1.15;
  const g = axes(ctx, box, { x0: 0, x1, y0: 0, y1, xl: "Ω (rad/s)", yl: "A (cm)", small });
  // ω₀ and the current drive
  line(ctx, [[w0, 0], [w0, y1]], g.X, g.Y, COLORS.muted, 1, [4, 4]);
  label(ctx, "ω₀", g.X(w0) + 3, g.T + 6, { size: g.size, color: COLORS.muted });
  if (s.mode === "driven") line(ctx, [[s.drive, 0], [s.drive, y1]], g.X, g.Y, COLORS.orange, 1.5);
  if (s.showTheory) {
    const curve = [];
    for (let i = 1; i <= 200; i++) curve.push([(x1 * i) / 200, steadyAmplitude(s, (x1 * i) / 200) * 100]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.L, g.T, g.R - g.L, g.B - g.T);
    ctx.clip();
    line(ctx, curve, g.X, g.Y, COLORS.purple, 1.5);
    ctx.restore();
  }
  ctx.fillStyle = COLORS.blue;
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(g.X(p.w), g.Y(p.A * 100), small ? 3.5 : 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  label(ctx, "Đồ thị cộng hưởng", g.R - 2, box.y + (small ? 8 : 11), { size: small ? 10 : 12, align: "right", bold: true });
  if (!pts.length) {
    const msg = small ? "Đổi Ω, chờ ổn định để thêm điểm" : "Đổi tần số Ω, chờ ổn định: mỗi lần thêm một điểm";
    label(ctx, msg, (g.L + g.R) / 2, (g.T + g.B) / 2, { size: g.size, color: COLORS.muted, align: "center" });
  }
}

const restart = s => {
  start(s);
  s._hist = [];
};
// The resonance curve belongs to one oscillator and one F₀: changing them clears it.
const changed = s => {
  s.points = [];
  if (s.mode === "driven") unsettle(s);
  else restart(s);
};

mount({
  slug: "dao-dong-cuong-buc",
  version: "1.0.0",
  title: "Dao động tắt dần, duy trì và cưỡng bức",
  hint: "Chọn dạng dao động. Với dao động cưỡng bức, đổi tần số Ω của ngoại lực và chờ biên độ ổn định để vẽ dần đồ thị cộng hưởng.",
  // Start a few seconds into the run, so the first picture (and the thumbnail) already shows x(t).
  initialState() {
    const s = initialState();
    s._hist = [];
    for (let i = 0; i < 6 * 120; i++) {
      step(s, 1 / 120);
      s._hist.push([s.time, s.x]);
    }
    return s;
  },
  autoplay: true,
  sanitize(incoming, base) {
    const out = {};
    for (const [key, value] of Object.entries(base)) {
      const v = incoming[key];
      if (key === "points" || typeof v !== typeof value) continue;
      if (typeof v === "number" && !Number.isFinite(v)) continue;
      out[key] = v;
    }
    out.points = sanitizePoints(incoming.points);
    out._hist = []; // the pre-run history belongs to the initial state, not to the restored one
    return out;
  },
  step(s, dt, api) {
    const event = step(s, dt);
    s._hist ??= [];
    s._hist.push([s.time, s.x]);
    while (s._hist.length && s._hist[0][0] < s.time - WINDOW) s._hist.shift();
    if (event !== "steady") return;
    addPoint(s);
    const w0 = naturalFrequency(s);
    api.emit("steady-state", { frequency: s.drive, amplitude: s.amplitude, theory: steadyAmplitude(s), naturalFrequency: w0 }, "result");
    const top = resonanceFrequency(s);
    const key = [s.mass, s.stiffness, s.damping, s.force].join("|");
    if (top && Math.abs(s.drive - top) <= 0.04 * top && s._goalKey !== key) {
      s._goalKey = key;
      api.emit("resonance", { frequency: s.drive, resonanceFrequency: top, naturalFrequency: w0, amplitude: s.amplitude }, "goal");
    }
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Dạng dao động",
      options: [
        { value: "driven", label: "Cưỡng bức (có ngoại lực tuần hoàn)" },
        { value: "free", label: "Tắt dần (thả tự do)" },
        { value: "maintained", label: "Duy trì (bù năng lượng)" },
      ],
      onChange: restart,
    },
    { type: "slider", key: "drive", label: "Tần số góc ngoại lực Ω", min: 0.5, max: 25, step: 0.1, unit: "rad/s", digits: 1, visible: s => s.mode === "driven", onChange: s => unsettle(s) },
    { type: "slider", key: "force", label: "Biên độ ngoại lực F₀", min: 0.1, max: 2, step: 0.1, unit: "N", digits: 1, visible: s => s.mode === "driven", onChange: changed },
    { type: "slider", key: "amp0", label: "Li độ ban đầu x₀", min: 2, max: 15, step: 1, unit: "cm", digits: 0, visible: s => s.mode !== "driven", onChange: restart },
    { type: "slider", key: "mass", label: "Khối lượng m", min: 0.1, max: 2, step: 0.1, unit: "kg", digits: 1, onChange: changed },
    { type: "slider", key: "stiffness", label: "Độ cứng lò xo k", min: 5, max: 50, step: 1, unit: "N/m", digits: 0, onChange: changed },
    { type: "slider", key: "damping", label: "Hệ số cản b", min: 0.05, max: 2, step: 0.05, unit: "kg/s", onChange: changed },
    { type: "checkbox", key: "showTheory", label: "Hiện đường cộng hưởng lý thuyết" },
    { type: "button", label: "Bỏ qua giai đoạn chuyển tiếp", action: s => skipTransient(s), event: "skip-transient", visible: s => s.mode === "driven" },
    { type: "button", label: "Xóa đồ thị cộng hưởng", action: s => (s.points = []), event: "clear-curve", visible: s => s.points.length > 0 },
  ],
  readouts: [
    { label: "Tần số góc riêng ω₀", value: s => `${fmt(naturalFrequency(s))} rad/s` },
    { label: "Biên độ ổn định lý thuyết", value: s => (s.mode === "driven" ? `${cm(steadyAmplitude(s))} cm` : "–") },
    { label: "Biên độ ổn định đo được", value: s => (s.mode === "driven" && s.amplitude ? `${cm(s.amplitude)} cm` : "–") },
    { label: "Chu kì đo được", value: s => (s.measuredPeriod ? `${fmt(s.measuredPeriod)} s` : "–") },
    { label: "Chu kì ngoại lực 2π/Ω", value: s => (s.mode === "driven" ? `${fmt((2 * Math.PI) / s.drive)} s` : "–") },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    // Scale the drawing to the largest recent swing, so small and large amplitudes are both visible.
    const ref = Math.max(0.005, s.amplitude, ...(s._hist ?? []).map(([, x]) => Math.abs(x)), s.mode === "driven" ? 0 : s.amp0 / 100);
    drawSpring(ctx, s, g.top, ref, g.small);
    drawXt(ctx, s, g.xt, ref, g.small);
    drawResonance(ctx, s, g.res, g.small);
  },
});
