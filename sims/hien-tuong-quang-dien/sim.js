import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, step, METALS, EFFICIENCY, photonEnergy, workFunction, threshold, canEmit, emitted, kineticMax,
  stoppingVoltage, saturationCurrent, current, nearThreshold, hasFound, markFound,
} from "./model.js";

const L_MIN = 200;
const L_MAX = 800;
const U_MAX = 5;
const I_MAX = 30; // µA, fixed axis so a change of intensity is seen as a change of height

/** Approximate colour of monochromatic light; outside the visible range a conventional colour. */
function lightColor(nm) {
  if (nm < 380) return "rgb(140, 100, 235)"; // ultraviolet: drawn violet by convention
  if (nm > 760) return "rgb(120, 20, 20)"; // infrared: drawn dark red by convention
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, b] = [(440 - nm) / 60, 1];
  else if (nm < 490) [g, b] = [(nm - 440) / 50, 1];
  else if (nm < 510) [g, b] = [1, (510 - nm) / 20];
  else if (nm < 580) [r, g] = [(nm - 510) / 70, 1];
  else if (nm < 645) [r, g] = [1, (645 - nm) / 65];
  else r = 1;
  const edge = nm < 420 ? 0.45 + (0.55 * (nm - 380)) / 40 : nm > 700 ? 0.45 + (0.55 * (760 - nm)) / 60 : 1;
  return `rgb(${[r, g, b].map(c => Math.round(235 * c * edge)).join(", ")})`;
}

const colorName = nm =>
  nm < 380 ? "tử ngoại" : nm < 440 ? "tím" : nm < 460 ? "chàm" : nm < 500 ? "lam" : nm < 570 ? "lục" : nm < 590 ? "vàng" : nm < 640 ? "cam" : nm <= 760 ? "đỏ" : "hồng ngoại";

const revealed = s => s.showThreshold || hasFound(s);
const volts = u => `${u > 0 ? "+" : ""}${fmt(u)} V`;

function report(s, api) {
  api.emit(
    "measured",
    { wavelength: s.wavelength, emitted: emitted(s) ? 1 : 0, kineticMax: kineticMax(s), stoppingVoltage: stoppingVoltage(s), current: current(s) },
    "result"
  );
}

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const strip = { x: 14, y: small ? 5 : 10, w: view.w - 28, h: small ? 8 : 12 };
  const split = Math.round(view.h * (small ? 0.47 : 0.5));
  const top = strip.y + strip.h + (small ? 28 : 46);
  const tw = Math.min(view.w - (small ? 70 : 160), 600);
  const tube = { x: (view.w - tw) / 2, y: top, w: tw, h: split - top - (small ? 22 : 64) };
  const plate = { top: tube.y + tube.h * 0.16, bottom: tube.y + tube.h * 0.84, k: tube.x + tube.w * 0.1, a: tube.x + tube.w * 0.9 };
  const gl = small ? 34 : 70;
  const gy = split + (small ? 16 : 30);
  const graph = { x: gl, y: gy, w: view.w - gl - (small ? 14 : 40), h: view.h - gy - (small ? 26 : 46) };
  return { small, strip, tube, plate, graph };
}

function drawStrip(ctx, s, g) {
  const { strip, small } = g;
  const X = nm => strip.x + ((nm - L_MIN) / (L_MAX - L_MIN)) * strip.w;
  for (let px = 0; px < strip.w; px++) {
    ctx.fillStyle = lightColor(L_MIN + (px / strip.w) * (L_MAX - L_MIN));
    ctx.fillRect(strip.x + px, strip.y, 1.5, strip.h);
  }
  const size = small ? 10 : 12;
  const y = strip.y + strip.h + (small ? 8 : 11);
  label(ctx, "tử ngoại", X(L_MIN), y, { size, color: COLORS.muted });
  label(ctx, "nhìn thấy", X(570), y, { size, color: COLORS.muted, align: "center" });
  if (!small) label(ctx, "hồng ngoại", X(L_MAX), y, { size, color: COLORS.muted, align: "right" });
  if (revealed(s)) {
    const x0 = X(threshold(s));
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x0 - 1, strip.y - 3, 2, strip.h + 6);
    label(ctx, `λ₀ = ${fmt(threshold(s), 0)} nm`, x0, y, { size, bold: true, align: x0 > strip.x + strip.w - 60 ? "right" : x0 < strip.x + 60 ? "left" : "center" });
  }
  const x = X(s.wavelength);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - 3, strip.y - 3, 6, strip.h + 6);
  ctx.fill();
  ctx.stroke();
}

