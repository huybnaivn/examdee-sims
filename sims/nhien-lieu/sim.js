import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  FUELS, FUEL_IDS, BURN_TIME, AIR_MIN, AIR_MAX, T_COLD, T_HOT,
  initialState, step, progress, burn, equation, pretty, perKg, leastCo2Fuel,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FUEL_COLOR = { than: COLORS.ink, xang: COLORS.orange, gas: COLORS.blue, con: COLORS.purple, hydro: COLORS.green };
const NAME = { than: "than", xang: "xăng", gas: "khí gas", con: "cồn", hydro: "hydrogen" };
const num = v => fmt(v, v < 10 ? 2 : v < 100 ? 1 : 0);
const fuelOf = s => FUELS[s.fuel] ?? FUELS.xang;

// Any change of the mixture puts a fresh, unlit sample on the burner.
const unlit = (s, api) => {
  s.progress = 0;
  api.pause();
};

// Draw `text` centred on at most `max` lines; returns the y after the last line.
function wrapped(ctx, text, cx, y, width, { size, color, bold, max = 2 }) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width <= width || !lines.at(-1)) lines[lines.length - 1] = next;
    else lines.push(word);
  }
  lines.slice(0, max).forEach((line, i) => label(ctx, line, cx, y + size * 0.7 + i * (size + 4), { size, color, bold, align: "center" }));
  return y + Math.min(lines.length, max) * (size + 4);
}

function drawFlame(ctx, cx, base, h, t, complete) {
  const flick = 1 + 0.08 * Math.sin(t * 23) + 0.05 * Math.sin(t * 37);
  const shape = (hh, ww, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - ww, base);
    ctx.bezierCurveTo(cx - ww * 1.3, base - hh * 0.5, cx - ww * 0.2, base - hh * 0.7, cx + ww * 0.15 * Math.sin(t * 11), base - hh);
    ctx.bezierCurveTo(cx + ww * 0.2, base - hh * 0.7, cx + ww * 1.3, base - hh * 0.5, cx + ww, base);
    ctx.closePath();
    ctx.fill();
  };
  // enough oxygen: blue flame; too little: yellow, sooty flame
  shape(h * flick, h * 0.42, complete ? "#3f7df0" : "#f08c2e");
  shape(h * 0.6 * flick, h * 0.24, complete ? "#bcdcff" : "#f5d44a");
}

