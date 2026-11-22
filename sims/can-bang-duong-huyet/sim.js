import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { SET, RANGE, RENAL, DAY, GLYCOGEN_MAX, CONDITIONS, LIMITS, initialState, parseEvents, addEvent, removeLast, simulate, goalReached, conditionOf, clock } from "./model.js";

const font = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const G_AXIS_MAX = 30; // mmol/L, the curve is clipped above this

// The day is a pure function of the schedule and the condition: compute it once per change.
const cache = new Map();
function dayOf(events, condition) {
  const key = `${condition}|${events}`;
  if (!cache.has(key)) {
    if (cache.size > 40) cache.clear();
    cache.set(key, simulate(events, CONDITIONS[condition] ?? CONDITIONS.healthy));
  }
  return cache.get(key);
}
const today = s => dayOf(s.events, CONDITIONS[s.condition] ? s.condition : "healthy");
const at = s => Math.round(Math.min(DAY, Math.max(0, s.time)));
const duration = min => (min >= 60 ? `${Math.floor(min / 60)} giờ ${min % 60} phút` : `${min} phút`);

// One result per finished change of the day (schedule or body), and the goal when the day stays in range.
function report(s, api) {
  const d = today(s);
  const condition = conditionOf(s).code;
  api.emit("day-simulated", { peak: d.peak, low: d.low, minutesAbove: d.above, minutesBelow: d.below, meals: d.meals, carbs: d.carbs, exercises: d.exercises, condition }, "result");
  if (goalReached(d)) api.emit("kept-in-range", { condition, meals: d.meals, carbs: d.carbs, exercises: d.exercises, peak: d.peak }, "goal");
}

function line(ctx, text, x, y, maxW, { size = 14, ...opts } = {}) {
  ctx.font = font(size, opts.bold);
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: w > maxW ? Math.max(8, (size * maxW) / w) : size });
}

function curve(ctx, values, X, Y, color, width, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let t = 0; t <= DAY; t += 3) ctx[t ? "lineTo" : "moveTo"](X(t), Y(values[t]));
  ctx.stroke();
  ctx.setLineDash([]);
}

function frame(ctx, r, X, small, labels) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= DAY; t += 180) {
    ctx.moveTo(X(t), r.y);
    ctx.lineTo(X(t), r.y + r.h);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  if (labels) for (let t = 0; t <= DAY; t += small ? 360 : 180) label(ctx, clock(t), X(t), r.y + r.h + (small ? 8 : 11), { size: small ? 10 : 12, align: "center", color: COLORS.muted });
}

// The two feedback loops, with the branch that is active at the cursor highlighted.
function loops(ctx, s, d, box, t) {
  const cond = conditionOf(s).code;
  const rows = [
    {
      on: d.insulin[t] > 0.05 || d.G[t] > SET + 0.2,
      color: COLORS.blue,
      steps: ["Glucose máu tăng (sau ăn)", cond === 1 ? "Tế bào β tuyến tụy tiết rất ít insulin" : "Tế bào β tuyến tụy tiết insulin", cond === 2 ? "Tế bào kém đáp ứng insulin,\nnhận ít glucose" : "Tế bào nhận glucose;\ngan: glucose → glycogen", cond === 0 ? "Glucose máu giảm" : "Glucose máu giảm chậm"],
    },
    { on: d.glucagon[t] > 0.05, color: COLORS.orange, steps: ["Glucose máu giảm (đói, vận động)", "Tế bào α tuyến tụy tiết glucagon", "Gan: glycogen → glucose", "Glucose máu tăng"] },
  ];
  const gap = 22;
  const bw = (box.w - 3 * gap) / 4;
  const bh = (box.h - 8) / 2;
  rows.forEach((row, i) => {
    const y = box.y + i * (bh + 8);
    row.steps.forEach((text, k) => {
      const x = box.x + k * (bw + gap);
      ctx.fillStyle = row.on ? "#fff" : COLORS.bg;
      ctx.strokeStyle = row.on ? row.color : COLORS.grid;
      ctx.lineWidth = row.on ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, 8);
      ctx.fill();
      ctx.stroke();
      const bad = (cond === 1 && i === 0 && k === 1) || (cond === 2 && i === 0 && k === 2);
      const parts = text.split("\n");
      parts.forEach((part, j) => {
        line(ctx, part, x + bw / 2, y + bh / 2 + (j - (parts.length - 1) / 2) * 15, bw - 10, { size: 12.5, align: "center", bold: row.on, color: bad ? COLORS.red : row.on ? COLORS.ink : COLORS.muted });
      });
      if (k < 3) arrow(ctx, x + bw + 3, y + bh / 2, x + bw + gap - 3, y + bh / 2, row.on ? row.color : COLORS.grid, 2);
    });
  });
}