function drawTube(ctx, s, g) {
  const { tube, plate, small } = g;
  const size = small ? 11 : 14;
  const color = lightColor(s.wavelength);
  const on = emitted(s);

  // glass envelope
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#b9c3d6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(tube.x, tube.y, tube.w, tube.h, Math.min(28, tube.h / 2));
  ctx.fill();
  ctx.stroke();

  // light beam onto the cathode
  if (s.power > 0) {
    const bx = tube.x + tube.w * 0.5;
    const bw = tube.w * 0.14;
    const y0 = tube.y - (small ? 12 : 20);
    ctx.save();
    ctx.globalAlpha = 0.15 + 0.11 * s.power;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bx, y0);
    ctx.lineTo(bx + bw, y0);
    ctx.lineTo(plate.k + 4, plate.bottom);
    ctx.lineTo(plate.k + 4, plate.top);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    arrow(ctx, bx + bw / 2, y0, bx + bw / 2 - (bx - plate.k) * 0.22, y0 + (plate.top + plate.bottom - 2 * y0) * 0.11, color, 2.5);
    label(ctx, `λ = ${fmt(s.wavelength, 0)} nm (${colorName(s.wavelength)})`, bx + bw + 8, y0 + 2, { size, bold: true });
  } else {
    label(ctx, "Đèn tắt (P = 0)", tube.x + tube.w * 0.5, tube.y - (small ? 10 : 18), { size, color: COLORS.muted, align: "center" });
  }

  // plates
  const pw = small ? 5 : 8;
  ctx.fillStyle = "#8a94a8";
  ctx.fillRect(plate.k - pw, plate.top, pw + 4, plate.bottom - plate.top);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(plate.a, plate.top, pw, plate.bottom - plate.top);
  const sign = s.voltage > 0 ? ["−", "+"] : s.voltage < 0 ? ["+", "−"] : ["", ""];
  label(ctx, `K ${sign[0]}`, tube.x - 6, (plate.top + plate.bottom) / 2 - (small ? 6 : 9), { size, bold: true, align: "right" });
  label(ctx, s.metal in METALS ? s.metal : "Na", tube.x - 6, (plate.top + plate.bottom) / 2 + (small ? 7 : 9), { size, color: COLORS.muted, align: "right" });
  label(ctx, `A ${sign[1]}`, tube.x + tube.w + 6, (plate.top + plate.bottom) / 2, { size, bold: true });

  // electrons
  ctx.fillStyle = COLORS.blue;
  const r = small ? 2.2 : 3.2;
  ctx.beginPath();
  for (const e of s._el ?? []) {
    const x = plate.k + 4 + r + e.x * (plate.a - plate.k - 4 - 2 * r);
    const y = plate.top + 4 + e.y * (plate.bottom - plate.top - 8);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();

  const cx = tube.x + tube.w / 2;
  const status = on
    ? `Có electron bật ra: W_đmax = hf − A = ${fmt(kineticMax(s))} eV`
    : s.power > 0
      ? "Không có electron bật ra: hf < A"
      : "Không có ánh sáng chiếu vào catôt";
  const yb = tube.y + tube.h;
  if (small) {
    label(ctx, on ? `W_đmax = ${fmt(kineticMax(s))} eV` : status, cx, yb + 8, { size, align: "center", bold: true, color: on ? COLORS.blue : COLORS.red });
    return;
  }
  label(ctx, status, cx, yb - 13, { size: 13, align: "center", bold: true, color: on ? COLORS.blue : COLORS.red });

  // outer circuit: source and microammeter
  const yw = yb + 34;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plate.k - 2, plate.bottom);
  ctx.lineTo(plate.k - 2, yw);
  ctx.lineTo(plate.a + 4, yw);
  ctx.lineTo(plate.a + 4, plate.bottom);
  ctx.stroke();
  const ax = tube.x + tube.w * 0.72;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ax, yw, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, "µA", ax, yw, { size: 12, bold: true, align: "center" });
  label(ctx, `I = ${fmt(current(s))} µA`, ax, yw + 26, { size: 13, bold: true, align: "center", color: COLORS.red });
  const sx = tube.x + tube.w * 0.3;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(sx - 5, yw - 12, 10, 24);
  ctx.beginPath();
  ctx.moveTo(sx - 5, yw - 12);
  ctx.lineTo(sx - 5, yw + 12);
  ctx.moveTo(sx + 5, yw - 6);
  ctx.lineTo(sx + 5, yw + 6);
  ctx.stroke();
  label(ctx, `Nguồn: U_AK = ${volts(s.voltage)}`, sx, yw + 26, { size: 13, bold: true, align: "center" });
}

