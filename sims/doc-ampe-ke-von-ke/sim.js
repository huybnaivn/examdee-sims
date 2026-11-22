import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  initialState, METERS, DIVISIONS, meterOf, rangeOf, smallestDivision, measure, bulbCurrent, checkAnswer, newTask, toMilli,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const rad = deg => (deg * Math.PI) / 180;
const practice = s => s.mode === "practice";
const inSeries = s => (s.meter === "voltmeter") === (s.wiring === "wrong"); // where the meter sits in the circuit
const clearFeedback = s => {
  s.feedback = "";
};

// One result per chosen range. Off-scale needle: no `reading` key, overload / reversed say why.
const reportRange = (s, api) => {
  const m = measure(s);
  api.emit("range-selected", { range: m.range, ...(m.reading != null && { reading: m.reading }), overload: m.overload ? 1 : 0, reversed: m.reversed ? 1 : 0 }, "result");
};

function status(s, m) {
  const { unit, milli } = meterOf(s);
  const amp = s.meter !== "voltmeter";
  if (s.wiring === "wrong") {
    return amp
      ? ["Ampe kế mắc song song với đèn gây đoản mạch, có thể hỏng ampe kế! Ampe kế phải mắc nối tiếp.", COLORS.red]
      : ["Vôn kế mắc nối tiếp: đèn không sáng, số chỉ gần bằng U nguồn. Vôn kế phải mắc song song với đèn.", COLORS.red];
  }
  if (m.reversed) return ["Kim lệch ngược: mắc sai cực. Chốt (+) của dụng cụ đo phải nối về phía cực dương của nguồn.", COLORS.red];
  if (m.overload) return [`Kim vượt quá thang đo ${fmt(m.range)} ${unit}, không đọc được và có thể hỏng dụng cụ. Hãy chọn thang lớn hơn.`, COLORS.red];
  const reading = `${fmt(m.reading)} ${unit} = ${fmt(toMilli(m.reading), 0)} ${milli}`;
  if (!practice(s)) {
    const n = Math.round(m.reading / m.division);
    const finer = m.best < m.range ? ` Thang ${fmt(m.best)} ${unit} sẽ đọc chính xác hơn.` : "";
    return [`Số chỉ: ${n} vạch × ${fmt(m.division)} ${unit} = ${reading}.${finer}`, finer ? COLORS.orange : COLORS.ink];
  }
  if (s.feedback === "correct") return [`Đúng! Số chỉ là ${reading}.`, COLORS.green];
  if (s.feedback === "range") return [`Đọc đúng, nhưng thang ${fmt(m.best)} ${unit} có ĐCNN nhỏ hơn nên chính xác hơn. Hãy đổi thang và đọc lại.`, COLORS.orange];
  if (s.feedback === "wrong") return [`Chưa đúng. Đếm số vạch từ vạch 0 rồi nhân với ĐCNN ${fmt(m.division)} ${unit}.`, COLORS.red];
  return ["Chọn thang đo phù hợp, đọc số chỉ của kim rồi bấm Kiểm tra.", COLORS.ink];
}

// Centred text, wrapped to maxW.
function para(ctx, text, cx, y, maxW, size, color, lineH) {
  ctx.font = `${size}px ${FONT}`;
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width > maxW && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  lines.forEach((line, i) => label(ctx, line, cx, y + i * lineH, { size, color, align: "center" }));
}

function geom(s, view) {
  const small = view.w < 520 || view.h < 420;
  const th = small ? 6 : 12; // gap above the meter
  const sh = small ? 46 : 58; // status text under the meter
  const R = Math.max(40, Math.min((view.w - 16) / 1.9, (view.h * 0.62 - th - sh) / 1.2));
  const cx = view.w / 2;
  const body = { x: cx - 0.95 * R, y: th, w: 1.9 * R, h: 1.2 * R };
  const top = body.y + body.h + sh; // circuit region
  const bottom = view.h - 4;
  const dmm = practice(s) || s.showDigital;
  const dw = dmm ? clamp(view.w * 0.3, 100, 190) : 0;
  const d = small ? 34 : 64; // offset of the parallel branch
  const padL = small ? 62 : 120;
  const room = view.w - dw - padL - d - (small ? 26 : 40);
  const lw = Math.min(room, 420);
  const x0 = padL + (room - lw) / 2;
  return {
    small, R, cx, body, pivot: { x: cx, y: body.y + 1.1 * R }, sh, top, bottom, dmm, dw, d,
    vw: view.w, x0, x1: x0 + lw, y0: top + (small ? 20 : 32), y1: bottom - (small ? 18 : 30), rm: small ? 11 : 17,
  };
}

