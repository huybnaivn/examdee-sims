import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, rheostat, divider, brightness, isRated, BULB, R_BULB, I_RATED } from "./model.js";

const USED = COLORS.orange;
const IDLE = "#b9c2d0";

function report(s, api) {
  if (s.mode === "rheostat") {
    const r = rheostat(s);
    api.emit("slider-set", { position: s.position, resistance: r.rb, current: r.i, outputVoltage: r.uBulb }, "result");
  } else {
    const d = divider(s);
    api.emit("slider-set", { position: s.position, resistance: d.r2, current: d.i, outputVoltage: d.uOut }, "result");
  }
  const rated = isRated(s);
  if (rated && !s._rated) api.emit("rated-brightness", { resistance: rheostat(s).rb, current: rheostat(s).i }, "goal");
  s._rated = rated;
}

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const top = small ? 30 : 56;
  const bottom = view.h - (small ? 26 : 38);
  const x0 = small ? 44 : 90;
  const x1 = view.w - (small ? 24 : 70);
  const cA = x0 + (x1 - x0) * 0.16;
  const cB = x1 - (x1 - x0) * 0.14;
  const coilH = small ? 16 : 24;
  const div = s.mode === "divider";
  const y0 = top + (small ? 22 : 34);
  const yCoil = div ? top + (bottom - top) * 0.46 : Math.min(bottom - coilH, top + (bottom - top) * 0.72);
  const xC = cA + (clamp(s.position, 0, 100) / 100) * (cB - cA);
  return { small, top, bottom, x0, x1, cA, cB, coilH, y0, yCoil, xC, yBar: yCoil - coilH / 2 - (small ? 14 : 22), yO1: yCoil + coilH / 2 + (small ? 22 : 36), yO2: bottom - 6 };
}

function line(ctx, pts, color = COLORS.ink, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

function dot(ctx, x, y) {
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoil(ctx, g, usedFrom, usedTo) {
  const { cA, cB, yCoil, coilH } = g;
  ctx.fillStyle = "#eef1f6";
  ctx.fillRect(cA, yCoil - coilH / 2, cB - cA, coilH);
  const turns = Math.round((cB - cA) / 6);
  for (let k = 0; k <= turns; k++) {
    const x = cA + ((cB - cA) * k) / turns;
    const used = x >= usedFrom && x <= usedTo;
    line(ctx, [[x, yCoil - coilH / 2], [x + 3, yCoil + coilH / 2]], used ? USED : IDLE, used ? 2 : 1.5);
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(cA, yCoil - coilH / 2, cB - cA, coilH);
}

function drawWiper(ctx, g, fromBelow) {
  const { xC, yCoil, coilH } = g;
  const y = fromBelow ? yCoil + coilH / 2 : yCoil - coilH / 2;
  const d = fromBelow ? 1 : -1;
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.moveTo(xC, y);
  ctx.lineTo(xC - 8, y + d * 14);
  ctx.lineTo(xC + 8, y + d * 14);
  ctx.closePath();
  ctx.fill();
  label(ctx, "C", xC + 11, y + d * 10, { bold: true, size: 13, color: COLORS.blue });
}

function drawSource(ctx, g, s) {
  const x = g.x0;
  const ym = (g.y0 + g.yCoil) / 2;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x - 5, ym - 7, 10, 14);
  line(ctx, [[x - 15, ym - 6], [x + 15, ym - 6]]);
  line(ctx, [[x - 8, ym + 6], [x + 8, ym + 6]], COLORS.ink, 5);
  label(ctx, "+", x + 20, ym - 10, { color: COLORS.red, bold: true });
  label(ctx, `U = ${fmt(s.voltage, 1)} V`, x + 14, ym + 18, { bold: true, size: g.small ? 11 : 14 });
}

function drawBulb(ctx, x, y, r, level) {
  const l = Math.min(1.4, level);
  if (l > 0.02) {
    const R = r * (1.6 + 2 * l);
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, R);
    glow.addColorStop(0, `rgba(245, 197, 24, ${Math.min(0.9, 0.7 * l)})`);
    glow.addColorStop(1, "rgba(245, 197, 24, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
  }
  const f = Math.min(1, l);
  ctx.fillStyle = `rgb(255, ${Math.round(255 - 35 * f)}, ${Math.round(255 - 195 * f)})`;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const c = r * Math.SQRT1_2;
  line(ctx, [[x - c, y - c], [x + c, y + c]]);
  line(ctx, [[x + c, y - c], [x - c, y + c]]);
}

function meter(ctx, x, y, r, letter, text, small) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, letter, x, y + 1, { align: "center", bold: true, size: small ? 11 : 13 });
  label(ctx, text, x, y - r - 9, { align: "center", bold: true, size: small ? 11 : 13, color: COLORS.blue });
}

