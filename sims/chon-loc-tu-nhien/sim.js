import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, generation, frequencies, counts, total, deathChance, repopulate, random } from "./model.js";

const NAMES = ["sáng", "trung bình", "tối"];
const BG = ["#e8dcbf", "#a2835b", "#45331f"];
const PREY = ["#f1e6cc", "#9e7d52", "#3d2c1b"];
const LINE = ["#d9a520", "#9c6b30", "#2b1d10"];
const GEN_PER_SECOND = 4;

const point = s => [s.generation, ...frequencies(s)];

// One generation, with its events: a report every 10 generations, a goal when a variant passes 90 %.
function advance(s, api) {
  const hist = (s._hist ??= []);
  if (hist.at(-1)?.[0] !== s.generation) hist.push(point(s));
  generation(s);
  hist.push(point(s));
  if (hist.length > 1200) s._hist = hist.filter((_, i) => i % 2 === 0 || i === hist.length - 1);
  const f = frequencies(s);
  if (s.generation % 10 === 0) {
    api.emit("generation-report", { generation: s.generation, light: f[0], medium: f[1], dark: f[2] }, "result");
  }
  const top = f.indexOf(Math.max(...f));
  if (f[top] > 0.9) {
    if (s._dominant !== top) api.emit("variant-dominant", { generation: s.generation, variant: top, frequency: f[top] }, "goal");
    s._dominant = top;
  } else s._dominant = -1;
  if (!total(s)) api.pause();
}