function drawMeter(ctx, s, g, m) {
  const { R, pivot, body } = g;
  const { unit, symbol, ranges } = meterOf(s);
  const at = (deg, r) => [pivot.x + r * Math.sin(rad(deg)), pivot.y - r * Math.cos(rad(deg))];
  ctx.fillStyle = m.overload || m.reversed ? "#fdeeee" : "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(body.x, body.y, body.w, body.h, R * 0.06);
  ctx.fill();
  ctx.stroke();

  // scale: 30 divisions shared by both ranges; outer numbers = large range, inner numbers = small range
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, 0.86 * R, rad(-50) - Math.PI / 2, rad(50) - Math.PI / 2);
  ctx.stroke();
  const size = clamp(R * 0.062, 9, 17);
  for (let k = 0; k <= DIVISIONS; k++) {
    const deg = -50 + (100 * k) / DIVISIONS;
    const major = k % 10 === 0;
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(...at(deg, 0.86 * R));
    ctx.lineTo(...at(deg, (major ? 0.93 : k % 5 === 0 ? 0.91 : 0.89) * R));
    ctx.stroke();
    if (!major) continue;
    ranges.forEach((range, i) => {
      const on = range === m.range;
      const [x, y] = at(deg, (i ? 1.0 : 0.78) * R);
      label(ctx, fmt((range * k) / DIVISIONS), x, y, { size, align: "center", bold: on, color: on ? COLORS.blue : COLORS.muted });
    });
  }
  label(ctx, symbol, pivot.x, pivot.y - 0.5 * R, { size: R * 0.17, align: "center", bold: true });
  label(ctx, `GHĐ ${fmt(m.range)} ${unit} · ĐCNN ${fmt(m.division)} ${unit}`, pivot.x, pivot.y - 0.32 * R, { size: clamp(R * 0.058, 9, 15), align: "center", color: COLORS.blue });

  // needle
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = Math.max(1.5, R * 0.01);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(...at(m.angle, 0.9 * R));
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, 0.08 * R, Math.PI, 0);
  ctx.fill();
}

function drawSymbol(ctx, x, y, r, text) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, text, x, y + 0.5, { size: r * 1.1, align: "center", bold: true });
}