function drawBurner(ctx, s, b, p, box) {
  const { x, y, w, h, small } = box;
  const cx = x + w / 2;
  const base = y + h - (small ? 30 : 40);
  const fh = clamp(h * 0.26, 24, 80);
  const dw = clamp(w * 0.3, 26, 60);
  const bw = clamp(w * 0.56, 50, 130);
  const bh = clamp(h * 0.3, 30, 100);
  const standY = base - fh - 10;
  const burning = p > 0 && p < 1;
  // soot and CO rise beside the beaker
  if (p > 0 && (b.soot > 0 || b.co > 0)) {
    const t = p * BURN_TIME;
    for (let i = 0; i < 5; i++) {
      const f = (i / 5 + (burning ? t * 0.35 : 0)) % 1;
      ctx.fillStyle = b.soot > 0 ? `rgba(40, 44, 52, ${0.5 * (1 - f)})` : `rgba(120, 128, 140, ${0.35 * (1 - f)})`;
      ctx.beginPath();
      ctx.arc(cx + bw / 2 + 12 + 6 * Math.sin(i * 2.1), standY - f * (bh + 20), 5 + 6 * f, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, b.soot > 0 ? "khói đen: CO, muội than" : "khí CO (độc)", Math.min(cx + bw / 2 + 4, x + w - 2), standY - bh - 30, { size: small ? 10 : 12, color: COLORS.red, align: "right" });
  }
  if (burning) drawFlame(ctx, cx, base - 6, fh, p * BURN_TIME, b.complete);
  // fuel dish
  ctx.fillStyle = FUEL_COLOR[s.fuel] ?? COLORS.orange;
  ctx.globalAlpha = 0.25 + 0.6 * (1 - p);
  ctx.fillRect(cx - dw + 4, base - 6, 2 * dw - 8, 6);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - dw, base - 10);
  ctx.lineTo(cx - dw + 6, base);
  ctx.lineTo(cx + dw - 6, base);
  ctx.lineTo(cx + dw, base - 10);
  ctx.stroke();
  const left = fuelOf(s) ? s.mass * (1 - p) : 0;
  label(ctx, `${fuelOf(s).short}: còn ${num(left)} g`, cx, base + 13, { size: small ? 11 : 13, align: "center", bold: true });
  label(ctx, p === 0 ? "chưa đốt" : p < 1 ? "đang cháy…" : "đã cháy hết", cx, base + (small ? 26 : 30), { size: small ? 10 : 12, align: "center", color: COLORS.muted });
  // stand
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 - 8, base);
  ctx.lineTo(cx - bw / 2 - 8, standY);
  ctx.lineTo(cx + bw / 2 + 8, standY);
  ctx.lineTo(cx + bw / 2 + 8, base);
  ctx.stroke();
  // beaker of water; the water reddens as heat goes in
  const by = standY - bh - 1;
  ctx.fillStyle = `rgba(${Math.round(47 + 180 * p)}, ${Math.round(111 - 30 * p)}, ${Math.round(237 - 150 * p)}, 0.3)`;
  ctx.fillRect(cx - bw / 2, by + bh * 0.25, bw, bh * 0.75);
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, by);
  ctx.lineTo(cx - bw / 2, by + bh);
  ctx.lineTo(cx + bw / 2, by + bh);
  ctx.lineTo(cx + bw / 2, by);
  ctx.stroke();
  label(ctx, `${num(b.water * p)} kg`, cx, by + bh * 0.52, { size: small ? 12 : 15, bold: true, align: "center" });
  label(ctx, "nước", cx, by + bh * 0.52 + (small ? 13 : 17), { size: small ? 10 : 12, align: "center", color: COLORS.muted });
  label(ctx, `${T_COLD} °C → ${T_HOT} °C`, cx, by - 10, { size: small ? 10 : 12, align: "center", color: COLORS.muted });
}

function drawProducts(ctx, b, p, box) {
  const { x, y, w, h, small } = box;
  const size = small ? 11 : 13;
  const rows = [
    ["CO₂", b.co2, COLORS.muted],
    ["H₂O", b.h2o, COLORS.blue],
    ["CO (độc)", b.co, COLORS.red],
    [small ? "Muội C" : "Muội than (C)", b.soot, COLORS.ink],
  ];
  if (b.h2 > 0) rows.push([small ? "H₂ dư" : "H₂ chưa cháy", b.h2, COLORS.orange]);
  const nameW = small ? 50 : 96;
  const valueW = small ? 46 : 64;
  const rowH = clamp((h - 22) / rows.length, 16, 40);
  const top = y + Math.max(0, (h - 22 - rowH * rows.length) / 2);
  const max = Math.max(...rows.map(r => r[1]), 1e-9);
  label(ctx, "Khối lượng sản phẩm (g)", x, top + 8, { size, bold: true });
  rows.forEach(([name, value, color], i) => {
    const cy = top + 22 + rowH * (i + 0.5);
    const full = w - nameW - valueW;
    label(ctx, name, x, cy, { size, color: value > 0 ? COLORS.ink : COLORS.muted });
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(x + nameW, cy - rowH * 0.3, full, rowH * 0.6);
    ctx.fillStyle = color;
    ctx.fillRect(x + nameW, cy - rowH * 0.3, (full * value * p) / max, rowH * 0.6);
    label(ctx, num(value * p), x + w, cy, { size, align: "right", bold: true, color: value > 0 ? COLORS.ink : COLORS.muted });
  });
}

