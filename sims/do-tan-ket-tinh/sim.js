import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { TEMPS, SOLUTES, GAS, LIMITS, STATUS, initialState, solubility, gasSolubility, analyse, predictionOk } from "./model.js";

const CURVE = { KNO3: COLORS.red, NaCl: COLORS.green, CuSO4: COLORS.blue, KCl: COLORS.orange };
const Y_MAX = 250; // g / 100 g water, left axis
const GAS_MAX = 10; // mg / 100 g water, right axis
const STATUS_TEXT = {
  [STATUS.unsaturated]: ["Dung dịch chưa bão hòa", COLORS.green],
  [STATUS.saturated]: ["Dung dịch bão hòa", COLORS.orange],
  [STATUS.supersaturated]: ["Dung dịch quá bão hòa (không bền)", COLORS.red],
};

const rand = i => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

// Any change of the experiment hides the answer again, so the learner can predict it.
const hide = s => {
  s.checked = false;
};
// One result per finished change of the experiment.
const report = (s, api) => {
  const a = analyse(s);
  api.emit(
    "cooled",
    { dissolved: a.dissolved, crystallised: a.crystallised, dissolvedHot: a.dissolved1, solubility: a.s2, t1: s.t1, t2: s.t2, water: a.water, status: a.status },
    "result"
  );
};
const experiment = c => ({ ...c, onChange: hide, onCommit: report });

