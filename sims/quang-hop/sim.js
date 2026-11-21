import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, rate, ceilings, curve, COLOURS, FACTORS, RANGES } from "./model.js";

const FACTOR_COLORS = [COLORS.orange, COLORS.blue, COLORS.red];
const AXIS = {
  light: { name: "Cường độ ánh sáng (%)", title: "cường độ ánh sáng", digits: 0 },
  co2: { name: "Nồng độ NaHCO₃ (%)", title: "nồng độ CO₂", digits: 1 },
  temp: { name: "Nhiệt độ (°C)", title: "nhiệt độ", digits: 0 },
};
const Y_MAX = 80; // bubbles/min, highest any ceiling below the temperature one can reach
const RISE = 0.12; // fraction of the water column a bubble rises per second

// Bubbles are decoration only: they live here, not in the state. Real time: `rate` per minute.
let bubbles = [];
let phase = 0;
let seq = 0;
function stepBubbles(s, dt) {
  phase += (rate(s).rate / 60) * dt;
  while (phase >= 1) {
    phase -= 1;
    seq++;
    bubbles.push({ y: 0, x: Math.sin(seq * 2.4) * 0.5, r: 0.8 + 0.4 * Math.abs(Math.sin(seq * 1.7)) });
  }
  for (const b of bubbles) b.y += RISE * dt;
  bubbles = bubbles.filter(b => b.y < 1);
}
// Start with the stream already running so the first picture shows it.
const warmUp = s => {
  bubbles = [];
  phase = 0.9;
  for (let i = 0; i < 1 / RISE / (1 / 120); i++) stepBubbles(s, 1 / 120);
};

