import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, restart, equilibrium, params, hunt, winter, WINTER_LOSS, E } from "./model.js";

const RABBIT = COLORS.blue;
const FOX = COLORS.red;
const WINDOW = 40; // years shown on the time plot
const SAMPLE = 0.1; // years between stored points
const KEEP = 3000; // stored points (300 years)

// History of [time, rabbits, foxes] lives in a transient key: it is redrawn, never saved.
const record = s => {
  const h = (s._hist ??= []);
  const last = h.at(-1);
  if (!last || s.time - last[0] >= SAMPLE - 1e-9 || s.time < last[0]) {
    if (last && s.time < last[0]) h.length = 0;
    h.push([s.time, s.rabbits, s.foxes]);
    if (h.length > KEEP) h.splice(0, h.length - KEEP);
  }
};
// After a one-off event the curve jumps: store both sides of the jump.
const jump = s => {
  (s._hist ??= []).push([s.time, s.rabbits, s.foxes]);
};
const fresh = s => {
  restart(s);
  s._hist = [];
  s._from = null;
};

// Forecast: what the model predicts from the last change (start, event, new coefficient) if
// nothing else changes. Drawn faint, so the effect of an event shows as the gap to it.
const mark = s => {
  s._from = [s.time, s.rabbits, s.foxes];
};
const forecast = (s, until) => {
  const from = s._from ?? (s.time === 0 ? [0, s.rabbits, s.foxes] : [s.time, s.rabbits, s.foxes]);
  s._from = from;
  const p = params(s);
  const key = `${from}|${p.a}|${p.b}|${p.d}|${p.K}`;
  let f = s._forecast;
  if (!f || f.key !== key) f = s._forecast = { key, sim: { ...s, time: from[0], rabbits: from[1], foxes: from[2] }, pts: [from] };
  while (f.sim.time < until - 1e-9) {
    for (let i = 0; i < 4; i++) step(f.sim, SAMPLE / 4);
    f.pts.push([f.sim.time, f.sim.rabbits, f.sim.foxes]);
  }
  return f.pts;
};

const nice = v => {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].find(m => m * p >= v) * p;
};

function axes(ctx, box, xMax, yMax, { xLabel, yLabel, yColor, rightMax, rightColor, rightLabel, xMin = 0, size }) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const y = box.y + (box.h * i) / 5;
    ctx.moveTo(box.x, y);
    ctx.lineTo(box.x + box.w, y);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  const t = size - 2;
  label(ctx, fmt(yMax, 0), box.x - 4, box.y + 4, { size: t, align: "right", color: yColor });
  label(ctx, "0", box.x - 4, box.y + box.h, { size: t, align: "right", color: COLORS.muted });
  if (rightMax) label(ctx, fmt(rightMax, 0), box.x + box.w + 4, box.y + 4, { size: t, color: rightColor });
  label(ctx, fmt(xMin, 0), box.x, box.y + box.h + 9, { size: t, align: "center", color: COLORS.muted });
  label(ctx, fmt(xMax, 0), box.x + box.w, box.y + box.h + 9, { size: t, align: "center", color: COLORS.muted });
  label(ctx, xLabel, box.x + box.w / 2, box.y + box.h + 9, { size: t, align: "center", color: COLORS.muted });
  label(ctx, yLabel, box.x + 4, box.y - 9, { size: t, color: yColor, bold: true });
  if (rightLabel) label(ctx, rightLabel, box.x + box.w - 4, box.y - 9, { size: t, align: "right", color: rightColor, bold: true });
}

