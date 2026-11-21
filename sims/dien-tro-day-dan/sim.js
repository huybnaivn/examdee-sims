import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, solve, MATERIALS, T0 } from "./model.js";

const MAX_LEN = 4; // m, one pass of the board is 1 m, so at most 4 passes
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

/** 1.1e-6 → "1,1·10⁻⁶". */
const sci = n => {
  const e = Math.floor(Math.log10(Math.abs(n)));
  const m = n / 10 ** e;
  return `${fmt(m, 2)}·10${String(e).replace(/./g, ch => SUP[ch])}`;
};
/** Three significant figures, decimal comma. */
const sig = n => (n === 0 || !Number.isFinite(n) ? fmt(n) : fmt(n, clamp(2 - Math.floor(Math.log10(Math.abs(n))), 0, 6)));

const report = (s, api) => {
  const c = solve(s);
  api.emit("resistance-measured", { resistance: c.r, current: c.current, material: c.index, length: s.length, area: s.area, temperature: c.t }, "result");
};

const mix = (hex, to, k) => {
  const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const b = [1, 3, 5].map(i => parseInt(to.slice(i, i + 2), 16));
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
};

function drawTable(ctx, s, x, y, w) {
  const rowH = 22;
  label(ctx, "Điện trở suất ở 20 °C", x, y, { bold: true, size: 13 });
  y += 16;
  const cols = [x + 8, x + w * 0.42, x + w * 0.74];
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(x, y, w, rowH);
  ["Chất", "ρ (Ω·m)", "α (K⁻¹)"].forEach((t, i) => label(ctx, t, cols[i], y + rowH / 2, { size: 12, color: COLORS.muted }));
  MATERIALS.forEach((m, k) => {
    const ry = y + rowH * (k + 1);
    const on = m.key === s.material;
    ctx.fillStyle = on ? "#e8f0ff" : "#fff";
    ctx.fillRect(x, ry, w, rowH);
    ctx.fillStyle = m.color;
    ctx.fillRect(x, ry + 4, 4, rowH - 8);
    const o = { size: 12, bold: on, color: on ? COLORS.blue : COLORS.ink };
    label(ctx, m.name, cols[0], ry + rowH / 2, o);
    label(ctx, sci(m.rho), cols[1], ry + rowH / 2, o);
    label(ctx, sci(m.alpha), cols[2], ry + rowH / 2, o);
  });
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, rowH * (MATERIALS.length + 1));
}