/** A label shrunk until it fits `maxW`. */
function fitLabel(ctx, text, x, y, maxW, opts) {
  let size = opts.size;
  for (; size > 8; size--) {
    ctx.font = `${opts.bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  label(ctx, text, x, y, { ...opts, size });
}

const report = (s, api) => {
  const r = rate(s);
  api.emit("rate-measured", { rate: r.rate, limiting: r.limiting }, "result");
};

function drawScene(ctx, s, box, small) {
  const { x, y, w, h } = box;
  const r = rate(s);
  const col = COLOURS[s.colour] ?? COLOURS.white;
  const size = small ? 11 : 13;

  // test tube
  const tw = Math.min(70, w * 0.26);
  const top = y + (small ? 34 : 56);
  const bottom = y + h - (small ? 30 : 48);
  const tx = x + w * 0.56 - tw / 2;
  const water = top + (bottom - top) * 0.08;

  // lamp and its light
  const lx = x + Math.max(16, w * 0.12);
  const ly = top + (bottom - top) * 0.45;
  const lr = small ? 10 : 16;
  if (s.light > 0) {
    ctx.save();
    ctx.globalAlpha = 0.15 + 0.55 * (s.light / 100);
    const grad = ctx.createLinearGradient(lx, 0, tx + tw, 0);
    grad.addColorStop(0, col.css);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(lx, ly - lr * 0.6);
    ctx.lineTo(tx + tw, top + 10);
    ctx.lineTo(tx + tw, bottom - 10);
    ctx.lineTo(lx, ly + lr * 0.6);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = s.light > 0 ? col.css : "#d6dbe5";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(lx - lr * 0.5, ly + lr, lr, lr * 0.5);
  label(ctx, "Đèn", lx, ly + lr * 2.1, { size, align: "center", color: COLORS.muted });

  // glass and water
  ctx.fillStyle = "#d8ecfb";
  ctx.beginPath();
  ctx.moveTo(tx, water);
  ctx.lineTo(tx, bottom - tw / 2);
  ctx.arc(tx + tw / 2, bottom - tw / 2, tw / 2, Math.PI, 0, true);
  ctx.lineTo(tx + tw, water);
  ctx.fill();
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx, top);
  ctx.lineTo(tx, bottom - tw / 2);
  ctx.arc(tx + tw / 2, bottom - tw / 2, tw / 2, Math.PI, 0, true);
  ctx.lineTo(tx + tw, top);
  ctx.stroke();
  ctx.strokeStyle = "#9fc6e6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx + 2, water);
  ctx.lineTo(tx + tw - 2, water);
  ctx.stroke();

  // the plant: a stem with whorls of small leaves, cut end at the top where the bubbles leave
  const cx = tx + tw / 2;
  const stemTop = water + (bottom - water) * 0.42;
  const stemBottom = bottom - tw * 0.3;
  ctx.strokeStyle = "#2f8a4a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, stemBottom);
  ctx.lineTo(cx, stemTop);
  ctx.stroke();
  ctx.fillStyle = "#3aa65a";
  const leaf = Math.min(tw * 0.36, 16);
  for (let yy = stemBottom - 6; yy > stemTop + 6; yy -= Math.max(7, leaf * 0.7)) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + side * leaf * 0.5, yy, leaf * 0.5, leaf * 0.16, side * -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // bubbles of O₂ from the cut end up to the surface
  const span = stemTop - water;
  ctx.strokeStyle = "#5b8db8";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  for (const b of bubbles) {
    ctx.beginPath();
    ctx.arc(cx + b.x * tw * 0.3, stemTop - b.y * span, Math.max(2, tw * 0.06) * b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // thermometer
  const thx = tx + tw + Math.min(26, w * 0.1);
  if (thx + 10 < x + w) {
    const t0 = top + 10;
    const t1 = bottom - 16;
    const level = t1 - ((t1 - t0) * s.temp) / 50;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(thx - 4, t0, 8, t1 - t0 + 4, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(thx - 2, level, 4, t1 - level + 4);
    ctx.beginPath();
    ctx.arc(thx, t1 + 6, 7, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, `${fmt(s.temp, 0)} °C`, thx, t0 - 10, { size, align: "center" });
  }

  // captions
  fitLabel(ctx, `${fmt(r.rate, 1)} bọt khí O₂/phút`, x + w / 2, y + (small ? 12 : 20), w, { size: small ? 13 : 16, bold: true, align: "center", color: COLORS.green });
  if (!small) {
    label(ctx, `Giới hạn bởi: ${FACTORS[r.limiting]}`, x + w / 2, y + 40, { size: 13, align: "center", color: FACTOR_COLORS[r.limiting] });
  }
  fitLabel(ctx, `Rong đuôi chó · NaHCO₃ ${fmt(s.co2, 2)} %`, x + w / 2, bottom + (small ? 14 : 18), w, { size, align: "center", color: COLORS.muted });
  if (!small) label(ctx, "Hình minh hoạ, không theo tỉ lệ", x + w / 2, bottom + 36, { size: 11, align: "center", color: COLORS.muted });
}

function drawGraph(ctx, s, box, small) {
  const key = AXIS[s.plot] ? s.plot : "light";
  const [lo, hi] = RANGES[key];
  const size = small ? 10 : 12;
  const left = box.x + (small ? 26 : 44);
  const right = box.x + box.w - 8;
  const top = box.y + (small ? 46 : 74);
  const bottom = box.y + box.h - (small ? 30 : 40);
  const X = v => left + ((v - lo) / (hi - lo)) * (right - left);
  const Y = v => bottom - (Math.min(v, Y_MAX * 1.05) / Y_MAX) * (bottom - top);

  fitLabel(ctx, `Tốc độ quang hợp theo ${AXIS[key].title}`, box.x, box.y + (small ? 8 : 14), box.w, { size: small ? 12 : 15, bold: true });
  label(ctx, small ? "bọt khí/phút; yếu tố khác giữ nguyên" : "Trục tung: bọt khí O₂/phút · các yếu tố khác giữ nguyên", box.x, box.y + (small ? 21 : 34), { size: small ? 9 : 12, color: COLORS.muted });

  // grid and axes
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let v = 0; v <= Y_MAX; v += 20) {
    ctx.beginPath();
    ctx.moveTo(left, Y(v));
    ctx.lineTo(right, Y(v));
    ctx.stroke();
    label(ctx, fmt(v, 0), left - 4, Y(v), { size, align: "right", color: COLORS.muted });
  }
  for (let i = 0; i <= 5; i++) {
    const v = lo + ((hi - lo) * i) / 5;
    label(ctx, fmt(v, AXIS[key].digits), X(v), bottom + size, { size, align: "center", color: COLORS.muted });
  }
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(left, top - 6);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();
  label(ctx, AXIS[key].name, (left + right) / 2, bottom + size * 2.3, { size, align: "center", color: COLORS.muted });

  // each factor's ceiling, dashed, then the rate (their minimum)
  const n = 120;
  const xs = Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top - 8, right - left, bottom - top + 8);
  ctx.clip();
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.5;
  FACTOR_COLORS.forEach((color, f) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    xs.forEach((v, i) => {
      const c = ceilings({ ...s, [key]: v })[f];
      i ? ctx.lineTo(X(v), Y(c)) : ctx.moveTo(X(v), Y(c));
    });
    ctx.stroke();
  });
  ctx.restore();
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 3;
  ctx.beginPath();
  curve(s, key, n).forEach(([v, r], i) => (i ? ctx.lineTo(X(v), Y(r)) : ctx.moveTo(X(v), Y(r))));
  ctx.stroke();

  // the current setting
  const now = rate(s);
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(X(s[key]), Y(now.rate), 5, 0, Math.PI * 2);
  ctx.fill();

  // legend: the dashed ceilings, one row between the subtitle and the plot
  let lx = box.x;
  const ly = box.y + (small ? 33 : 54);
  if (!small) {
    label(ctx, "Giới hạn do:", lx, ly, { size, color: COLORS.muted });
    lx += 76;
  }
  for (let f = 0; f < 3; f++) {
    ctx.strokeStyle = FACTOR_COLORS[f];
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 14, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    const text = small ? ["ánh sáng", "CO₂", "nhiệt độ"][f] : FACTORS[f];
    label(ctx, text, lx + 17, ly, { size, color: COLORS.muted });
    ctx.font = `${size}px system-ui, sans-serif`;
    lx += 17 + ctx.measureText(text).width + 10;
  }
}

mount({
  slug: "quang-hop",
  version: "1.0.0",
  title: "Các yếu tố ảnh hưởng đến quang hợp",
  hint: "Thay đổi cường độ ánh sáng, nồng độ CO₂, nhiệt độ và màu ánh sáng; đếm số bọt khí O₂ thoát ra mỗi phút và tìm nhân tố đang giới hạn tốc độ quang hợp.",
  initialState: () => {
    const s = initialState();
    warmUp(s);
    return s;
  },
  autoplay: true,
  step(s, dt) {
    stepBubbles(s, dt);
  },
  controls: [
    { type: "heading", label: "Điều kiện thí nghiệm" },
    { type: "slider", key: "light", label: "Cường độ ánh sáng", min: 0, max: 100, step: 1, unit: "%", digits: 0, onCommit: report },
    { type: "slider", key: "co2", label: "Nồng độ CO₂ (NaHCO₃ trong nước)", min: 0, max: 1, step: 0.01, unit: "%", onCommit: report },
    { type: "slider", key: "temp", label: "Nhiệt độ", min: 0, max: 50, step: 1, unit: "°C", digits: 0, onCommit: report },
    {
      type: "select",
      key: "colour",
      label: "Màu ánh sáng",
      onCommit: report,
      options: Object.entries(COLOURS).map(([value, c]) => ({ value, label: `${c.label} (hiệu quả ${fmt(c.eff, 2)})` })),
    },
    { type: "heading", label: "Đồ thị" },
    {
      type: "select",
      key: "plot",
      label: "Vẽ tốc độ quang hợp theo",
      options: [
        { value: "light", label: "Cường độ ánh sáng" },
        { value: "co2", label: "Nồng độ CO₂" },
        { value: "temp", label: "Nhiệt độ" },
      ],
    },
  ],
  readouts: [
    { label: "Tốc độ quang hợp", value: s => `${fmt(rate(s).rate, 1)} bọt khí/phút` },
    { label: "Nhân tố giới hạn", value: s => FACTORS[rate(s).limiting] },
    { label: "Giới hạn do ánh sáng · CO₂ · nhiệt độ", value: s => ceilings(s).map(c => fmt(c, 1)).join(" · ") },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560;
    const sceneW = Math.round(view.w * (small ? 0.4 : 0.38));
    drawScene(ctx, s, { x: 4, y: 4, w: sceneW - 8, h: view.h - 8 }, small);
    const pad = small ? 6 : 24;
    drawGraph(ctx, s, { x: sceneW + pad, y: small ? 6 : 20, w: view.w - sceneW - 2 * pad, h: view.h - (small ? 8 : 36) }, small);
  },
});