function drawCompare(ctx, s, view, small) {
  const size = small ? 11 : 13;
  const pad = small ? 12 : 28;
  label(ctx, "So sánh các nhiên liệu khi cháy hoàn toàn", view.w / 2, small ? 12 : 20, { size: small ? 13 : 17, bold: true, align: "center" });
  const charts = [
    ["Nhiệt lượng khi đốt 1 kg (MJ/kg)", "heat"],
    ["CO₂ sinh ra khi đốt 1 kg (kg)", "co2"],
    ["CO₂ cho mỗi MJ nhiệt lượng (g/MJ)", "co2PerMJ"],
  ];
  const top = small ? 26 : 44;
  const footH = 4 * (size + 4) + 8;
  const columns = view.w >= 760 ? 3 : 1;
  const cw = (view.w - 2 * pad - (columns - 1) * 28) / columns;
  const room = (view.h - top - footH) / (charts.length / columns);
  const ch = Math.min(room, 280);
  const lift = columns === 3 ? (room - ch) / 2 : 0;
  const nameW = small ? 38 : 48;
  const valueW = small ? 40 : 50;
  charts.forEach(([title, key], k) => {
    const x = pad + (columns === 3 ? k * (cw + 28) : 0);
    const y = top + lift + (columns === 3 ? 0 : k * ch);
    const rowH = clamp((ch - size - 12) / FUEL_IDS.length, 9, 34);
    const max = Math.max(...FUEL_IDS.map(id => perKg(id)[key]));
    label(ctx, title, x, y + size / 2 + 2, { size, bold: true });
    FUEL_IDS.forEach((id, i) => {
      const cy = y + size + 8 + rowH * (i + 0.5);
      const value = perKg(id)[key];
      const picked = s.pick === id;
      label(ctx, FUELS[id].short, x, cy, { size: Math.min(size, rowH + 1), bold: picked, color: picked ? COLORS.ink : COLORS.muted });
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(x + nameW, cy - rowH * 0.36, cw - nameW - valueW, rowH * 0.72);
      ctx.fillStyle = FUEL_COLOR[id];
      ctx.fillRect(x + nameW, cy - rowH * 0.36, ((cw - nameW - valueW) * value) / max, rowH * 0.72);
      label(ctx, num(value), x + cw, cy, { size: Math.min(size, rowH + 1), align: "right", bold: picked });
    });
  });
  const best = leastCo2Fuel();
  const message = !FUELS[s.pick]
    ? "Câu hỏi: để thu cùng một nhiệt lượng, nhiên liệu nào thải ra ít CO₂ nhất? Hãy chọn ở bảng điều khiển."
    : s.pick === best
      ? "Đúng: hydrogen cháy chỉ tạo ra nước, không sinh ra CO₂."
      : `Chưa đúng: ${NAME[s.pick]} thải ${num(perKg(s.pick).co2PerMJ)} g CO₂ cho mỗi MJ. Hãy xem biểu đồ thứ ba.`;
  const y = wrapped(ctx, message, view.w / 2, view.h - footH, view.w - 2 * pad, { size, bold: true, color: !FUELS[s.pick] ? COLORS.ink : s.pick === best ? COLORS.green : COLORS.red });
  wrapped(ctx, "Chỉ tính CO₂ sinh ra khi đốt; khâu sản xuất nhiên liệu (kể cả hydrogen) có thể phát thải thêm.", view.w / 2, y + 2, view.w - 2 * pad, { size: size - 1, color: COLORS.muted });
}