function drawRheostat(ctx, s, g) {
  const r = rheostat(s);
  const { x0, x1, y0, yCoil, yBar, cA, cB, xC, small } = g;
  const bx = (x0 + x1) / 2 + (small ? 20 : 40);
  line(ctx, [[x0, yCoil], [x0, y0], [x1, y0], [x1, yBar], [xC, yBar]]);
  line(ctx, [[x0, yCoil], [cA, yCoil]]);
  line(ctx, [[cA, yBar], [cB, yBar]], COLORS.ink, 4); // the slider bar
  line(ctx, [[xC, yBar], [xC, yCoil - g.coilH / 2]], COLORS.blue, 2);
  drawCoil(ctx, g, cA, xC);
  drawWiper(ctx, g, false);
  dot(ctx, cA, yCoil);
  label(ctx, "A", cA - 4, yCoil + g.coilH / 2 + 10, { bold: true, size: 13, align: "right" });
  label(ctx, "B", cB + 4, yCoil + g.coilH / 2 + 10, { bold: true, size: 13 });
  drawSource(ctx, g, s);
  // ammeter and bulb on the top wire
  const rb = small ? 11 : 16;
  meter(ctx, x0 + (bx - x0) * 0.45, y0, small ? 10 : 14, "A", `I = ${fmt(r.i, 3)} A`, small);
  drawBulb(ctx, bx, y0, rb, brightness(r.pBulb));
  label(ctx, `Đèn ${BULB.u} V – ${BULB.p} W`, bx, y0 - rb - 10, { align: "center", size: small ? 11 : 13, bold: true });
  label(ctx, `U_đ = ${fmt(r.uBulb, 2)} V`, bx, y0 + rb + 12, { align: "center", size: small ? 11 : 13 });
  label(ctx, `R_b = ${fmt(r.rb, 1)} Ω`, (cA + xC) / 2, yBar - (small ? 12 : 16), { align: "center", bold: true, size: small ? 12 : 14, color: USED });
  const level = brightness(r.pBulb);
  const msg = isRated(s) ? "Đèn sáng bình thường (đúng định mức)" : level > 1.1 ? "Đèn sáng quá mức định mức, dễ cháy!" : level < 0.9 ? "Đèn sáng yếu hơn bình thường" : "Gần đúng định mức";
  label(ctx, msg, (x0 + x1) / 2, (y0 + yBar) / 2 + 6, { align: "center", bold: true, size: small ? 11 : 14, color: isRated(s) ? COLORS.green : level > 1.1 ? COLORS.red : COLORS.muted });
}