function drawGraph(ctx, s, g) {
  const { graph: q, small } = g;
  const X = u => q.x + ((u + U_MAX) / (2 * U_MAX)) * q.w;
  const Y = i => q.y + q.h - (Math.min(i, I_MAX) / I_MAX) * q.h;
  const size = small ? 10 : 12;
  const sat = saturationCurrent(s);
  const uh = stoppingVoltage(s);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let u = -U_MAX; u <= U_MAX; u++) {
    ctx.moveTo(X(u), q.y);
    ctx.lineTo(X(u), Y(0));
  }
  for (let i = 10; i <= I_MAX; i += 10) {
    ctx.moveTo(q.x, Y(i));
    ctx.lineTo(q.x + q.w, Y(i));
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(q.x, Y(0));
  ctx.lineTo(q.x + q.w + 6, Y(0));
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(X(0), q.y - 8);
  ctx.stroke();
  for (let u = -4; u <= 4; u += 2) label(ctx, fmt(u, 0), X(u), Y(0) + 10, { size, align: "center", color: COLORS.muted });
  for (let i = 10; i <= I_MAX; i += 10) label(ctx, fmt(i, 0), q.x - 5, Y(i), { size, align: "right", color: COLORS.muted });
  label(ctx, "U_AK (V)", q.x + q.w + 6, Y(0) + (small ? 20 : 26), { size, bold: true, align: "right" });
  label(ctx, "I (µA)", X(0) + 8, q.y - 8, { size, bold: true });

  if (sat > 0) {
    // marks: saturation level and stopping voltage
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(q.x, Y(sat));
    ctx.lineTo(X(0), Y(sat));
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, `I_bh = ${fmt(sat)} µA`, q.x + 4, Y(sat) - 9, { size, color: COLORS.orange, bold: true });
    ctx.fillStyle = COLORS.orange;
    ctx.beginPath();
    ctx.arc(X(-uh), Y(0), 4, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, `−U_h = −${fmt(uh)} V`, X(-uh) - 6, Y(0) - 10, { size, color: COLORS.orange, bold: true, align: "right" });
  }
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(X(-U_MAX), Y(0));
  ctx.lineTo(X(-uh), Y(0));
  ctx.lineTo(X(0), Y(sat));
  ctx.lineTo(X(U_MAX), Y(sat));
  ctx.stroke();
  if (sat === 0) {
    label(ctx, s.power > 0 ? "I = 0 với mọi U_AK và mọi cường độ sáng (hf < A)" : "I = 0: không có ánh sáng", X(0) + 10, Y(I_MAX * 0.45), {
      size: size + 1,
      color: COLORS.red,
      bold: true,
      align: small ? "center" : "left",
    });
  }
  ctx.fillStyle = COLORS.red;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(X(s.voltage), Y(current(s)), 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (small) label(ctx, `I = ${fmt(current(s))} µA tại U_AK = ${volts(s.voltage)}`, q.x + q.w, q.y - 8, { size, bold: true, color: COLORS.red, align: "right" });
  label(
    ctx,
    small ? "Mô hình lí tưởng hoá, hình vẽ không theo tỉ lệ" : `Mô hình lí tưởng hoá (hiệu suất lượng tử ${fmt(EFFICIENCY * 100)} %, electron bật ra vuông góc với catôt); hình vẽ không theo tỉ lệ`,
    small ? q.x - 20 : q.x,
    Y(0) + (small ? 20 : 26),
    { size: small ? 9 : 11, color: COLORS.muted }
  );
}