function drawCircuit(ctx, s, g, m) {
  const { x0, x1, y0, y1, rm, small, d } = g;
  const ym = (y0 + y1) / 2;
  const size = small ? 11 : 14;
  const { symbol } = meterOf(s);
  const series = inSeries(s);
  const flip = s.wiring === "reversed";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

  // source: the long thin plate is the positive pole
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x0 - 5, ym - 6, 10, 12);
  ctx.beginPath();
  ctx.moveTo(x0 - 13, ym - 6);
  ctx.lineTo(x0 + 13, ym - 6);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x0 - 7, ym + 7);
  ctx.lineTo(x0 + 7, ym + 7);
  ctx.stroke();
  label(ctx, "+", x0 + 20, ym - 9, { color: COLORS.red, bold: true, size: size + 1, align: "center" });
  label(ctx, "−", x0 + 20, ym + 10, { color: COLORS.blue, bold: true, size: size + 1, align: "center" });
  if (!small) label(ctx, "Nguồn điện", x0 - 22, ym - 12, { align: "right", size: 13, color: COLORS.muted });
  label(ctx, practice(s) ? "U = ?" : `U = ${fmt(s.voltage)} V`, x0 - 20, ym + (small ? 0 : 8), { align: "right", bold: true, size });

  // bulb on the right side
  const level = Math.min(1, Math.sqrt(bulbCurrent(s) / 1.5));
  const rb = small ? 9 : 14;
  if (level > 0.02) {
    const glow = ctx.createRadialGradient(x1, ym, rb * 0.6, x1, ym, rb * (1.6 + 2 * level));
    glow.addColorStop(0, `rgba(245, 197, 24, ${0.8 * level})`);
    glow.addColorStop(1, "rgba(245, 197, 24, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x1, ym, rb * (1.6 + 2 * level), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgb(255, ${Math.round(255 - 35 * level)}, ${Math.round(255 - 195 * level)})`;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x1, ym, rb, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const c = rb * Math.SQRT1_2;
  ctx.beginPath();
  ctx.moveTo(x1 - c, ym - c);
  ctx.lineTo(x1 + c, ym + c);
  ctx.moveTo(x1 + c, ym - c);
  ctx.lineTo(x1 - c, ym + c);
  ctx.stroke();
  label(ctx, practice(s) ? "Đèn" : small ? `${fmt(s.resistance)} Ω` : `Đèn R = ${fmt(s.resistance)} Ω`, x1 - rb - 7, ym, { align: "right", size, bold: true });

  // the meter: in series on the top wire, or in a branch across the bulb
  const plus = { color: COLORS.red, bold: true, size: size + 1, align: "center" };
  const minus = { ...plus, color: COLORS.blue };
  if (series) {
    const x = (x0 + x1) / 2;
    drawSymbol(ctx, x, y0, rm, symbol);
    label(ctx, "+", x + (flip ? 1 : -1) * (rm + 8), y0 - 10, plus);
    label(ctx, "−", x + (flip ? -1 : 1) * (rm + 8), y0 - 10, minus);
  } else {
    const x = x1 + d;
    ctx.beginPath();
    ctx.moveTo(x1, y0);
    ctx.lineTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    for (const y of [y0, y1]) {
      ctx.beginPath();
      ctx.arc(x1, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSymbol(ctx, x, ym, rm, symbol);
    label(ctx, "+", x + 11, ym + (flip ? 1 : -1) * (rm + 9), plus);
    label(ctx, "−", x + 11, ym + (flip ? -1 : 1) * (rm + 9), minus);
  }

  // conventional current: out of the positive pole, back along the bottom wire
  const xa = (x0 + x1) / 2;
  const flowing = bulbCurrent(s) > 0 || (s.wiring === "wrong" && s.meter !== "voltmeter");
  if (flowing) arrow(ctx, xa + 16, y1, xa - 16, y1, COLORS.red, 2);
  label(ctx, flowing ? (small ? "chiều dòng điện" : "chiều dòng điện (quy ước)") : "I ≈ 0", xa, y1 + (small ? 10 : 15), { size: small ? 10 : 13, color: flowing ? COLORS.red : COLORS.muted, align: "center" });

  // digital multimeter for comparison: shows the exact value, with a minus sign for reversed poles
  if (!g.dmm) return;
  const { unit, milli } = meterOf(s);
  const w = g.dw - 8;
  const h = Math.min(g.bottom - g.top - 22, small ? 78 : 120);
  const bx = g.vw - g.dw;
  const by = (g.top + g.bottom - h) / 2 + 8;
  label(ctx, small ? "Đồng hồ số" : "Đồng hồ đo điện hiện số", bx + w / 2, by - 10, { size: small ? 10 : 13, align: "center", color: COLORS.muted });
  ctx.fillStyle = COLORS.yellow;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e4ecdc";
  ctx.beginPath();
  ctx.roundRect(bx + 6, by + 6, w - 12, h * 0.48, 4);
  ctx.fill();
  ctx.stroke();
  const hidden = practice(s) && s.feedback !== "correct";
  const over = Math.abs(m.value) > (s.meter === "voltmeter" ? 20 : 10); // beyond the multimeter's own range
  const big = clamp(w * 0.15, 13, 26);
  label(ctx, hidden ? "– – –" : over ? "OL" : `${fmt(m.value, 3)} ${unit}`, bx + w / 2, by + 6 + h * 0.24, { size: big, align: "center", bold: true });
  para(ctx, hidden ? "hiện khi đọc đúng" : over ? "quá tải" : `= ${fmt(toMilli(m.value), 0)} ${milli}`, bx + w / 2, by + h * 0.75, w - 8, small ? 10 : 13, COLORS.ink, 12);
}

const rangeOptions = meter =>
  METERS[meter].ranges.map(r => ({ value: r, label: `${fmt(r)} ${METERS[meter].unit} (ĐCNN ${fmt(smallestDivision(r))} ${METERS[meter].unit})` }));

mount({
  slug: "doc-ampe-ke-von-ke",
  version: "1.0.0",
  title: "Đọc ampe kế và vôn kế",
  hint: "Chọn thang đo có GHĐ nhỏ nhất mà kim vẫn nằm trong thang, rồi đọc số chỉ theo ĐCNN.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Chế độ",
      options: [
        { value: "explore", label: "Khám phá" },
        { value: "practice", label: "Luyện đọc số chỉ" },
      ],
      onChange: s => (practice(s) ? newTask(s) : clearFeedback(s)),
    },
    {
      type: "select",
      key: "meter",
      label: "Dụng cụ đo",
      options: [
        { value: "ammeter", label: "Ampe kế (đo cường độ dòng điện)" },
        { value: "voltmeter", label: "Vôn kế (đo hiệu điện thế)" },
      ],
      onChange: s => (practice(s) ? newTask(s) : clearFeedback(s)),
    },
    { type: "select", key: "ampRange", label: "Thang đo của ampe kế", options: rangeOptions("ammeter"), visible: s => s.meter !== "voltmeter", onChange: clearFeedback, onCommit: reportRange },
    { type: "select", key: "voltRange", label: "Thang đo của vôn kế", options: rangeOptions("voltmeter"), visible: s => s.meter === "voltmeter", onChange: clearFeedback, onCommit: reportRange },
    {
      type: "select",
      key: "wiring",
      label: "Cách mắc dụng cụ đo",
      options: [
        { value: "correct", label: "Đúng quy tắc" },
        { value: "reversed", label: "Ngược cực (chốt + về phía cực âm)" },
        { value: "wrong", label: "Sai: ampe kế song song / vôn kế nối tiếp" },
      ],
      onChange: clearFeedback,
    },
    { type: "slider", key: "voltage", label: "Hiệu điện thế nguồn U", min: 1, max: 12, step: 0.5, unit: "V", digits: 1, visible: s => !practice(s) },
    { type: "slider", key: "resistance", label: "Điện trở của đèn R", min: 4, max: 50, step: 1, unit: "Ω", digits: 0, visible: s => !practice(s) },
    { type: "checkbox", key: "showDigital", label: "Hiện đồng hồ số để so sánh", visible: s => !practice(s) },
    {
      type: "slider",
      key: "answer",
      label: "Số chỉ em đọc được",
      min: 0,
      max: DIVISIONS,
      step: 1,
      visible: practice,
      format: (v, s) => `${fmt(v * smallestDivision(rangeOf(s)))} ${meterOf(s).unit}`,
      onChange: clearFeedback,
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: practice,
      action(s, api) {
        const m = measure(s);
        s.feedback = checkAnswer(s);
        api.emit("answer-checked", { answer: s.answer * m.division, range: m.range, correct: s.feedback === "correct" ? 1 : 0 }, "action");
        if (s.feedback === "correct") api.emit("reading-correct", { reading: m.reading, range: m.range, value: m.value }, "goal");
      },
    },
    { type: "button", label: "Bài mới", visible: practice, action: s => newTask(s), event: "new-task" },
  ],
  readouts: [
    { label: "Giới hạn đo (GHĐ)", value: s => `${fmt(rangeOf(s))} ${meterOf(s).unit}` },
    { label: "Độ chia nhỏ nhất (ĐCNN)", value: s => `${fmt(smallestDivision(rangeOf(s)))} ${meterOf(s).unit}` },
    {
      label: "Số chỉ của kim",
      value: s => {
        const m = measure(s);
        if (m.reversed) return "kim lệch ngược";
        if (m.overload) return "quá thang đo";
        if (practice(s) && s.feedback !== "correct" && s.feedback !== "range") return "?";
        return `${fmt(m.reading)} ${meterOf(s).unit} = ${fmt(toMilli(m.reading), 0)} ${meterOf(s).milli}`;
      },
    },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const m = measure(s);
    drawMeter(ctx, s, g, m);
    const [text, color] = status(s, m);
    const size = g.small ? 11 : 14;
    para(ctx, text, g.cx, g.body.y + g.body.h + (g.small ? 10 : 14), view.w - 16, size, color, g.small ? 13 : 18);
    drawCircuit(ctx, s, g, m);
  },
});