function line(ctx, pts, color, width = 2) {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const windowEnd = s => Math.max(WINDOW, s.time + WINDOW / 4); // a quarter of the window looks ahead

function timePlot(ctx, s, hist, ahead, box, size) {
  const t1 = windowEnd(s);
  const t0 = t1 - WINDOW;
  const shown = hist.filter(p => p[0] >= t0);
  const guess = ahead.filter(p => p[0] >= t0 && p[0] <= t1);
  const both = shown.concat(guess);
  const eq = equilibrium(s);
  const rMax = nice(Math.max(...both.map(p => p[1]), eq?.rabbits ?? 0, 10) * 1.05);
  const fMax = nice(Math.max(...both.map(p => p[2]), eq?.foxes ?? 0, 5) * 1.05);
  axes(ctx, box, t1, rMax, { xMin: t0, xLabel: "thời gian (năm)", yLabel: "Thỏ", yColor: RABBIT, rightMax: fMax, rightColor: FOX, rightLabel: "Cáo", size });
  const X = t => box.x + ((t - t0) / WINDOW) * box.w;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.globalAlpha = 0.25;
  line(ctx, guess.map(p => [X(p[0]), box.y + box.h * (1 - p[1] / rMax)]), RABBIT);
  line(ctx, guess.map(p => [X(p[0]), box.y + box.h * (1 - p[2] / fMax)]), FOX);
  ctx.globalAlpha = 1;
  line(ctx, shown.map(p => [X(p[0]), box.y + box.h * (1 - p[1] / rMax)]), RABBIT, 2.5);
  line(ctx, shown.map(p => [X(p[0]), box.y + box.h * (1 - p[2] / fMax)]), FOX, 2.5);
  ctx.restore();
}

function phasePlot(ctx, s, hist, ahead, box, size) {
  const p = params(s);
  const eq = equilibrium(s);
  const both = hist.concat(ahead);
  const rMax = nice(Math.max(...both.map(q => q[1]), eq?.rabbits ?? 0, 10) * 1.05);
  const fMax = nice(Math.max(...both.map(q => q[2]), eq?.foxes ?? 0, 5) * 1.05);
  axes(ctx, box, rMax, fMax, { xLabel: "số thỏ", yLabel: "Cáo", yColor: FOX, size });
  const X = r => box.x + (r / rMax) * box.w;
  const Y = f => box.y + box.h * (1 - f / fMax);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  // where each population stops changing (dashed): rabbits on the slanted line, foxes on the vertical
  ctx.setLineDash([5, 4]);
  if (p.b > 0) {
    const fAt = r => (p.a / p.b) * (Number.isFinite(p.K) ? 1 - r / p.K : 1);
    line(ctx, [[X(0), Y(fAt(0))], [X(rMax), Y(fAt(rMax))]], RABBIT, 1);
    line(ctx, [[X(p.d / (E * p.b)), Y(0)], [X(p.d / (E * p.b)), Y(fMax)]], FOX, 1);
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.25;
  line(ctx, ahead.map(q => [X(q[1]), Y(q[2])]), COLORS.purple, 1.5);
  ctx.globalAlpha = 1;
  line(ctx, hist.map(q => [X(q[1]), Y(q[2])]), COLORS.purple, 2);
  ctx.restore();
  if (eq) {
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(eq.rabbits), Y(eq.foxes), 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  dot(ctx, X(Math.min(s.rabbits, rMax)), Y(Math.min(s.foxes, fMax)), 5, COLORS.purple);
}

const emitPeak = (s, api) => api.emit("fox-peak", { time: s.time, rabbits: s.rabbits, foxes: s.foxes }, "result");

mount({
  slug: "quan-he-vat-an-thit-con-moi",
  version: "1.0.0",
  title: "Biến động số lượng: vật ăn thịt và con mồi",
  hint: "Thỏ sinh sản, cáo ăn thỏ. Theo dõi hai quần thể lên xuống theo thời gian, rồi thử săn bắt cáo hoặc một mùa đông khắc nghiệt.",
  initialState,
  autoplay: true,
  timeScale: () => 3, // 3 years per second
  step(s, dt, api) {
    if (!s._hist?.length) record(s);
    if (step(s, dt).peak) emitPeak(s, api);
    record(s);
  },
  controls: [
    { type: "heading", label: "Số lượng ban đầu" },
    { type: "slider", key: "rabbits0", label: "Số thỏ", min: 10, max: 1000, step: 10, digits: 0, unit: "con", onChange: fresh },
    { type: "slider", key: "foxes0", label: "Số cáo", min: 0, max: 100, step: 1, digits: 0, unit: "con", onChange: fresh },
    { type: "heading", label: "Các hệ số" },
    { type: "slider", key: "birth", onChange: mark, label: "Tỉ lệ sinh của thỏ a", min: 0.2, max: 2, step: 0.1, digits: 1, unit: "/năm" },
    { type: "slider", key: "predation", onChange: mark, label: "Tỉ lệ bắt mồi b", min: 0.005, max: 0.05, step: 0.001, digits: 3, unit: "/năm" },
    { type: "slider", key: "death", onChange: mark, label: "Tỉ lệ tử vong của cáo d", min: 0.1, max: 1.5, step: 0.05, digits: 2, unit: "/năm" },
    { type: "checkbox", key: "capacity", label: "Môi trường có giới hạn (sức chứa K)", onChange: mark },
    { type: "slider", key: "K", onChange: mark, label: "Sức chứa K", min: 200, max: 3000, step: 100, digits: 0, unit: "thỏ", visible: s => s.capacity },
    {
      type: "button",
      label: "Bắt đầu lại",
      action: fresh,
      event: "restart",
    },
    { type: "heading", label: "Sự kiện bất ngờ" },
    {
      type: "button",
      label: "Săn bắt: số cáo giảm một nửa",
      action(s, api) {
        jump(s);
        const r = hunt(s);
        jump(s);
        mark(s);
        api.emit("hunt", { time: s.time, before: r.before, after: r.after }, "action");
      },
    },
    {
      type: "button",
      label: `Mùa đông khắc nghiệt: ${WINTER_LOSS * 100}% số thỏ chết`,
      action(s, api) {
        jump(s);
        const r = winter(s);
        jump(s);
        mark(s);
        api.emit("harsh-winter", { time: s.time, before: r.before, after: r.after }, "action");
      },
    },
  ],
  readouts: [
    { label: "Thời gian", value: s => `${fmt(s.time, 1)} năm` },
    { label: "Số thỏ", value: s => (s.rabbits ? `${fmt(s.rabbits, 0)} con` : "tuyệt chủng") },
    { label: "Số cáo", value: s => (s.foxes ? `${fmt(s.foxes, 0)} con` : "tuyệt chủng") },
    { label: "Điểm cân bằng (thỏ; cáo)", value: s => (equilibrium(s) ? `(${fmt(equilibrium(s).rabbits, 0)}; ${fmt(equilibrium(s).foxes, 1)})` : "cáo không tồn tại được") },
    { label: "Số lần cáo đạt đỉnh", value: s => `${Math.max(0, Math.round(s.peaks) || 0)}` },
  ],
  draw(ctx, s, view) {
    const hist = s._hist?.length ? s._hist : [[s.time, s.rabbits, s.foxes]];
    const small = view.w < 520 || view.h < 400;
    const size = small ? 11 : 13;
    const padL = small ? 34 : 46;
    const padR = small ? 30 : 42;
    const top = small ? 18 : 26;
    const xl = 20; // x-axis labels under a plot
    const note = 18; // the line of text at the bottom
    let a, b;
    if (view.w > view.h * 1.25) {
      // side by side: time plot on the left, square phase plot on the right
      const h = view.h - top - xl - note;
      const side = Math.min(h, (view.w - 2 * padL - padR - 12) * 0.4);
      b = { x: view.w - 16 - side, y: top, w: side, h: side };
      a = { x: padL, y: top, w: b.x - padL - padR - padL, h };
    } else {
      const h = (view.h - 2 * top - 2 * xl - note) / 2;
      a = { x: padL, y: top, w: view.w - padL - padR, h };
      b = { x: padL, y: top + h + xl + top, w: view.w - padL - padR, h };
    }
    const ahead = forecast(s, windowEnd(s));
    timePlot(ctx, s, hist, ahead, a, size);
    phasePlot(ctx, s, hist, ahead, b, size);
    const text = small ? "Nét mờ: dự báo · hai trục tung khác thang chia" : "Nét mờ: dự báo nếu không có thay đổi nào nữa. Hai trục tung có thang chia khác nhau. ○ là điểm cân bằng; trên nét đứt một quần thể không đổi.";
    label(ctx, text, view.w / 2, view.h - 9, { size: size - 1, align: "center", color: COLORS.muted });
    if (!s.rabbits || !s.foxes) {
      const who = !s.rabbits && !s.foxes ? "Cả hai loài đã tuyệt chủng" : !s.foxes ? "Cáo đã tuyệt chủng" : "Thỏ đã tuyệt chủng";
      label(ctx, who, a.x + a.w / 2, a.y + 14, { size: size + 1, align: "center", bold: true, color: COLORS.orange });
    }
  },
});