mount({
  slug: "hien-tuong-quang-dien",
  version: "1.0.0",
  title: "Hiện tượng quang điện",
  hint: "Đổi bước sóng để tìm giới hạn quang điện λ₀ của kim loại: bước sóng dài nhất còn làm electron bật ra. Sau đó đổi cường độ sáng và hiệu điện thế U_AK.",
  initialState,
  step,
  autoplay: true,
  controls: [
    {
      type: "select",
      key: "metal",
      label: "Kim loại làm catôt",
      options: Object.entries(METALS).map(([value, m]) => ({ value, label: `${m.label}, A = ${fmt(m.A)} eV` })),
      onChange: s => void (s._el = []),
      onCommit: report,
    },
    {
      type: "slider",
      key: "wavelength",
      label: "Bước sóng λ",
      min: L_MIN,
      max: L_MAX,
      step: 1,
      format: v => `${fmt(v, 0)} nm (${colorName(v)})`,
      onCommit(s, api) {
        report(s, api);
        // The goal counts only while λ0 is hidden, i.e. when the learner really searched for it.
        if (!s.showThreshold && nearThreshold(s) && markFound(s)) {
          api.emit("threshold-found", { wavelength: s.wavelength, threshold: threshold(s) }, "goal");
        }
      },
    },
    { type: "slider", key: "power", label: "Cường độ sáng (công suất P)", min: 0, max: 5, step: 0.1, unit: "mW", digits: 1, onCommit: report },
    { type: "slider", key: "voltage", label: "Hiệu điện thế U_AK", min: -U_MAX, max: U_MAX, step: 0.05, format: v => volts(v), onCommit: report },
    { type: "checkbox", key: "showThreshold", label: "Hiện giới hạn quang điện λ₀" },
  ],
  readouts: [
    { label: "Năng lượng photon ε = hf", value: s => `${fmt(photonEnergy(s.wavelength))} eV` },
    { label: "Công thoát A", value: s => `${fmt(workFunction(s))} eV` },
    { label: "Giới hạn quang điện λ₀ = hc/A", value: s => (revealed(s) ? `${fmt(threshold(s), 0)} nm` : "? (hãy tìm)") },
    { label: "Electron bật ra", value: s => (emitted(s) ? "Có" : "Không") },
    { label: "W_đmax = hf − A", value: s => (canEmit(s) ? `${fmt(kineticMax(s))} eV` : "–") },
    { label: "Hiệu điện thế hãm U_h", value: s => (canEmit(s) ? `${fmt(stoppingVoltage(s))} V` : "–") },
    { label: "Dòng bão hoà I_bh", value: s => `${fmt(saturationCurrent(s))} µA` },
    { label: "Dòng quang điện I", value: s => `${fmt(current(s))} µA` },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    drawStrip(ctx, s, g);
    drawTube(ctx, s, g);
    drawGraph(ctx, s, g);
  },
});