function drawField(ctx, s, box, small) {
  ctx.fillStyle = BG[s.background] ?? BG[0];
  ctx.fillRect(box.x, box.y, box.w, box.h);
  // positions come from their own generator (seed, generation), so drawing never changes the run
  const pos = { rng: (s.seed ^ Math.imul(s.generation + 1, 0x9e3779b1)) >>> 0 };
  const n = counts(s);
  const r = clamp(Math.sqrt((box.w * box.h) / Math.max(60, s.cap)) * 0.22, 2.5, 7);
  for (let v = 0; v < 3; v++) {
    ctx.fillStyle = PREY[v];
    for (let i = 0; i < n[v]; i++) {
      const x = box.x + r + random(pos) * (box.w - 2 * r);
      const y = box.y + r + random(pos) * (box.h - 2 * r);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const text = `Thế hệ ${s.generation} · ${total(s)} cá thể`;
  ctx.font = `600 ${small ? 12 : 14}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.roundRect(box.x + 6, box.y + 6, tw + 16, small ? 22 : 26, 5);
  ctx.fill();
  label(ctx, text, box.x + 14, box.y + (small ? 17 : 19), { size: small ? 12 : 14, bold: true });
  if (!total(s)) label(ctx, "Quần thể đã bị tiêu diệt hết", box.x + box.w / 2, box.y + box.h / 2, { size: 15, bold: true, align: "center", color: COLORS.red });
}

function drawChart(ctx, s, box, small) {
  const points = [...(s._hist ?? [])];
  if (points.at(-1)?.[0] !== s.generation) points.push(point(s));
  const g0 = points[0][0];
  const span = Math.max(20, s.generation - g0);
  const X = g => box.x + ((g - g0) / span) * box.w;
  const Y = f => box.y + box.h - f * box.h;

  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.moveTo(box.x, Y(f));
    ctx.lineTo(box.x + box.w, Y(f));
    ctx.stroke();
    if (!small || f % 0.5 === 0) label(ctx, `${fmt(f * 100, 0)} %`, box.x - 5, Y(f), { size: 10, align: "right", color: COLORS.muted });
  }
  ctx.strokeStyle = COLORS.red;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(box.x, Y(0.9));
  ctx.lineTo(box.x + box.w, Y(0.9));
  ctx.stroke();
  ctx.setLineDash([]);
  const step = span <= 40 ? 5 : span <= 100 ? 10 : span <= 400 ? 50 : 100;
  for (let g = Math.ceil(g0 / step) * step; g <= g0 + span; g += step) {
    label(ctx, String(g), X(g), box.y + box.h + 10, { size: 10, align: "center", color: COLORS.muted });
  }
  label(ctx, "thế hệ", box.x + box.w, box.y + box.h + 22, { size: 10, align: "right", color: COLORS.muted });
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.stroke();

  for (let v = 0; v < 3; v++) {
    ctx.strokeStyle = LINE[v];
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[v + 1])) : ctx.moveTo(X(p[0]), Y(p[v + 1]))));
    ctx.stroke();
    const last = points.at(-1);
    ctx.fillStyle = LINE[v];
    ctx.beginPath();
    ctx.arc(X(last[0]), Y(last[v + 1]), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // legend above the plot, with the current frequency
  const f = frequencies(s);
  let x = box.x;
  for (let v = 0; v < 3; v++) {
    const text = `${NAMES[v]} ${fmt(f[v] * 100, 0)} %`;
    ctx.fillStyle = LINE[v];
    ctx.fillRect(x, box.y - 15, 12, 4);
    label(ctx, text, x + 16, box.y - 13, { size: 11, color: COLORS.ink });
    ctx.font = `11px system-ui, -apple-system, "Segoe UI", sans-serif`;
    x += 16 + ctx.measureText(text).width + (small ? 8 : 16);
  }
}

mount({
  slug: "chon-loc-tu-nhien",
  version: "1.0.0",
  title: "Chọn lọc tự nhiên",
  hint: "Mỗi chấm là một con mồi; màu lông di truyền từ bố mẹ. Con mồi khác màu nền dễ bị kẻ săn mồi phát hiện hơn. Nhấn Chạy hoặc bấm từng thế hệ. Mô hình đơn giản hoá: một gene có ba biến dị, con thừa hưởng màu của một cá thể sống sót.",
  initialState,
  step(s, dt, api) {
    s._t = (s._t ?? 0) + dt;
    if (s._t < 1 / GEN_PER_SECOND) return;
    s._t = 0;
    advance(s, api);
  },
  controls: [
    {
      type: "select",
      key: "background",
      label: "Màu nền môi trường",
      options: [
        { value: 0, label: "Nền sáng" },
        { value: 1, label: "Nền trung bình" },
        { value: 2, label: "Nền tối" },
      ],
    },
    { type: "slider", key: "selection", label: "Áp lực chọn lọc (kẻ săn mồi)", min: 0, max: 1, step: 0.05, format: v => `${fmt(v * 100, 0)} %` },
    { type: "slider", key: "mutation", label: "Tần số đột biến màu", min: 0, max: 0.1, step: 0.005, format: v => `${fmt(v * 100, 1)} %` },
    { type: "slider", key: "cap", label: "Số cá thể tối đa của quần thể", min: 30, max: 500, step: 10, digits: 0 },
    {
      type: "button",
      label: "Sang thế hệ tiếp theo",
      primary: true,
      event: "next-generation",
      action(s, api) {
        api.pause();
        advance(s, api);
      },
    },
    {
      type: "button",
      label: "Tạo quần thể mới",
      event: "new-population",
      action(s, api) {
        api.pause();
        repopulate(s);
        s._hist = [];
        s._dominant = -1;
      },
    },
  ],
  readouts: [
    { label: "Thế hệ", value: s => String(s.generation) },
    { label: "Số cá thể", value: s => String(total(s)) },
    { label: "Tần số (sáng / TB / tối)", value: s => frequencies(s).map(f => `${fmt(f * 100, 0)} %`).join(" / ") },
    { label: "Bị ăn mỗi thế hệ (sáng / TB / tối)", value: s => [0, 1, 2].map(v => `${fmt(deathChance(s, v) * 100, 0)} %`).join(" / ") },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 560 || h < 420;
    const fieldH = Math.round(h * (small ? 0.5 : 0.55));
    drawField(ctx, s, { x: 0, y: 0, w, h: fieldH }, small);
    const left = small ? 40 : 52;
    const top = fieldH + (small ? 26 : 36);
    drawChart(ctx, s, { x: left, y: top, w: w - left - (small ? 12 : 24), h: h - top - (small ? 32 : 36) }, small);
  },
});