mount({
  slug: "nhien-lieu",
  version: "1.0.0",
  title: "Nhiên liệu và sự đốt cháy",
  hint: "Chọn nhiên liệu và lượng không khí rồi bấm Đốt. Thiếu oxygen thì nhiên liệu cháy không hoàn toàn.",
  initialState,
  step(s, dt, api) {
    if (!step(s, dt)) return;
    api.pause();
    const b = burn(s.fuel, s.mass, s.air);
    const data = { heat: b.heat, co2: b.co2, co: b.co, soot: b.soot, water: b.water, mass: s.mass, air: s.air };
    api.emit("burned", data, "result");
  },
  controls: [
    { type: "select", key: "fuel", label: "Nhiên liệu", options: FUEL_IDS.map(id => ({ value: id, label: FUELS[id].label })), onChange: unlit },
    { type: "slider", key: "mass", label: "Khối lượng nhiên liệu", min: 10, max: 500, step: 10, unit: "g", digits: 0, onChange: unlit },
    {
      type: "slider",
      key: "air",
      label: "Lượng không khí",
      min: AIR_MIN,
      max: AIR_MAX,
      step: 5,
      format: v => `${fmt(v, 0)} % lượng cần`,
      onChange: unlit,
    },
    {
      type: "button",
      label: "Đốt",
      primary: true,
      action(s, api) {
        s.progress = 0;
        s.compare = false;
        api.play();
      },
      event: "ignite",
    },
    { type: "heading", label: "So sánh" },
    { type: "checkbox", key: "compare", label: "Hiện biểu đồ so sánh các nhiên liệu" },
    {
      type: "select",
      key: "pick",
      label: "Nhiên liệu thải ít CO₂ nhất cho cùng một nhiệt lượng",
      options: [{ value: "", label: "– chọn câu trả lời –" }, ...FUEL_IDS.map(id => ({ value: id, label: FUELS[id].short === "H₂" ? "Hydrogen" : FUELS[id].short }))],
      visible: s => s.compare,
      onCommit(s, api) {
        if (s.pick === leastCo2Fuel()) api.emit("least-co2-picked", { co2PerMJ: perKg(s.pick).co2PerMJ }, "goal");
      },
    },
  ],
  readouts: [
    { label: "Oxygen cần để cháy hoàn toàn", value: s => `${num(burn(s.fuel, s.mass, s.air).o2Needed)} mol` },
    { label: "Không khí cung cấp (đkc)", value: s => `${num(burn(s.fuel, s.mass, s.air).airVolume)} L` },
    { label: "Nhiệt lượng tỏa ra", value: s => `${num(burn(s.fuel, s.mass, s.air).heat * progress(s))} kJ` },
    { label: "CO₂ sinh ra", value: s => `${num(burn(s.fuel, s.mass, s.air).co2 * progress(s))} g` },
  ],
  draw(ctx, s, view) {
    const small = view.w < 480 || view.h < 400;
    if (s.compare) return drawCompare(ctx, s, view, small);
    const f = fuelOf(s);
    const b = burn(s.fuel, s.mass, s.air);
    const p = progress(s);
    const size = small ? 11 : 13;
    const pad = small ? 12 : 28;
    label(ctx, `${small ? "" : "Cháy hoàn toàn:  "}${pretty(equation(f))}`, view.w / 2, small ? 12 : 20, { size: small ? 13 : 17, bold: true, align: "center" });
    const status = b.complete
      ? "Đủ oxygen: nhiên liệu cháy hoàn toàn"
      : f.x === 0
        ? "Thiếu oxygen: một phần hydrogen không cháy"
        : b.soot > 0
          ? "Thiếu oxygen: cháy không hoàn toàn, sinh ra CO và muội than"
          : "Thiếu oxygen: cháy không hoàn toàn, sinh ra khí CO độc";
    label(ctx, status, view.w / 2, small ? 29 : 44, { size, align: "center", color: b.complete ? COLORS.green : COLORS.red, bold: true });
    const top = small ? 40 : 62;
    const footH = 4 * (size + 4) + 8;
    const h = Math.min(view.h - top - footH, 380);
    const y0 = top + (view.h - top - footH - h) / 2;
    const split = pad + (view.w - 2 * pad) * 0.42;
    drawBurner(ctx, s, b, p, { x: pad, y: y0, w: split - pad - 8, h, small });
    drawProducts(ctx, b, p, { x: split + 8, y: y0, w: view.w - pad - split - 8, h, small });
    const y = wrapped(ctx, `Nhiệt lượng tỏa ra Q = ${num(b.heat * p)} kJ, đủ đun nóng ${num(b.water * p)} kg nước từ ${T_COLD} °C lên ${T_HOT} °C (bỏ qua hao phí).`, view.w / 2, view.h - footH, view.w - 2 * pad, { size, bold: true, color: COLORS.ink });
    wrapped(ctx, "Mô hình đơn giản: mỗi nhiên liệu coi là một chất; khi thiếu oxygen, hydrogen cháy trước, carbon thành CO, phần còn lại thành muội than.", view.w / 2, y + 2, view.w - 2 * pad, { size: size - 1, color: COLORS.muted });
  },
});