function drawGraph(ctx, s, a, g, small) {
  const { x0, x1, y0, y1 } = g;
  const X = t => x0 + ((x1 - x0) * t) / 100;
  const Y = v => y1 - ((y1 - y0) * Math.min(v, Y_MAX)) / Y_MAX;
  const fs = small ? 10 : 12;

  // grid and axes
  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= 100; t += 10) {
    ctx.moveTo(X(t), y0);
    ctx.lineTo(X(t), y1);
  }
  for (let v = 0; v <= Y_MAX; v += 50) {
    ctx.moveTo(x0, Y(v));
    ctx.lineTo(x1, Y(v));
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  for (let t = 0; t <= 100; t += 20) label(ctx, `${t}`, X(t), y1 + 10, { size: fs, align: "center", color: COLORS.muted });
  for (let v = 0; v <= Y_MAX; v += 50) label(ctx, `${v}`, x0 - 5, Y(v), { size: fs, align: "right", color: COLORS.muted });
  label(ctx, small ? "t (°C)" : "Nhiệt độ (°C)", x1, y1 + (small ? 21 : 26), { size: fs, align: "right", color: COLORS.ink });
  label(ctx, small ? "S (g/100 g nước)" : "Độ tan S (g chất tan / 100 g nước)", x0 - (small ? 26 : 34), y0 - (small ? 10 : 16), { size: fs });

  // gas curve on its own axis (milligrams)
  if (s.showGas) {
    const YG = v => y1 - ((y1 - y0) * v) / GAS_MAX;
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    TEMPS.forEach((t, i) => ctx[i ? "lineTo" : "moveTo"](X(t), YG(GAS.table[i])));
    ctx.moveTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let v = 0; v <= GAS_MAX; v += 2) label(ctx, `${v}`, x1 + 5, YG(v), { size: fs, color: COLORS.purple });
    label(ctx, small ? "O₂ (mg)" : "O₂ (mg / 100 g nước)", x1 + (small ? 24 : 30), y0 - (small ? 10 : 16), { size: fs, align: "right", color: COLORS.purple });
    ctx.fillStyle = COLORS.purple;
    ctx.beginPath();
    ctx.arc(X(s.t2), YG(gasSolubility(s.t2)), small ? 3 : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // solubility curves; the chosen solute is drawn last and thick
  const keys = [...Object.keys(SOLUTES).filter(k => k !== a.key), a.key];
  for (const key of keys) {
    ctx.strokeStyle = CURVE[key];
    ctx.lineWidth = key === a.key ? 3.5 : 1.5;
    ctx.globalAlpha = key === a.key ? 1 : 0.7;
    ctx.lineJoin = "round";
    ctx.beginPath();
    TEMPS.forEach((t, i) => ctx[i ? "lineTo" : "moveTo"](X(t), Y(SOLUTES[key].table[i])));
    ctx.stroke();
    if (key === a.key) {
      ctx.fillStyle = CURVE[key];
      for (const [i, t] of TEMPS.entries()) {
        ctx.beginPath();
        ctx.arc(X(t), Y(SOLUTES[key].table[i]), small ? 2 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // legend, top left (every curve is low there)
  const rows = [...Object.keys(SOLUTES).map(k => [SOLUTES[k].formula, CURVE[k], k === a.key]), ...(s.showGas ? [[small ? "O₂ (trục phải)" : "O₂ – chất khí (trục phải)", COLORS.purple, false]] : [])];
  const lh = small ? 12 : 17;
  rows.forEach(([text, color, bold], i) => {
    const ly = y0 + 8 + lh * i;
    ctx.fillStyle = color;
    ctx.fillRect(x0 + 8, ly - 2, small ? 12 : 18, bold ? 4 : 2);
    label(ctx, text, x0 + (small ? 24 : 32), ly, { size: fs, bold, color: bold ? COLORS.ink : COLORS.muted });
  });

  // the experiment as a path: dissolve at t1, move to t2 at constant content, drop onto the curve
  const c1 = (a.dissolved1 / a.water) * 100; // g per 100 g water held in solution at t1
  const c2 = (a.dissolved / a.water) * 100;
  const p1 = [X(s.t1), Y(c1)];
  const p2 = [X(s.t2), Y(c1)];
  const p3 = [X(s.t2), Y(c2)];
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(p1[0], y1);
  ctx.lineTo(p1[0], p1[1]);
  ctx.moveTo(p3[0], y1);
  ctx.lineTo(p3[0], p3[1]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (Math.abs(p2[0] - p1[0]) > 14) arrow(ctx, p1[0], p1[1], p2[0], p2[1], COLORS.ink, 2);
  if (p3[1] - p2[1] > 14) arrow(ctx, p2[0], p2[1], p3[0], p3[1], COLORS.purple, 2);
  const dot = ([x, y], color, name, dy) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, small ? 4.5 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, name, x, y + dy, { size: fs + 1, bold: true, align: "center" });
  };
  dot(p1, COLORS.ink, "", 0);
  label(ctx, "t₁", p1[0] + (small ? 7 : 10), p1[1] + (small ? 8 : 11), { size: fs + 1, bold: true });
  dot(a.status === STATUS.supersaturated ? p2 : p3, STATUS_TEXT[a.status][1], "t₂", a.status === STATUS.supersaturated ? -(small ? 11 : 15) : small ? 12 : 16);
  if (p3[1] - p2[1] > 34 && !small) label(ctx, "kết tinh", p2[0] + 8, (p2[1] + p3[1]) / 2, { size: 12, color: COLORS.purple });
}

function drawBeaker(ctx, s, a, b, small) {
  const { x, y, w, h } = b;
  const top = y + h - (h * 0.92 * a.water) / LIMITS.water[1];
  // solution; CuSO4 is blue, deeper when more is dissolved
  ctx.fillStyle = "#e4f1fb";
  ctx.fillRect(x, top, w, y + h - top);
  if (a.key === "CuSO4") {
    ctx.fillStyle = `rgba(23, 111, 224, ${Math.min(0.8, (0.9 * a.dissolved) / a.water)})`;
    ctx.fillRect(x, top, w, y + h - top);
  }
  // crystals at the bottom: one per 2.5 g, at fixed pseudo-random places so they do not jump about
  const n = Math.min(120, Math.ceil(a.solid / 2.5));
  const size = small ? 5 : 10;
  const perRow = Math.max(3, Math.floor((w - 6) / (size * 1.5)));
  ctx.fillStyle = a.key === "CuSO4" ? "#2a62c9" : "#ffffff";
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const cx = x + 4 + size * 0.75 + ((i % perRow) + (row % 2) * 0.5 + (rand(i + 1) - 0.5) * 0.4) * ((w - 8 - size * 1.5) / (perRow - 0.5));
    const cy = y + h - size * 0.7 - row * size * 1.15;
    if (cy < top + size) break;
    const r = size * (0.55 + 0.25 * rand(i + 99));
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // glass
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = small ? 2 : 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 4);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w + 5, y - 4);
  ctx.stroke();
  const fs = small ? 10 : 13;
  label(ctx, `${fmt(s.t2, 0)} °C`, x + w / 2, y - (small ? 12 : 18), { size: fs + 1, bold: true, align: "center", color: s.t2 < s.t1 ? COLORS.blue : s.t2 > s.t1 ? COLORS.red : COLORS.ink });
  label(ctx, `${fmt(a.water, 0)} g nước`, x + w / 2, Math.min(top + (small ? 9 : 14), y + h - 10), { size: fs, align: "center", color: COLORS.muted });
}

mount({
  slug: "do-tan-ket-tinh",
  version: "1.0.0",
  title: "Độ tan và sự kết tinh",
  hint: "Hòa tan chất rắn ở nhiệt độ t₁, làm nguội đến t₂ rồi dự đoán khối lượng chất kết tinh.",
  initialState,
  controls: [
    experiment({ type: "select", key: "solute", label: "Chất tan", options: Object.entries(SOLUTES).map(([value, o]) => ({ value, label: `${o.formula} – ${o.name}` })) }),
    experiment({ type: "slider", key: "water", label: "Khối lượng nước", min: LIMITS.water[0], max: LIMITS.water[1], step: 10, unit: "g", digits: 0 }),
    experiment({ type: "slider", key: "added", label: "Khối lượng chất tan cho vào", min: LIMITS.added[0], max: LIMITS.added[1], step: 1, unit: "g", digits: 0 }),
    experiment({ type: "slider", key: "t1", label: "Nhiệt độ hòa tan t₁", min: 0, max: 100, step: 1, unit: "°C", digits: 0 }),
    experiment({ type: "slider", key: "t2", label: "Nhiệt độ lúc sau t₂", min: 0, max: 100, step: 1, unit: "°C", digits: 0 }),
    experiment({ type: "checkbox", key: "seed", label: "Có mầm tinh thể (bỏ chọn: để yên, dung dịch có thể quá bão hòa)" }),
    { type: "checkbox", key: "showGas", label: "Hiện đường độ tan của khí O₂" },
    { type: "heading", label: "Dự đoán" },
    { type: "slider", key: "guess", label: "Khối lượng kết tinh dự đoán", min: 0, max: 250, step: 0.5, unit: "g", digits: 1, disabled: s => s.checked },
    {
      type: "button",
      label: "Kiểm tra dự đoán",
      primary: true,
      disabled: s => s.checked,
      action(s, api) {
        const m = analyse(s).crystallised;
        s.checked = true;
        api.emit("prediction-checked", { guess: s.guess, crystallised: m, error: s.guess - m });
        if (predictionOk(s.guess, m)) api.emit("prediction-correct", { guess: s.guess, crystallised: m }, "goal");
      },
    },
  ],
  readouts: [
    { label: "Độ tan ở t₁", value: s => `${fmt(analyse(s).s1, 1)} g/100 g nước` },
    { label: "Độ tan ở t₂", value: s => `${fmt(analyse(s).s2, 1)} g/100 g nước` },
    { label: "Đã tan ở t₁", value: s => `${fmt(analyse(s).dissolved1, 1)} g` },
    { label: "Khối lượng kết tinh", value: s => (s.checked ? `${fmt(analyse(s).crystallised, 1)} g` : "? (hãy dự đoán)") },
    { label: "Trạng thái ở t₂", value: s => STATUS_TEXT[analyse(s).status][0] },
    { label: "Độ tan của O₂ ở t₂ (1 atm)", value: s => `${fmt(gasSolubility(s.t2), 2)} mg/100 g nước` },
  ],
  draw(ctx, s, view) {
    const a = analyse(s);
    const small = view.w < 560 || view.h < 430;
    const fs = small ? 10.5 : 14;
    const lh = small ? 13 : 21;
    const lines = small ? 4 : 5;
    const textTop = view.h - lines * lh - (small ? 2 : 10);
    const bw = small ? Math.min(64, view.w * 0.18) : Math.min(210, view.w * 0.22);
    const g = {
      x0: small ? 30 : 58,
      x1: view.w - bw - (small ? 44 : 96),
      y0: small ? 20 : 44,
      y1: textTop - (small ? 30 : 48),
    };
    drawGraph(ctx, s, a, g, small);
    const bh = Math.min((g.y1 - g.y0) * (small ? 0.8 : 0.72), bw * 1.5);
    drawBeaker(ctx, s, a, { x: view.w - bw - (small ? 8 : 24), y: g.y1 - bh, w: bw, h: bh }, small);

    // worked calculation
    const o = SOLUTES[a.key];
    const cap = (S, m) => (a.water === 100 ? `${fmt(m, 1)} g` : `${fmt(S, 1)} · ${fmt(a.water, 0)}/100 = ${fmt(m, 1)} g`);
    const [statusText, statusColor] = STATUS_TEXT[a.status];
    const m = fmt(a.crystallised, 1);
    let kt;
    if (!s.checked) kt = small ? "m kết tinh = ? Hãy dự đoán rồi bấm Kiểm tra." : "Khối lượng kết tinh = ? Hãy dự đoán rồi bấm “Kiểm tra dự đoán”.";
    else if (a.status === STATUS.supersaturated) kt = "Chưa kết tinh: thiếu mầm tinh thể, lượng chất tan vượt quá độ tan.";
    else if (a.crystallised > 0) kt = `m kết tinh = ${fmt(a.dissolved1, 1)} − ${fmt(a.cap2, 1)} = ${m} g`;
    else kt = "Không có chất kết tinh thêm (m kết tinh = 0 g).";
    const text = [
      [`${o.formula} · t₁ = ${fmt(s.t1, 0)} °C: S = ${fmt(a.s1, 1)} → tan tối đa ${cap(a.s1, a.cap1)}; đã tan ${fmt(a.dissolved1, 1)} g`, {}],
      [`t₂ = ${fmt(s.t2, 0)} °C: S = ${fmt(a.s2, 1)} → tan tối đa ${cap(a.s2, a.cap2)}`, {}],
      [kt, { bold: true, color: COLORS.purple }],
      [statusText + (a.undissolved1 > 0 ? ` · ở t₁ còn ${fmt(a.undissolved1, 1)} g chưa tan` : ""), { bold: true, color: statusColor }],
    ];
    if (!small) {
      text.push([
        (a.key === "CuSO4" ? "Quy ước: tính theo CuSO₄ khan, bỏ qua nước kết tinh. " : "") + "Đường độ tan nối thẳng các điểm số liệu cách nhau 10 °C; O₂ đo ở áp suất 1 atm.",
        { color: COLORS.muted, size: 12 },
      ]);
    } else if (a.key === "CuSO4") {
      text[3][0] += " · tính theo CuSO₄ khan";
    }
    text.forEach(([t, opts], i) => label(ctx, t, small ? 6 : 20, textTop + lh * (i + 0.5), { size: fs, ...opts }));
  },
});
