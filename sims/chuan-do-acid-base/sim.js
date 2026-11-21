import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  DROP, BURETTE, TOLERANCE, INDICATORS, KA_ACETIC, initialState, acidOf, indicatorOf, titrant, equivalenceVolume, pHAt, pH, error,
  onTarget, addTitrant, restart, endTitration, indicatorColor,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const rgb = c => `rgb(${c.join(",")})`;
const fixed = (n, digits) => n.toFixed(digits).replace(".", ",").replace("-", "−");
const signed = n => (n > 0 ? "+" : "") + fixed(n, 2);
const pKa = -Math.log10(KA_ACETIC);

/** One addition from the burette, reported to the host. */
function add(s, api, amount) {
  const done = addTitrant(s, amount);
  if (done > 0) api.emit("add-titrant", { amount: done, volume: titrant(s), pH: pH(s) }, "action");
}

const addButton = (text, amount) => ({
  type: "button",
  label: text,
  disabled: s => s.ended || titrant(s) >= BURETTE,
  action: (s, api) => add(s, api, amount),
});

function layout(view) {
  const wide = view.w >= 560 && view.h >= 380;
  const pad = wide ? 16 : 8;
  const side = clamp(view.w * 0.26, 96, 230);
  const size = wide ? 13 : 11;
  const graph = {
    x0: side + (wide ? 44 : 30),
    x1: view.w - pad - 4,
    y0: wide ? 56 : 30,
    y1: view.h - (wide ? 52 : 26),
  };
  return { wide, pad, side, size, graph };
}

/** x-axis range: a little past twice the equivalence volume, in whole 5 mL, at most the burette. */
const vMax = s => Math.min(BURETTE, Math.max(10, Math.ceil((equivalenceVolume(s) * 2) / 5) * 5));

function drawApparatus(ctx, s, g, view) {
  const ind = indicatorColor(s.indicator, pH(s));
  const cx = g.pad + (g.side - g.pad) / 2;
  const top = g.wide ? 40 : 10;
  const bottom = view.h - (g.wide ? 16 : 6);
  const flaskH = clamp((bottom - top) * 0.36, 60, 170);
  const flaskW = Math.min(g.side - g.pad - 8, flaskH * 1.15);
  const fy1 = bottom; // flask base
  const fy0 = bottom - flaskH; // flask mouth
  const tubeTop = top;
  const tubeBot = fy0 - 26; // tip of the burette
  const tubeH = tubeBot - 22 - tubeTop; // graduated part
  const tw = g.wide ? 16 : 12;

  // burette: 0 mL at the top, 50 mL at the bottom of the graduated part
  const Yb = v => tubeTop + (tubeH * v) / BURETTE;
  ctx.fillStyle = "#e9f1ff";
  ctx.fillRect(cx - tw / 2, Yb(titrant(s)), tw, Yb(BURETTE) - Yb(titrant(s)) + 16);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - tw / 2, tubeTop, tw, tubeH + 16);
  ctx.beginPath(); // tip
  ctx.moveTo(cx - 3, tubeH + tubeTop + 16 + 6);
  ctx.lineTo(cx - 2, tubeBot);
  ctx.moveTo(cx + 3, tubeH + tubeTop + 16 + 6);
  ctx.lineTo(cx + 2, tubeBot);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink; // stopcock
  ctx.fillRect(cx - tw / 2 - 6, tubeH + tubeTop + 16, tw + 12, 6);
  for (let v = 0; v <= BURETTE; v += g.wide ? 5 : 10) {
    const y = Yb(v);
    const major = v % 10 === 0;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, y);
    ctx.lineTo(cx - tw / 2 + (major ? 8 : 5), y);
    ctx.stroke();
    if (major) label(ctx, String(v), cx - tw / 2 - 4, y, { size: g.size - 2, align: "right", color: COLORS.muted });
  }
  label(ctx, "mL", cx + tw / 2 + 4, tubeTop + 4, { size: g.size - 2, color: COLORS.muted });
  // level mark
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - tw / 2 - 2, Yb(titrant(s)));
  ctx.lineTo(cx + tw / 2 + 2, Yb(titrant(s)));
  ctx.stroke();
  label(ctx, `NaOH ${fmt(s.cb, 2)} M`, cx + tw / 2 + 4, (tubeTop + Yb(BURETTE)) / 2, { size: g.size - 1, color: COLORS.blue, bold: true });

  // Erlenmeyer flask
  const neck = flaskW * 0.22;
  const neckH = flaskH * 0.3;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - neck / 2, fy0);
    ctx.lineTo(cx - neck / 2, fy0 + neckH);
    ctx.lineTo(cx - flaskW / 2, fy1);
    ctx.lineTo(cx + flaskW / 2, fy1);
    ctx.lineTo(cx + neck / 2, fy0 + neckH);
    ctx.lineTo(cx + neck / 2, fy0);
  };
  const total = s.va + titrant(s);
  const level = fy1 - (flaskH - neckH) * clamp(0.25 + (0.6 * total) / 75, 0, 0.95);
  ctx.save();
  path();
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = rgb(ind.rgb);
  ctx.globalAlpha = 0.85;
  ctx.fillRect(cx - flaskW / 2, level, flaskW, fy1 - level);
  ctx.restore();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  path();
  ctx.stroke();
  const ink = ind.t > 0.5 && s.indicator !== "methylOrange" ? "#fff" : COLORS.ink;
  if (g.wide) {
    label(ctx, `${acidOf(s).formula} ${fmt(s.va, 0)} mL`, cx, fy1 - 10, { size: g.size - 1, align: "center", bold: true, color: ink });
    label(ctx, `${fmt(s.ca, 2)} M`, cx, fy1 - 10 - g.size, { size: g.size - 1, align: "center", color: ink });
  } else {
    label(ctx, acidOf(s).formula, cx, fy1 - 9, { size: g.size - 1, align: "center", bold: true, color: ink });
  }
  label(ctx, ind.name, cx, fy0 - 10, { size: g.size, align: "center", bold: true });
}