function draw(ctx, s, view) {
  const c = solve(s);
  const small = view.w < 520 || view.h < 400;
  const tableW = 236;
  const wide = view.w >= 700 && view.h >= 260;
  const sceneW = wide ? view.w - tableW - 32 : view.w;
  const size = small ? 12 : 14;

  // formula line
  const line = small
    ? `R = ρ·l/S = ${sig(c.r)} Ω`
    : `R = ρ·l/S = ${sci(c.rho)} · ${fmt(s.length)} / (${fmt(s.area)}·10⁻⁶) = ${sig(c.r0)} Ω`;
  label(ctx, line, sceneW / 2, 18, { align: "center", bold: true, size });
  let top = 34;
  if (s.useTemp) {
    label(ctx, `Ở ${fmt(c.t, 0)} °C: R = R₀(1 + αΔt) = ${sig(c.r)} Ω`, sceneW / 2, 38, { align: "center", size: small ? 11 : 13, color: COLORS.orange, bold: true });
    top = 52;
  }

  // board
  const bottomH = small ? 92 : 116;
  const railL = 26;
  const railR = sceneW - 26;
  const bx = railL + 22;
  const bw = railR - 22 - bx;
  const by = top + 4;
  const bh = Math.max(60, view.h - bottomH - by);
  ctx.fillStyle = "#efe2c8";
  ctx.strokeStyle = "#c9b48c";
  ctx.lineWidth = 1.5;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);
  const rowGap = bh / MAX_LEN;
  const rowY = k => by + rowGap * (k + 0.5);
  const turn = Math.min(rowGap / 2, 18);
  const x0 = bx + turn + 6; // a pass runs from x0 to x1: 1 m
  const x1 = bx + bw - turn - 6;
  // length scale: one pass is 1 m
  if (!small || rowGap > 40) {
    ctx.strokeStyle = "#8a7650";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, by + 6);
    ctx.lineTo(x0, by + 14);
    ctx.moveTo(x1, by + 6);
    ctx.lineTo(x1, by + 14);
    ctx.moveTo(x0, by + 10);
    ctx.lineTo(x1, by + 10);
    ctx.stroke();
    ctx.fillStyle = "#efe2c8";
    ctx.fillRect((x0 + x1) / 2 - 18, by + 3, 36, 14);
    label(ctx, "1 m", (x0 + x1) / 2, by + 10, { align: "center", size: 11, color: "#8a7650" });
  }

  // the wire
  const passes = Math.ceil(s.length - 1e-9);
  const path = [];
  for (let k = 0; k < passes; k++) {
    const frac = Math.min(1, s.length - k);
    const ltr = k % 2 === 0;
    const xa = ltr ? x0 : x1;
    const xb = xa + (ltr ? 1 : -1) * frac * (x1 - x0);
    path.push({ k, xa, xb, ltr, full: frac >= 1 - 1e-9 });
  }
  const heat = s.useTemp ? clamp((c.t - T0) / 480, 0, 1) : 0;
  const maxD = Math.sqrt(8 / Math.PI); // mm, at the largest cross-section
  const lw = Math.max(1.5, (c.diameter / maxD) * Math.min(rowGap * 0.32, 14));
  ctx.save();
  ctx.strokeStyle = mix(c.material.color, "#ff5a1e", heat * 0.75);
  if (heat > 0.02) {
    ctx.shadowColor = `rgba(255, 110, 20, ${0.35 + 0.6 * heat})`;
    ctx.shadowBlur = 4 + 18 * heat;
  }
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  path.forEach((p, i) => {
    const y = rowY(p.k);
    if (i === 0) ctx.moveTo(p.xa, y);
    ctx.lineTo(p.xb, y);
    if (p.full && i < path.length - 1) {
      // U-turn around the peg to the next pass; not counted in the length
      ctx.ellipse(p.xb, y + rowGap / 2, turn, rowGap / 2, 0, -Math.PI / 2, Math.PI / 2, !p.ltr);
    }
  });
  ctx.stroke();
  ctx.restore();
  // pegs the wire is wound around
  ctx.fillStyle = "#6f5f40";
  for (const p of path.slice(0, -1)) {
    ctx.beginPath();
    ctx.arc(p.xb, rowY(p.k) + rowGap / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // terminals A (start) and B (end)
  const A = { x: x0, y: rowY(0) };
  const last = path[path.length - 1];
  const B = { x: last.xb, y: rowY(last.k) };

  // circuit leads
  const yW = view.h - (small ? 48 : 60); // bottom wire
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(railL, A.y);
  ctx.lineTo(railL, yW);
  ctx.lineTo(railR, yW);
  if (Math.abs(B.x - x1) < 1) {
    ctx.lineTo(railR, B.y);
    ctx.lineTo(B.x, B.y);
  } else {
    const yUnder = by + bh + 8;
    ctx.lineTo(railR, yUnder);
    ctx.lineTo(B.x, yUnder);
    ctx.lineTo(B.x, B.y);
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  for (const [p, name] of [[A, "A"], [B, "B"]]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, name, p.x + (p === A ? -6 : 8), p.y + (p === A ? 13 : -12), { size: 12, bold: true, color: COLORS.muted, align: p === A ? "right" : "left" });
  }

  // source: the long thin plate is the positive pole, on the right
  const sx = railL + (railR - railL) * 0.3;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(sx - 7, yW - 4, 14, 8);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(sx - 5, yW - 8);
  ctx.lineTo(sx - 5, yW + 8);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx + 5, yW - 15);
  ctx.lineTo(sx + 5, yW + 15);
  ctx.stroke();
  label(ctx, "−", sx - 13, yW - 16, { color: COLORS.blue, bold: true, size, align: "center" });
  label(ctx, "+", sx + 14, yW - 18, { color: COLORS.red, bold: true, size, align: "center" });
  label(ctx, `U = ${fmt(s.voltage, 1)} V`, sx, yW + 26, { align: "center", bold: true, size });

  // ammeter
  const ax = railL + (railR - railL) * 0.7;
  const ar = small ? 13 : 16;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ax, yW, ar, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, "A", ax, yW + 1, { align: "center", bold: true, size });
  label(ctx, `I = ${sig(c.current)} A`, ax, yW + 26, { align: "center", bold: true, size, color: COLORS.red });

  // conventional current: out of + to the right, through the ammeter
  if (c.current > 0) {
    const mx = (sx + ax) / 2;
    arrow(ctx, mx - 14, yW - 10, mx + 14, yW - 10, COLORS.red, 2);
  }

  const note =
    sceneW >= 760
      ? "Hình không theo tỉ lệ: mỗi lượt dây dài 1 m, độ dày dây được phóng to; mũi tên đỏ là chiều dòng điện quy ước."
      : sceneW >= 460
        ? "Không theo tỉ lệ: mỗi lượt dây dài 1 m, dây vẽ dày hơn thật; mũi tên đỏ: chiều quy ước của I."
        : "Không theo tỉ lệ: mỗi lượt dây dài 1 m";
  label(ctx, note, sceneW / 2, view.h - 9, { align: "center", size: small ? 10 : 11, color: COLORS.muted });

  if (wide) drawTable(ctx, s, view.w - tableW - 14, 22, tableW);
}