mount({
  slug: "can-bang-duong-huyet",
  version: "1.0.0",
  title: "Cân bằng nội môi: điều hòa đường huyết",
  hint: "Thêm bữa ăn và vận động vào một ngày, rồi xem tuyến tụy và gan giữ nồng độ glucose máu ổn định như thế nào.",
  initialState,
  controls: [
    {
      type: "select",
      key: "condition",
      label: "Cơ thể",
      onCommit: report,
      options: [
        { value: "healthy", label: "Người khỏe mạnh" },
        { value: "type1", label: "Đái tháo đường type 1 (thiếu insulin)" },
        { value: "type2", label: "Đái tháo đường type 2 (kháng insulin)" },
      ],
    },
    { type: "checkbox", key: "compare", label: "So sánh với người khỏe mạnh (nét đứt)", visible: s => s.condition !== "healthy" },
    { type: "slider", key: "time", label: "Thời điểm", min: 0, max: DAY - 15, step: 15, format: v => clock(v) },
    { type: "heading", label: "Thêm sự kiện tại thời điểm đang chọn" },
    { type: "slider", key: "carbs", label: "Bữa ăn: lượng carbohydrate", min: LIMITS.carbs[0], max: LIMITS.carbs[1], step: 10, unit: "g", digits: 0 },
    {
      type: "button",
      label: "Thêm bữa ăn",
      primary: true,
      disabled: s => parseEvents(s.events).length >= LIMITS.events,
      action(s, api) {
        s.events = addEvent(s.events, { kind: "m", t: at(s), carbs: s.carbs });
        api.emit("meal-added", { time: at(s), carbs: s.carbs });
        report(s, api);
      },
    },
    { type: "slider", key: "minutes", label: "Vận động: thời gian", min: LIMITS.minutes[0], max: LIMITS.minutes[1], step: 10, unit: "phút", digits: 0 },
    {
      type: "select",
      key: "level",
      label: "Vận động: mức độ",
      options: [
        { value: 1, label: "Nhẹ (đi bộ)" },
        { value: 2, label: "Vừa (đạp xe, bơi)" },
        { value: 3, label: "Nặng (chạy nhanh)" },
      ],
    },
    {
      type: "button",
      label: "Thêm vận động",
      primary: true,
      disabled: s => parseEvents(s.events).length >= LIMITS.events,
      action(s, api) {
        s.events = addEvent(s.events, { kind: "x", t: at(s), minutes: s.minutes, level: s.level });
        api.emit("exercise-added", { time: at(s), minutes: s.minutes, level: s.level });
        report(s, api);
      },
    },
    {
      type: "button",
      label: "Xóa sự kiện muộn nhất",
      disabled: s => parseEvents(s.events).length === 0,
      action(s, api) {
        s.events = removeLast(s.events);
        api.emit("event-removed", { remaining: parseEvents(s.events).length });
        report(s, api);
      },
    },
    {
      type: "button",
      label: "Xóa tất cả sự kiện",
      disabled: s => parseEvents(s.events).length === 0,
      action(s, api) {
        s.events = "";
        api.emit("event-removed", { remaining: 0 });
        report(s, api);
      },
    },
  ],
  readouts: [
    { label: "Glucose máu cao nhất", value: s => `${fmt(today(s).peak, 1)} mmol/L` },
    { label: "Glucose máu thấp nhất", value: s => `${fmt(today(s).low, 1)} mmol/L` },
    { label: `Thời gian trên ${fmt(RANGE[1], 1)} mmol/L`, value: s => duration(today(s).above) },
    { label: "Cả ngày trong khoảng cho phép", value: s => (today(s).inRange ? "Có" : "Không") },
    { label: "Bữa ăn / carbohydrate", value: s => `${today(s).meals} bữa / ${fmt(today(s).carbs, 0)} g` },
  ],
  draw(ctx, s, view) {
    const d = today(s);
    const t = at(s);
    const small = view.w < 560 || view.h < 430;
    const fs = small ? 10.5 : 13;
    const x0 = small ? 26 : 50;
    const w = view.w - x0 - (small ? 8 : 18);
    const diagram = small ? 0 : Math.min(120, view.h * 0.18);
    const foot = small ? 30 : 50; // cursor line(s) and the note
    const top = small ? 16 : 32;
    const gap = small ? 34 : 50; // between the two charts: time labels, then the legend of the lower chart
    const free = view.h - top - diagram - foot - gap - (small ? 14 : 30);
    const main = { x: x0, y: top, w, h: free * 0.68 };
    const strip = { x: x0, y: main.y + main.h + gap, w, h: free * 0.32 };
    const X = m => x0 + (w * m) / DAY;
    const ghost = s.condition !== "healthy" && CONDITIONS[s.condition] && s.compare ? dayOf(s.events, "healthy") : null;

    // ---- glucose ----
    const yMax = Math.min(G_AXIS_MAX, Math.max(12, Math.ceil(d.peak + 1)));
    const Y = g => main.y + main.h - (main.h * Math.min(g, yMax)) / yMax;
    frame(ctx, main, X, small, true);
    ctx.fillStyle = "rgba(31, 157, 107, 0.14)";
    ctx.fillRect(main.x, Y(RANGE[1]), main.w, Y(RANGE[0]) - Y(RANGE[1]));
    const events = parseEvents(s.events);
    for (const e of events) {
      if (e.kind !== "x") continue;
      const x1 = Math.min(X(e.t + e.minutes), main.x + main.w);
      ctx.fillStyle = "rgba(122, 90, 248, 0.16)";
      ctx.fillRect(X(e.t), main.y, x1 - X(e.t), main.h);
      label(ctx, small ? "VĐ" : `vận động ${e.minutes}′`, (X(e.t) + x1) / 2, main.y + (small ? 8 : 11), { size: small ? 9 : 11, align: "center", color: COLORS.purple, bold: true });
    }
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    if (yMax > RENAL) {
      ctx.beginPath();
      ctx.moveTo(main.x, Y(RENAL));
      ctx.lineTo(main.x + main.w, Y(RENAL));
      ctx.stroke();
      label(ctx, small ? "ngưỡng thận" : "ngưỡng thận 10 mmol/L: glucose bị thải qua nước tiểu", main.x + main.w - 4, Y(RENAL) - 7, { size: small ? 9 : 11, align: "right", color: COLORS.red });
    }
    ctx.setLineDash([]);
    const stepY = yMax > 16 ? 5 : 2;
    for (let g = 0; g <= yMax; g += stepY) label(ctx, `${g}`, main.x - 5, Y(g), { size: small ? 10 : 12, align: "right", color: COLORS.muted });
    label(ctx, small ? "Glucose máu (mmol/L)" : "Nồng độ glucose trong máu (mmol/L)", main.x - (small ? 20 : 40), main.y - (small ? 8 : 16), { size: fs, bold: true });
    label(ctx, small ? `xanh: ${fmt(RANGE[0], 1)}–${fmt(RANGE[1], 1)}` : `vùng xanh: khoảng cho phép ${fmt(RANGE[0], 1)}–${fmt(RANGE[1], 1)} mmol/L`, main.x + main.w, main.y - (small ? 8 : 16), { size: small ? 9.5 : 12, align: "right", color: COLORS.green });
    if (ghost) curve(ctx, ghost.G, X, Y, COLORS.muted, 1.5, [5, 4]);
    curve(ctx, d.G, X, Y, COLORS.red, small ? 2 : 3);
    for (const e of events) {
      if (e.kind !== "m") continue;
      const x = X(e.t);
      const y = main.y + main.h;
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.moveTo(x, y - (small ? 11 : 15));
      ctx.lineTo(x + (small ? 5 : 7), y);
      ctx.lineTo(x - (small ? 5 : 7), y);
      ctx.closePath();
      ctx.fill();
      label(ctx, `${fmt(e.carbs, 0)} g`, x + (small ? 7 : 10), y - (small ? 6 : 8), { size: small ? 9 : 11, color: COLORS.ink, bold: true });
    }

    // ---- hormones and liver glycogen ----
    const hMax = Math.max(2, Math.max(...d.insulin), Math.max(...d.glucagon)) * 1.1;
    const YH = v => strip.y + strip.h - (strip.h * Math.min(v, hMax)) / hMax;
    const YP = v => strip.y + strip.h - (strip.h * 0.96 * v) / GLYCOGEN_MAX;
    frame(ctx, strip, X, small, false);
    curve(ctx, d.glycogen, X, YP, COLORS.purple, 1.5, [2, 3]);
    curve(ctx, d.insulin, X, YH, COLORS.blue, 2);
    curve(ctx, d.glucagon, X, YH, COLORS.orange, 2);
    let lx = strip.x - (small ? 20 : 40);
    for (const [text, color] of [["Insulin", COLORS.blue], ["Glucagon", COLORS.orange], [small ? "Glycogen gan (%)" : "Glycogen dự trữ ở gan (% tối đa, nét chấm)", COLORS.purple]]) {
      label(ctx, text, lx, strip.y - (small ? 8 : 12), { size: fs, bold: true, color });
      ctx.font = font(fs, true);
      lx += ctx.measureText(text).width + (small ? 10 : 18);
    }
    if (!small) label(ctx, "hormone: đơn vị tương đối", strip.x + strip.w, strip.y - 12, { size: 11, align: "right", color: COLORS.muted });

    // ---- cursor ----
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(t), main.y);
    ctx.lineTo(X(t), strip.y + strip.h);
    ctx.stroke();
    ctx.fillStyle = COLORS.red;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(t), Y(d.G[t]), small ? 4 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const now = `Lúc ${clock(t)}: glucose ${fmt(d.G[t], 1)} mmol/L · insulin ${fmt(d.insulin[t], 1)} · glucagon ${fmt(d.glucagon[t], 1)} · glycogen gan ${fmt((100 * d.glycogen[t]) / GLYCOGEN_MAX, 0)} %`;
    const note = small ? "Mô hình đơn giản hóa để minh họa, không dùng để chẩn đoán." : "Mô hình liên hệ ngược âm tính đã đơn giản hóa để minh họa; không dùng để chẩn đoán hay điều trị.";
    let y = strip.y + strip.h + (small ? 10 : 20);
    line(ctx, now, small ? 6 : x0, y, view.w - (small ? 12 : x0 + 18), { size: fs, bold: true });
    if (!small) {
      loops(ctx, s, d, { x: x0, y: y + 14, w, h: diagram - 8 }, t);
      y += diagram + 4;
    }
    line(ctx, note, small ? 6 : x0, y + (small ? 13 : 20), view.w - (small ? 12 : x0 + 18), { size: small ? 9 : 12, color: COLORS.muted });
  },
});