function drawGraph(ctx, s, g) {
  const { x0, x1, y0, y1 } = g.graph;
  const size = g.size;
  const vm = vMax(s);
  const X = v => x0 + ((x1 - x0) * v) / vm;
  const Y = p => y1 - ((y1 - y0) * clamp(p, 0, 14)) / 14;
  const ind = indicatorOf(s);

  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // the indicator's colour-change range
  const band = ctx.createLinearGradient(0, Y(ind.lo), 0, Y(ind.hi));
  band.addColorStop(0, rgb(ind.colors[0]));
  band.addColorStop(1, rgb(ind.colors[1]));
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = band;
  ctx.fillRect(x0, Y(ind.hi), x1 - x0, Y(ind.lo) - Y(ind.hi));
  ctx.globalAlpha = 1;
  label(ctx, g.wide ? `khoảng đổi màu ${ind.name.toLowerCase()}` : "đổi màu", x1 - 4, (Y(ind.lo) + Y(ind.hi)) / 2, { size: size - 1, align: "right", color: COLORS.muted });

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let p = 0; p <= 14; p += 2) {
    ctx.beginPath();
    ctx.moveTo(x0, Y(p));
    ctx.lineTo(x1, Y(p));
    ctx.stroke();
    label(ctx, String(p), x0 - 5, Y(p), { size, align: "right", color: COLORS.muted });
  }
  const dv = vm > 30 ? 10 : 5;
  for (let v = 0; v <= vm; v += dv) {
    ctx.beginPath();
    ctx.moveTo(X(v), y0);
    ctx.lineTo(X(v), y1);
    ctx.stroke();
    if (X(v) < x1 - size * 5) label(ctx, String(v), X(v), y1 + size * 0.9, { size, align: "center", color: COLORS.muted });
  }
  label(ctx, "pH", x0 - (g.wide ? 30 : 22), y0 - size * 0.9, { size, bold: true, color: COLORS.muted });
  label(ctx, g.wide ? "V NaOH (mL)" : "V (mL)", x1, y1 + size * 0.9, { size, align: "right", color: COLORS.muted });
  // pH = 7
  ctx.strokeStyle = COLORS.green;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, Y(7));
  ctx.lineTo(x1, Y(7));
  ctx.stroke();
  ctx.setLineDash([]);

  const curve = (to, n) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const v = (to * i) / n;
      if (i) ctx.lineTo(X(v), Y(pHAt(s, v)));
      else ctx.moveTo(X(v), Y(pHAt(s, v)));
    }
    ctx.stroke();
  };
  ctx.lineJoin = "round";
  if (s.showCurve) {
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    curve(vm, 400);
    ctx.setLineDash([]);
  }
  const v = titrant(s);
  if (v > 0) {
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 2.5;
    curve(Math.min(v, vm), Math.max(2, Math.round(400 * Math.min(v, vm) / vm)));
  }
  if (v <= vm) {
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(X(v), Y(pH(s)), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.ended) {
    const ve = equivalenceVolume(s);
    ctx.strokeStyle = COLORS.orange;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(X(ve), y0);
    ctx.lineTo(X(ve), y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(X(ve), Y(pHAt(s, ve)), 4, 0, Math.PI * 2);
    ctx.fill();
    const right = X(ve) > (x0 + x1) / 2;
    label(ctx, `${g.wide ? "V tương đương = " : ""}${fixed(ve, 2)} mL`, X(ve) + (right ? -6 : 6), y0 + size, { size, bold: true, align: right ? "right" : "left", color: COLORS.orange });
  }
  if (s.acid === "weak" && g.wide && s.showCurve) {
    const half = equivalenceVolume(s) / 2;
    ctx.fillStyle = COLORS.purple;
    ctx.beginPath();
    ctx.arc(X(half), Y(pKa), 3.5, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, `½V tương đương: pH = pKₐ = ${fixed(pKa, 2)}`, X(half) + 8, Y(pKa) + size, { size: size - 1, color: COLORS.purple });
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function drawHeader(ctx, s, g) {
  const { x0 } = g.graph;
  const size = g.wide ? 16 : 12;
  const y = g.wide ? 18 : 10;
  const text = `V = ${fixed(titrant(s), 2)} mL${g.wide ? "    " : "  "}pH = ${fixed(pH(s), 2)}`;
  label(ctx, text, x0, y, { size, bold: true });
  if (s.ended) {
    ctx.font = `600 ${size}px ${FONT}`;
    const x = x0 + ctx.measureText(text).width + 14;
    const hit = onTarget(s);
    const verdict = hit ? (g.wide ? "Đúng điểm tương đương" : "Đạt") : `${g.wide ? "Sai số " : ""}${signed(error(s))} mL`;
    label(ctx, verdict, x, y, { size: size - 2, bold: true, color: hit ? COLORS.green : COLORS.red });
  }
  if (g.wide) {
    const eq = s.acid === "weak" ? "CH₃COOH + NaOH → CH₃COONa + H₂O" : "HCl + NaOH → NaCl + H₂O";
    label(ctx, `${eq}   ·   25 °C, thể tích cộng được`, x0, 40, { size: 12, color: COLORS.muted });
  }
}

mount({
  slug: "chuan-do-acid-base",
  version: "1.0.0",
  title: "Chuẩn độ acid – base",
  hint: "Nhỏ dung dịch NaOH từ burette vào bình acid. Dừng lại khi chất chỉ thị vừa đổi màu rồi bấm “Kết thúc chuẩn độ”.",
  initialState,
  controls: [
    {
      type: "select",
      key: "acid",
      label: "Acid trong bình tam giác",
      options: [
        { value: "strong", label: "HCl (acid mạnh)" },
        { value: "weak", label: "CH₃COOH (acid yếu)" },
      ],
      onChange: restart,
    },
    { type: "slider", key: "ca", label: "Nồng độ acid", min: 0.05, max: 0.15, step: 0.01, unit: "M", digits: 2, onChange: restart },
    { type: "slider", key: "va", label: "Thể tích acid", min: 10, max: 25, step: 1, unit: "mL", digits: 0, onChange: restart },
    { type: "slider", key: "cb", label: "Nồng độ NaOH trong burette", min: 0.1, max: 0.2, step: 0.01, unit: "M", digits: 2, onChange: restart },
    {
      type: "select",
      key: "indicator",
      label: "Chất chỉ thị",
      options: Object.entries(INDICATORS).map(([value, ind]) => ({ value, label: `${ind.name} (pH ${fmt(ind.lo, 1)}–${fmt(ind.hi, 1)})` })),
    },
    { type: "heading", label: "Nhỏ dung dịch từ burette" },
    addButton(`Nhỏ 1 giọt (${fmt(DROP, 2)} mL)`, DROP),
    addButton("Thêm 0,5 mL", 0.5),
    addButton("Thêm 1 mL", 1),
    addButton("Thêm 5 mL", 5),
    {
      type: "button",
      label: "Kết thúc chuẩn độ",
      primary: true,
      disabled: s => s.ended || titrant(s) <= 0,
      action(s, api) {
        const r = endTitration(s);
        api.emit("titration-ended", r, "result");
        if (onTarget(s)) api.emit("end-point-hit", { volumeAdded: r.volumeAdded, equivalenceVolume: r.equivalenceVolume, error: r.error }, "goal");
      },
    },
    { type: "button", label: "Làm lại (bình acid mới, nạp đầy burette)", action: restart, event: "refill" },
    { type: "checkbox", key: "showCurve", label: "Hiện đường chuẩn độ lí thuyết (nét đứt)" },
  ],
  readouts: [
    { label: "NaOH đã thêm", value: s => `${fixed(titrant(s), 2)} mL` },
    { label: "pH", value: s => fixed(pH(s), 2) },
    { label: "Màu chỉ thị", value: s => indicatorColor(s.indicator, pH(s)).name },
    { label: "V tương đương (C₁V₁ = C₂V₂)", value: s => (s.ended ? `${fixed(equivalenceVolume(s), 2)} mL` : "bấm Kết thúc để xem") },
    { label: "Sai số so với điểm tương đương", value: s => (s.ended ? `${signed(error(s))} mL` : "–") },
  ],
  draw(ctx, s, view) {
    const g = layout(view);
    drawApparatus(ctx, s, g, view);
    drawGraph(ctx, s, g);
    drawHeader(ctx, s, g);
    if (g.wide) label(ctx, `Dừng trong khoảng ±${fmt(TOLERANCE, 2)} mL quanh điểm tương đương là đạt. Hình không theo tỉ lệ.`, g.graph.x0, view.h - 12, { size: 12, color: COLORS.muted });
  },
});
