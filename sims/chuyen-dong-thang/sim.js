import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, cart, at, turnTime, meeting, extent, T_MAX } from "./model.js";

const CARTS = [
  { id: 1, name: "A", color: COLORS.blue },
  { id: 2, name: "B", color: COLORS.orange },
];
const active = s => (s.twoCarts ? CARTS : CARTS.slice(0, 1));

// 1-2-5 step that splits `span` into at most `max` intervals.
const niceStep = (span, max) => {
  const p = 10 ** Math.floor(Math.log10(span / max));
  return [1, 2, 5, 10].map(m => m * p).find(v => span / v <= max);
};

// Any change of the set-up starts again from t = 0.
const restart = (s, api) => {
  s.time = 0;
  api.pause();
};

function drawTrack(ctx, s, box, small) {
  const { lo, hi } = extent(s);
  const pad = Math.max(2, (hi - lo) * 0.06);
  const x1 = lo - pad;
  const x2 = hi + pad;
  const X = x => box.x + ((x - x1) / (x2 - x1)) * box.w;
  const lanes = s.twoCarts ? [box.y + box.h * 0.3, box.y + box.h * 0.62] : [box.y + box.h * 0.48];
  const axisY = box.y + box.h * 0.82;

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  for (const y of lanes) {
    ctx.beginPath();
    ctx.moveTo(box.x, y + 8);
    ctx.lineTo(box.x + box.w, y + 8);
    ctx.stroke();
  }
  arrow(ctx, box.x, axisY, box.x + box.w + 10, axisY, COLORS.ink, 1.5);
  label(ctx, "x (m)", box.x + box.w + 8, axisY - 12, { size: 11, align: "right", color: COLORS.muted });
  const dx = niceStep(x2 - x1, small ? 5 : 10);
  ctx.fillStyle = COLORS.ink;
  for (let x = Math.ceil(x1 / dx) * dx; x <= x2; x += dx) {
    ctx.fillRect(X(x) - 0.5, axisY - 4, 1, 8);
    if (X(x) < box.x + box.w - 30) label(ctx, x === 0 ? "O" : fmt(x, 1), X(x), axisY + 13, { size: 11, align: "center", color: x === 0 ? COLORS.ink : COLORS.muted, bold: x === 0 });
  }

  active(s).forEach((k, i) => {
    const c = cart(s, k.id);
    const m = at(c, s.time);
    const y = lanes[i];
    const x = X(m.x);
    // start mark
    ctx.fillStyle = k.color;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(X(c.x0) - 1, y - 10, 2, 18);
    ctx.globalAlpha = 1;
    // cart
    const cw = small ? 22 : 30;
    const ch = small ? 11 : 14;
    ctx.fillStyle = k.color;
    ctx.beginPath();
    ctx.roundRect(x - cw / 2, y - ch + 4, cw, ch, 3);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    for (const wx of [x - cw / 4, x + cw / 4]) {
      ctx.beginPath();
      ctx.arc(wx, y + 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, k.name, x, y - ch / 2 + 4, { size: 11, align: "center", bold: true, color: "#fff" });
    const len = Math.max(-60, Math.min(60, m.v * (small ? 3 : 4)));
    if (Math.abs(len) > 2) arrow(ctx, x + Math.sign(len) * (cw / 2 + 2), y - ch / 2 + 4, x + Math.sign(len) * (cw / 2 + 2) + len, y - ch / 2 + 4, COLORS.green, 2);
  });
}

function drawChart(ctx, s, box, opt) {
  const { key, name, unit, showT, area } = opt;
  const carts = active(s);
  let lo = 0;
  let hi = 0;
  const N = 200;
  for (const k of carts) {
    const c = cart(s, k.id);
    for (let i = 0; i <= N; i++) {
      const v = at(c, (T_MAX * i) / N)[key];
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  if (hi - lo < 1) [lo, hi] = [lo - 0.5, hi + 0.5];
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const X = t => box.x + (t / T_MAX) * box.w;
  const Y = v => box.y + box.h - ((v - lo) / (hi - lo)) * box.h;

  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  const vStep = niceStep(hi - lo, box.h > 110 ? 5 : 3);
  for (let v = Math.ceil(lo / vStep) * vStep; v <= hi; v += vStep) {
    ctx.beginPath();
    ctx.moveTo(box.x, Y(v));
    ctx.lineTo(box.x + box.w, Y(v));
    ctx.stroke();
    label(ctx, fmt(v, 1), box.x - 5, Y(v), { size: 10, align: "right", color: COLORS.muted });
  }
  const tStep = niceStep(T_MAX, box.w > 400 ? 10 : 5);
  for (let t = 0; t <= T_MAX + 1e-9; t += tStep) {
    ctx.beginPath();
    ctx.moveTo(X(t), box.y);
    ctx.lineTo(X(t), box.y + box.h);
    ctx.stroke();
    if (showT) label(ctx, fmt(t), X(t), box.y + box.h + 10, { size: 10, align: "center", color: COLORS.muted });
  }
  if (showT) label(ctx, "t (s)", box.x + box.w, box.y + box.h + 22, { size: 10, align: "right", color: COLORS.muted });
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  if (lo <= 0 && hi >= 0) {
    ctx.moveTo(box.x, Y(0));
    ctx.lineTo(box.x + box.w, Y(0));
  }
  ctx.stroke();
  label(ctx, `${name} (${unit})`, box.x + 6, box.y + 8, { size: 11, bold: true });

  // area under v–t for cart A, from 0 to t: its signed value is the displacement
  if (area && s.time > 0) {
    const c = cart(s, 1);
    ctx.fillStyle = "rgba(47, 111, 237, 0.16)";
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    for (let i = 0; i <= N; i++) {
      const t = (s.time * i) / N;
      ctx.lineTo(X(t), Y(at(c, t).v));
    }
    ctx.lineTo(X(s.time), Y(0));
    ctx.closePath();
    ctx.fill();
  }

  for (const k of carts) {
    const c = cart(s, k.id);
    // whole run, dashed: what the formula predicts
    ctx.strokeStyle = k.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = (T_MAX * i) / N;
      i ? ctx.lineTo(X(t), Y(at(c, t)[key])) : ctx.moveTo(X(t), Y(at(c, t)[key]));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // travelled so far
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = (s.time * i) / N;
      i ? ctx.lineTo(X(t), Y(at(c, t)[key])) : ctx.moveTo(X(t), Y(at(c, t)[key]));
    }
    ctx.stroke();
    ctx.fillStyle = k.color;
    ctx.beginPath();
    ctx.arc(X(s.time), Y(at(c, s.time)[key]), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (key === "x") {
    // turning points and the meeting point, once reached
    const marks = [];
    for (const k of carts) {
      const tt = turnTime(cart(s, k.id));
      if (tt <= s.time) marks.push([tt, at(cart(s, k.id), tt).x, k.color]);
    }
    const m = s.twoCarts ? meeting(s) : null;
    if (m?.time <= s.time) marks.push([m.time, m.x, COLORS.red]);
    for (const [t, x, color] of marks) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(t), Y(x), 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (area) {
    const c = cart(s, 1);
    label(ctx, `diện tích (A) = Δx = ${fmt(at(c, s.time).x - c.x0, 1)} m`, box.x + box.w - 4, box.y + 8, { size: 11, align: "right", color: COLORS.blue });
  }
}

const meetText = s => {
  if (!s.twoCarts) return "–";
  const m = meeting(s);
  if (!m) return "không gặp nhau";
  if (m.always) return "luôn cùng vị trí";
  return `t = ${fmt(m.time)} s; x = ${fmt(m.x)} m${m.time > T_MAX ? " (sau 20 s)" : ""}`;
};

const turnText = c => {
  const tt = turnTime(c);
  return tt === Infinity ? "không" : `t = ${fmt(tt)} s; x = ${fmt(at(c, tt).x)} m`;
};

const param = extra => ({ onChange: restart, ...extra });

mount({
  slug: "chuyen-dong-thang",
  version: "1.0.0",
  title: "Chuyển động thẳng biến đổi đều",
  hint: "Chọn x₀, v₀, a rồi nhấn Chạy. Đường nét đứt là đồ thị dự đoán theo công thức.",
  initialState,
  step(s, dt, api) {
    if (s.time >= T_MAX) s.time = 0; // "Chạy" after a finished run starts a new one
    if (s.time === 0) {
      api.emit("start", { x0: s.x0, v0: s.v0, a: s.a, twoCarts: s.twoCarts ? 1 : 0, x0B: s.x0B, v0B: s.v0B, aB: s.aB, brake: s.brake ? 1 : 0 });
    }
    const before = s.time;
    step(s, dt);
    for (const k of active(s)) {
      const c = cart(s, k.id);
      const tt = turnTime(c);
      if (tt > before && tt <= s.time) {
        api.emit("turning-point", { cart: k.id, time: tt, position: at(c, tt).x, stays: s.brake ? 1 : 0 }, "result");
      }
    }
    if (s.twoCarts) {
      const m = meeting(s);
      if (m && !m.always && m.time > before && m.time <= s.time) api.emit("carts-meet", { time: m.time, position: m.x }, "result");
    }
    if (s.time >= T_MAX) api.pause();
  },
  controls: [
    { type: "heading", label: "Xe A" },
    param({ type: "slider", key: "x0", label: "Tọa độ ban đầu x₀", min: -50, max: 50, step: 1, unit: "m", digits: 0 }),
    param({ type: "slider", key: "v0", label: "Vận tốc ban đầu v₀", min: -15, max: 15, step: 0.5, unit: "m/s", digits: 1 }),
    param({ type: "slider", key: "a", label: "Gia tốc a", min: -5, max: 5, step: 0.1, unit: "m/s²", digits: 1 }),
    param({ type: "checkbox", key: "brake", label: "Hãm phanh: xe dừng hẳn khi v = 0" }),
    param({ type: "checkbox", key: "twoCarts", label: "Thêm xe B (bài toán hai xe gặp nhau)" }),
    { type: "heading", label: "Xe B", visible: s => s.twoCarts },
    param({ type: "slider", key: "x0B", label: "Tọa độ ban đầu x₀ của B", min: -50, max: 50, step: 1, unit: "m", digits: 0, visible: s => s.twoCarts }),
    param({ type: "slider", key: "v0B", label: "Vận tốc ban đầu v₀ của B", min: -15, max: 15, step: 0.5, unit: "m/s", digits: 1, visible: s => s.twoCarts }),
    param({ type: "slider", key: "aB", label: "Gia tốc a của B", min: -5, max: 5, step: 0.1, unit: "m/s²", digits: 1, visible: s => s.twoCarts }),
  ],
  readouts: [
    { label: "Thời gian t", value: s => `${fmt(s.time, 2)} s` },
    { label: "Xe A: x; v", value: s => `${fmt(at(cart(s, 1), s.time).x)} m; ${fmt(at(cart(s, 1), s.time).v)} m/s` },
    { label: "Xe A: độ dời Δx = x − x₀", value: s => `${fmt(at(cart(s, 1), s.time).x - s.x0)} m` },
    { label: "Xe A: v = 0 lúc", value: s => turnText(cart(s, 1)) },
    { label: "Xe B: x; v", value: s => (s.twoCarts ? `${fmt(at(cart(s, 2), s.time).x)} m; ${fmt(at(cart(s, 2), s.time).v)} m/s` : "–") },
    { label: "Xe B: v = 0 lúc", value: s => (s.twoCarts ? turnText(cart(s, 2)) : "–") },
    { label: "Hai xe gặp nhau", value: meetText },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 560 || h < 420;
    const left = small ? 40 : 52;
    const right = small ? 12 : 24;
    const trackH = small ? 66 : 104;
    drawTrack(ctx, s, { x: left - 20, y: 4, w: w - left - right + 10, h: trackH }, small);
    const charts = [
      { key: "x", name: "x", unit: "m" },
      { key: "v", name: "v", unit: "m/s", area: true },
      { key: "a", name: "a", unit: "m/s²" },
    ].slice(0, small ? 2 : 3); // a–t is a flat line: dropped first when space is short
    const gap = small ? 8 : 14;
    const top = trackH + (small ? 8 : 14);
    const ch = (h - top - 32 - gap * (charts.length - 1)) / charts.length;
    charts.forEach((c, i) => drawChart(ctx, s, { x: left, y: top + i * (ch + gap), w: w - left - right, h: ch }, { ...c, showT: i === charts.length - 1 }));
  },
});