mount({
  slug: "dien-tro-day-dan",
  version: "1.0.0",
  title: "Điện trở của dây dẫn",
  hint: "Đổi chiều dài, tiết diện và chất làm dây để xem điện trở R = ρ·l/S và số chỉ ampe kế thay đổi thế nào. Nguồn và ampe kế được coi là lí tưởng.",
  initialState,
  controls: [
    {
      type: "select",
      key: "material",
      label: "Chất làm dây",
      options: MATERIALS.map(m => ({ value: m.key, label: `${m.name} (ρ = ${sci(m.rho)} Ω·m)` })),
    },
    { type: "slider", key: "length", label: "Chiều dài l", min: 0.2, max: MAX_LEN, step: 0.1, unit: "m", digits: 1 },
    {
      type: "slider",
      key: "area",
      label: "Tiết diện S",
      min: 0.1,
      max: 2,
      step: 0.05,
      format: v => `${fmt(v)} mm² (d = ${fmt(Math.sqrt((4 * v) / Math.PI))} mm)`,
    },
    { type: "slider", key: "voltage", label: "Hiệu điện thế U", min: 0, max: 12, step: 0.5, unit: "V", digits: 1 },
    { type: "checkbox", key: "useTemp", label: "Tính đến nhiệt độ của dây" },
    { type: "slider", key: "temperature", label: "Nhiệt độ dây t", min: 0, max: 500, step: 10, unit: "°C", digits: 0, visible: s => s.useTemp },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "Điện trở suất ρ", value: s => `${sci(solve(s).rho)} Ω·m` },
    { label: "Điện trở ở 20 °C, R₀", value: s => `${sig(solve(s).r0)} Ω` },
    { label: "Điện trở R", value: s => `${sig(solve(s).r)} Ω` },
    { label: "Cường độ dòng điện I", value: s => `${sig(solve(s).current)} A` },
  ],
  draw,
});
