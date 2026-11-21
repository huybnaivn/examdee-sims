import { mount, COLORS, label, fmt, arrow } from "../../kit/v1/kit.js";
import { initialState, step, radiusOf, rollOf, diameter, circumference, ratio, area, schoolCircumference, schoolArea, clampSectors, rearranged, R_MAX } from "./model.js";

const BLUE = ["#7fa8f5", "#a9c4f8"];
const ORANGE = ["#f6b26b", "#f9cd9b"];

const reportSectors = (s, api) => {
  const r = radiusOf(s);
  const p = rearranged(r, s.sectors);
  api.emit("sectors-set", { sectors: clampSectors(s.sectors), radius: r, approxArea: p.approxArea, exactArea: area(r) }, "result");
};

const font = size => `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;

function drawRoll(ctx, s, view, small) {
  const r = radiusOf(s);
  const d = diameter(r);
  const C = circumference(r);
  const pad = 16;
  const top = small ? 44 : 78;
  const below = small ? 62 : 96; // room for the row of diameters and the note
  const k = Math.min((view.w - 2 * pad) / (R_MAX * 9 + 0.5), (view.h - top - below) / (2 * R_MAX));
  const x0 = pad + R_MAX * k; // where the circle first touches the line
  const G = top + (view.h - top - below + 2 * R_MAX * k) / 2; // the line
  const theta = 2 * Math.PI * rollOf(s);
  const cx = x0 + r * k * theta;
  const cy = G - r * k;
  const R = r * k;

  // texts
  const done = rollOf(s) >= 1;
  label(ctx, small ? "Lăn một vòng: quãng đường = chu vi C" : "Lăn hình tròn đúng một vòng: quãng đường lăn được bằng chu vi C", view.w / 2, small ? 14 : 22, { align: "center", bold: true, size: small ? 13 : 17 });
  label(ctx, done ? `C : d = ${fmt(C, 2)} : ${fmt(d, 2)} ≈ ${fmt(ratio(r), 2)}` : `Đã lăn được ${fmt(C * rollOf(s), 1)} cm`, view.w / 2, small ? 32 : 50, {
    align: "center",
    size: small ? 13 : 16,
    bold: done,
    color: done ? COLORS.red : COLORS.muted,
  });

  // the line and the unrolled rim
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad - 6, G);
  ctx.lineTo(view.w - pad + 6, G);
  ctx.stroke();
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, G);
  ctx.lineTo(x0 + R * theta, G);
  ctx.stroke();

  // the circle: rim still to unroll in red, a diameter in blue
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (theta < 2 * Math.PI) {
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI / 2 + theta, Math.PI / 2 + 2 * Math.PI);
    ctx.stroke();
  }
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.stroke();
  label(ctx, "d", cx, cy - 10, { align: "center", bold: true, color: COLORS.blue });
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.arc(cx - R * Math.sin(theta), cy + R * Math.cos(theta), 5, 0, Math.PI * 2); // the point that touched the line first
  ctx.fill();

  // diameters laid along the line, to compare with C
  const y = G + (small ? 16 : 22);
  for (let i = 0; i < 4; i++) {
    const a = x0 + i * d * k;
    ctx.fillStyle = i === 3 ? COLORS.grid : BLUE[i % 2];
    ctx.fillRect(a, y - 6, d * k, 12);
    if (i < 3) label(ctx, "d", a + (d * k) / 2, y + (small ? 15 : 19), { align: "center", bold: true, color: COLORS.blue, size: small ? 12 : 14 });
  }
  const xc = x0 + C * k;
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xc, G - 6);
  ctx.lineTo(xc, y + 8);
  ctx.stroke();
  label(ctx, "C", xc + 6, y + (small ? 15 : 19), { bold: true, color: COLORS.red, size: small ? 12 : 14 });
  if (!small) {
    label(ctx, "Chu vi dài hơn 3 lần đường kính một chút: C = d × π, với π = 3,14159… (lớp 5 lấy π ≈ 3,14).", view.w / 2, view.h - 16, { align: "center", size: 13, color: COLORS.muted });
  }
}

function drawCut(ctx, s, view, small) {
  const r = radiusOf(s);
  const n = clampSectors(s.sectors);
  const p = rearranged(r, n);
  const pad = 16;
  const top = small ? 40 : 76;
  const bottom = small ? 26 : 44;
  const side = view.w / (view.h - top - bottom) > 1.6; // circle left, shape right
  const H = view.h - top - bottom;
  const shapeW = Math.PI * R_MAX + 1.2; // widest shape: n = 4 is narrower, so π·R plus half a chord is enough
  const k = side
    ? Math.min((view.w - 2 * pad - 60) / (2 * R_MAX + shapeW), (H - 40) / (2 * R_MAX))
    : Math.min((view.w - 2 * pad - 40) / shapeW, (H - 54) / (3.3 * R_MAX));
  const R = r * k;

  label(ctx, small ? `Cắt thành ${n} phần, ghép lại` : `Cắt hình tròn thành ${n} phần bằng nhau rồi ghép lại`, view.w / 2, small ? 14 : 22, { align: "center", bold: true, size: small ? 13 : 17 });
  label(ctx, `${small ? "" : "Hình bình hành: "}${fmt(p.width, 2)} × ${fmt(p.height, 2)} ≈ ${fmt(p.approxArea, 2)} cm²   (r × r × 3,14 = ${fmt(schoolArea(r), 2)} cm²)`, view.w / 2, small ? 31 : 50, { align: "center", size: small ? 12 : 15, color: COLORS.muted });

  // the cut circle
  const ccx = side ? pad + R_MAX * k + 10 : view.w / 2;
  const ccy = side ? top + H / 2 : top + R_MAX * k + 4;
  const a = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const topHalf = i >= n / 2; // canvas angles π…2π are above the centre
    ctx.fillStyle = (topHalf ? BLUE : ORANGE)[i % 2];
    ctx.beginPath();
    ctx.moveTo(ccx, ccy);
    ctx.arc(ccx, ccy, R, i * a, (i + 1) * a);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ccx, ccy, R, 0, Math.PI * 2);
  ctx.stroke();

  // the pieces side by side
  const w = p.width * k;
  const x0 = side ? ccx + R_MAX * k + 40 + (view.w - pad - (ccx + R_MAX * k + 40) - w) / 2 : (view.w - w) / 2;
  const base = side ? top + H / 2 + (p.height * k) / 2 : ccy + R_MAX * k + 22 + p.height * k + (r - p.height) * k;
  p.pieces.forEach((q, i) => {
    const ax = x0 + q.x * k;
    const ay = base - q.y * k;
    const dir = q.up === 1 ? -Math.PI / 2 : Math.PI / 2;
    ctx.fillStyle = (q.up === 1 ? BLUE : ORANGE)[Math.floor(i / 2) % 2];
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.arc(ax, ay, R, dir - p.half, dir + p.half);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  // the parallelogram it approaches
  const h = p.height * k;
  const c2 = (p.chord * k) / 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, base);
  ctx.lineTo(x0 + w, base);
  ctx.lineTo(x0 + w - c2, base - h);
  ctx.lineTo(x0 - c2, base - h);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  const yb = base + (r - p.height) * k + (small ? 10 : 14);
  arrow(ctx, x0 + w / 2, yb, x0, yb, COLORS.red, 1.5);
  arrow(ctx, x0 + w / 2, yb, x0 + w, yb, COLORS.red, 1.5);
  ctx.font = font(small ? 12 : 14);
  const wText = small ? `≈ 3,14 × r` : `≈ nửa chu vi = 3,14 × r`;
  const tw = ctx.measureText(wText).width + 8;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x0 + w / 2 - tw / 2, yb - 9, tw, 18);
  label(ctx, wText, x0 + w / 2, yb, { align: "center", size: small ? 12 : 14, bold: true, color: COLORS.red });
  const xr = x0 + w + 10;
  arrow(ctx, xr, base - h / 2, xr, base - h, COLORS.blue, 1.5);
  arrow(ctx, xr, base - h / 2, xr, base, COLORS.blue, 1.5);
  label(ctx, "≈ r", xr + 6, base - h / 2, { size: small ? 12 : 14, bold: true, color: COLORS.blue });
  if (!small) label(ctx, "Càng cắt nhiều phần, hình ghép càng gần hình bình hành có đáy 3,14 × r và chiều cao r.", view.w / 2, view.h - 16, { align: "center", size: 13, color: COLORS.muted });
}

mount({
  slug: "chu-vi-hinh-tron",
  version: "1.0.0",
  title: "Chu vi và diện tích hình tròn",
  hint: "Lăn hình tròn để thấy chu vi dài bao nhiêu lần đường kính. Cắt hình tròn thành nhiều phần rồi ghép lại để tìm diện tích.",
  initialState,
  step(s, dt, api) {
    if (rollOf(s) >= 1) s.roll = 0; // pressing play after a finished roll starts a new one
    if (step(s, dt)) {
      api.pause();
      const r = radiusOf(s);
      api.emit("rolled", { radius: r, circumference: circumference(r), ratio: ratio(r) }, "result");
    }
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "roll", label: "Lăn hình tròn (chu vi)" },
        { value: "cut", label: "Cắt và ghép hình tròn (diện tích)" },
      ],
      onChange: (s, api) => api.pause(),
    },
    { type: "slider", key: "radius", label: "Bán kính r", min: 1, max: 5, step: 0.5, unit: "cm", digits: 1, onCommit: (s, api) => s.mode === "cut" && reportSectors(s, api) },
    { type: "button", label: "Lăn một vòng", primary: true, visible: s => s.mode === "roll", event: "roll-start", action: (s, api) => {
      s.roll = 0;
      api.play();
    } },
    { type: "slider", key: "sectors", label: "Số phần cắt", min: 4, max: 64, step: 2, digits: 0, visible: s => s.mode === "cut", onCommit: reportSectors },
  ],
  readouts: [
    { label: "Đường kính d = r × 2", value: s => `${fmt(diameter(radiusOf(s)))} cm` },
    { label: "Chu vi C = d × 3,14", value: s => `${fmt(schoolCircumference(radiusOf(s)))} cm` },
    { label: "C : d", value: s => `≈ ${fmt(ratio(radiusOf(s)))}` },
    { label: "Diện tích S = r × r × 3,14", value: s => `${fmt(schoolArea(radiusOf(s)))} cm²` },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560 || view.h < 420;
    if (s.mode === "cut") drawCut(ctx, s, view, small);
    else drawRoll(ctx, s, view, small);
  },
});