function drawDivider(ctx, s, g) {
  const d = divider(s);
  const { x0, x1, y0, yCoil, yO1, yO2, cA, cB, xC, small } = g;
  line(ctx, [[x0, yCoil], [x0, y0], [x1, y0], [x1, yCoil], [cB, yCoil]]);
  line(ctx, [[x0, yCoil], [cA, yCoil]]);
  drawCoil(ctx, g, cA, xC);
  drawWiper(ctx, g, true);
  dot(ctx, cA, yCoil);
  dot(ctx, cB, yCoil);
  label(ctx, "A", cA - 4, yCoil - g.coilH / 2 - 9, { bold: true, size: 13, align: "right" });
  label(ctx, "B", cB + 4, yCoil - g.coilH / 2 - 9, { bold: true, size: 13 });
  drawSource(ctx, g, s);
  label(ctx, `R₂ = ${fmt(d.r2, 1)} Ω`, (cA + xC) / 2, yCoil - g.coilH / 2 - (small ? 10 : 14), { align: "center", bold: true, size: small ? 11 : 13, color: USED });
  if (!small || xC < cB - 70) label(ctx, `R₁ = ${fmt(d.r1, 1)} Ω`, (xC + cB) / 2, yCoil + g.coilH / 2 + (small ? 10 : 14), { align: "center", size: small ? 11 : 13, color: COLORS.muted });
  // output: from the wiper C and from end A
  const xV = cB - (cB - cA) * 0.05;
  const xL = (xV + x1) / 2 + 10;
  const ym = (yO1 + yO2) / 2;
  line(ctx, [[xC, yCoil + g.coilH / 2 + 14], [xC, yO1], [s.loaded ? xL : xV, yO1]]);
  line(ctx, [[cA, yCoil], [cA, yO2], [s.loaded ? xL : xV, yO2]]);
  line(ctx, [[xV, yO1], [xV, yO2]]);
  dot(ctx, xC, yO1);
  meter(ctx, xV, ym, small ? 10 : 14, "V", "", small);
  label(ctx, `U_ra = ${fmt(d.uOut, 2)} V`, xV - (small ? 16 : 22), ym, { align: "right", bold: true, size: small ? 12 : 15, color: COLORS.blue });
  if (s.loaded) {
    line(ctx, [[xL, yO1], [xL, yO2]]);
    const h = Math.min(40, (yO2 - yO1) * 0.6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(xL - 7, ym - h / 2, 14, h);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(xL - 7, ym - h / 2, 14, h);
    label(ctx, "R_t", xL + 11, ym, { bold: true, size: small ? 11 : 13 });
    dot(ctx, xV, yO1);
    dot(ctx, xV, yO2);
  }
}

mount({
  slug: "bien-tro",
  version: "1.0.0",
  title: "Biến trở và mạch chia điện áp",
  hint: "Kéo con chạy C dọc cuộn dây (hoặc dùng thanh trượt) để đổi điện trở. Thử làm đèn sáng đúng định mức.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Cách dùng",
      options: [
        { value: "rheostat", label: "Biến trở mắc nối tiếp với đèn" },
        { value: "divider", label: "Chiết áp chia điện áp" },
      ],
    },
    { type: "slider", key: "voltage", label: "Hiệu điện thế nguồn U", min: 3, max: 12, step: 0.5, unit: "V", digits: 1 },
    { type: "slider", key: "rMax", label: "Điện trở toàn phần R_max", min: 10, max: 100, step: 5, unit: "Ω", digits: 0 },
    { type: "slider", key: "position", label: "Vị trí con chạy C", min: 0, max: 100, step: 0.5, digits: 1, format: (v, s) => `${fmt(v, 1)} % · ${s.mode === "divider" ? "R₂" : "R_b"} = ${fmt((v / 100) * s.rMax, 1)} Ω` },
    { type: "checkbox", key: "loaded", label: "Mắc tải R_t vào đầu ra", visible: s => s.mode === "divider" },
    { type: "slider", key: "rLoad", label: "Điện trở tải R_t", min: 2, max: 200, step: 1, unit: "Ω", digits: 0, visible: s => s.mode === "divider" && s.loaded },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "Điện trở biến trở đang dùng", value: s => `${fmt(s.mode === "divider" ? divider(s).r2 : rheostat(s).rb, 1)} Ω` },
    { label: "Cường độ dòng điện I", value: s => `${fmt(s.mode === "divider" ? divider(s).i : rheostat(s).i, 3)} A` },
    { label: "Hiệu điện thế đèn / đầu ra", value: s => `${fmt(s.mode === "divider" ? divider(s).uOut : rheostat(s).uBulb, 2)} V` },
    { label: "Đầu ra khi không tải U·R₂/R", value: s => (s.mode === "divider" ? `${fmt(divider(s).unloaded, 2)} V` : "–") },
    { label: "Công suất đèn", value: s => (s.mode === "rheostat" ? `${fmt(rheostat(s).pBulb, 2)} W (định mức ${BULB.p} W)` : "–") },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      if (p.x < g.cA - 20 || p.x > g.cB + 20 || Math.abs(p.y - g.yCoil) > g.coilH / 2 + 24) return false;
      this.move(p, s, api, view);
    },
    move(p, s, api, view) {
      const g = geom(s, view);
      s.position = Math.round(clamp((p.x - g.cA) / (g.cB - g.cA), 0, 1) * 200) / 2;
    },
    up(p, s, api) {
      api.emit("slider-drag", { position: s.position });
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const head = s.mode === "divider" ? "U_ra = U·R₂/(R₁ + R₂)   (khi không mắc tải)" : `R_b = R_max·ℓ/ℓ_max     I = U/(R_đ + R_b)`;
    label(ctx, head, view.w / 2, g.small ? 12 : 24, { align: "center", bold: true, size: g.small ? 12 : 16 });
    if (s.mode === "divider") drawDivider(ctx, s, g);
    else drawRheostat(ctx, s, g);
    const note = g.small
      ? (s.mode === "divider" ? "Phần cam: R₂ (giữa A và C)" : "Phần cam: đoạn dây có dòng điện; R_đ = 12 Ω")
      : s.mode === "divider"
      ? "Phần cam: R₂ giữa A và C. Mắc tải làm U_ra giảm. Vôn kế lí tưởng."
      : `Phần cam: đoạn dây đang có dòng điện. R_đ = ${fmt(R_BULB, 0)} Ω coi như không đổi; I_đm = ${fmt(I_RATED, 1)} A.`;
    label(ctx, note, view.w / 2, view.h - (g.small ? 10 : 16), { align: "center", size: g.small ? 10 : 12, color: COLORS.muted });
  },
});
