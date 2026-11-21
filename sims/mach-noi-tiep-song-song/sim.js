import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, step, solve, brightness } from "./model.js";

const SUB = ["₁", "₂", "₃"];
const KEYS = ["k1", "k2", "k3"];
const MIN_LOOP = 96; // px, least height of the circuit loop before the table has to give way

// One result per finished change. An open circuit has no finite Rtđ: the key is left out and open = 1.
const report = (s, api) => {
  const c = solve(s);
  const open = Number.isFinite(c.req) ? 0 : 1;
  api.emit("circuit-solved", { ...(!open && { equivalentResistance: c.req }), current: c.total, power: c.power, voltage: s.voltage, open }, "result");
};

// Everything is placed from the view size, so draw() and the pointer agree.
function geom(s, view) {
  const small = view.w < 560 || view.h < 430; // compact metrics for a narrow or a short stage
  const n = s.useR3 ? 3 : 2;
  const parallel = s.mode === "parallel";
  const rowH = small ? 21 : 28;
  const tw = Math.min(view.w - 16, 660);
  const padL = small ? 80 : 120;
  const padR = small ? 40 : 70;
  const top = small ? 62 : 100;
  const bottom = small ? 42 : 72; // room for the current label and the electron note
  const gap = small ? 6 : 24; // under the table
  // The loop comes first: the table gets only the rows that fit under it (header, R, I, U, P),
  // and is dropped when not even header + R + I fit. The panel readouts still give Rtđ and I.
  const rows = Math.min(5, Math.floor((view.h - top - bottom - gap - MIN_LOOP) / rowH));
  const table = rows >= 3 ? { x: (view.w - tw) / 2, y: view.h - rowH * rows - gap, w: tw, rowH, rows } : null;
  const floor = table ? table.y : view.h; // lower edge of the space the loop may use
  const bw = Math.min(view.w - padL - padR, 600);
  const bh = Math.max(40, Math.min(floor - top - bottom, 300));
  const x0 = padL + (view.w - padL - padR - bw) / 2;
  const y0 = top + Math.max(0, floor - top - bottom - bh) / 2;
  const parts = [];
  for (let k = 0; k < n; k++) {
    if (parallel) {
      const x = x0 + (bw * (k + 1)) / n; // branch k, the last one closes the loop
      parts.push({ x, sw: { x, y: y0 + bh * 0.28 }, bulb: { x, y: y0 + bh * 0.68 } });
    } else {
      const x = x0 + (bw * (k + 0.5)) / n;
      const d = bw / n / 4;
      parts.push({ x, sw: { x: x - d, y: y0 }, bulb: { x: x + d, y: y0 } });
    }
  }
  return { small, n, parallel, table, x0, x1: x0 + bw, y0, y1: y0 + bh, parts, rb: small ? 10 : 17, half: small ? 9 : 15 };
}

function dots(ctx, pts, phase, gap = 22) {
  ctx.fillStyle = COLORS.blue;
  let d = phase * gap;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    for (; d < len; d += gap) {
      ctx.beginPath();
      ctx.arc(ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    d -= len;
  }
}

function drawSwitch(ctx, g, sw, closed) {
  const L = g.half;
  const v = g.parallel; // vertical wire
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(sw.x - (v ? 5 : L), sw.y - (v ? L : 5), v ? 10 : 2 * L, v ? 2 * L : 10);
  const a = [sw.x - (v ? 0 : L), sw.y - (v ? L : 0)];
  const b = [sw.x + (v ? 0 : L), sw.y + (v ? L : 0)];
  const tilt = 0.6; // rad, how far the open arm swings away
  const tip = closed
    ? b
    : v
      ? [a[0] - 2 * L * Math.sin(tilt), a[1] + 2 * L * Math.cos(tilt)]
      : [a[0] + 2 * L * Math.cos(tilt), a[1] - 2 * L * Math.sin(tilt)];
  ctx.strokeStyle = closed ? COLORS.ink : COLORS.red;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...tip);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  for (const p of [a, b]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBulb(ctx, x, y, r, level) {
  if (level > 0.02) {
    const R = r * (1.6 + 2.2 * level);
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, R);
    glow.addColorStop(0, `rgba(245, 197, 24, ${0.8 * level})`);
    glow.addColorStop(1, "rgba(245, 197, 24, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgb(255, ${Math.round(255 - 35 * level)}, ${Math.round(255 - 195 * level)})`;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const c = r * Math.SQRT1_2;
  ctx.beginPath();
  ctx.moveTo(x - c, y - c);
  ctx.lineTo(x + c, y + c);
  ctx.moveTo(x + c, y - c);
  ctx.lineTo(x - c, y + c);
  ctx.stroke();
}

function drawTable(ctx, s, g, c) {
  if (!g.table) return;
  const { x, y, w, rowH } = g.table;
  const size = g.small ? 12 : 14;
  const first = g.small ? 50 : 200;
  const cw = (w - first) / (g.n + 1);
  const rows = [
    ["", ...c.items.map((_, k) => `R${SUB[k]}`), "Toàn mạch"],
    [g.small ? "R (Ω)" : "Điện trở (Ω)", ...c.items.map(it => fmt(it.r)), Number.isFinite(c.req) ? fmt(c.req) : "∞"],
    [g.small ? "I (A)" : "Cường độ dòng điện (A)", ...c.items.map(it => fmt(it.i, 3)), fmt(c.total, 3)],
    [g.small ? "U (V)" : "Hiệu điện thế (V)", ...c.items.map(it => fmt(it.u)), fmt(s.voltage)],
    [g.small ? "P (W)" : "Công suất (W)", ...c.items.map(it => fmt(it.p)), fmt(c.power)],
  ].slice(0, g.table.rows);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, rowH * rows.length);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(x, y, w, rowH);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, rowH * rows.length);
  rows.forEach((row, r) => {
    const cy = y + rowH * (r + 0.5);
    if (r > 1) {
      ctx.beginPath();
      ctx.moveTo(x, y + rowH * r);
      ctx.lineTo(x + w, y + rowH * r);
      ctx.stroke();
    }
    row.forEach((text, col) => {
      if (col === 0) return label(ctx, text, x + 8, cy, { size, color: COLORS.muted });
      const off = col <= g.n && !c.items[col - 1].closed;
      label(ctx, text, x + first + cw * (col - 0.5), cy, {
        size,
        align: "center",
        bold: r === 0 || col === g.n + 1,
        color: off && r > 0 ? COLORS.muted : col === g.n + 1 ? COLORS.blue : COLORS.ink,
      });
    });
  });
}

mount({
  slug: "mach-noi-tiep-song-song",
  version: "1.0.0",
  title: "Mạch nối tiếp và song song",
  hint: "Bấm vào khóa K trên hình để đóng hoặc ngắt mạch.",
  initialState,
  step,
  autoplay: true,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Cách mắc",
      options: [
        { value: "series", label: "Nối tiếp" },
        { value: "parallel", label: "Song song" },
      ],
    },
    { type: "checkbox", key: "useR3", label: "Mắc thêm điện trở R₃" },
    { type: "slider", key: "voltage", label: "Hiệu điện thế nguồn U", min: 0, max: 24, step: 1, unit: "V", digits: 0 },
    { type: "slider", key: "r1", label: "Điện trở R₁", min: 5, max: 50, step: 1, unit: "Ω", digits: 0 },
    { type: "slider", key: "r2", label: "Điện trở R₂", min: 5, max: 50, step: 1, unit: "Ω", digits: 0 },
    { type: "slider", key: "r3", label: "Điện trở R₃", min: 5, max: 50, step: 1, unit: "Ω", digits: 0, visible: s => s.useR3 },
    { type: "checkbox", key: "k1", label: "Đóng khóa K₁" },
    { type: "checkbox", key: "k2", label: "Đóng khóa K₂" },
    { type: "checkbox", key: "k3", label: "Đóng khóa K₃", visible: s => s.useR3 },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "Điện trở tương đương", value: s => (Number.isFinite(solve(s).req) ? `${fmt(solve(s).req)} Ω` : "∞ (mạch hở)") },
    { label: "Cường độ dòng mạch chính", value: s => `${fmt(solve(s).total, 3)} A` },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(s, view);
      const k = g.parts.findIndex(part => Math.hypot(p.x - part.sw.x, p.y - part.sw.y) < g.half + 16);
      if (k < 0) return false;
      s[KEYS[k]] = !s[KEYS[k]];
      api.emit("switch", { index: k + 1, closed: s[KEYS[k]] });
      report(s, api);
    },
  },
  draw(ctx, s, view) {
    const g = geom(s, view);
    const c = solve(s);
    const { x0, x1, y0, y1, parts, small } = g;
    const ym = (y0 + y1) / 2;
    const size = small ? 12 : 15;
    const phase = s._phase ?? [];

    // rules of this kind of circuit
    const all = join => parts.map((_, k) => join(SUB[k]));
    const rules = g.parallel
      ? [`U = ${all(i => `U${i}`).join(" = ")}`, `I = ${all(i => `I${i}`).join(" + ")}`, `1/Rtđ = ${all(i => `1/R${i}`).join(" + ")}`]
      : [`I = ${all(i => `I${i}`).join(" = ")}`, `U = ${all(i => `U${i}`).join(" + ")}`, `Rtđ = ${all(i => `R${i}`).join(" + ")}`];
    if (small) {
      label(ctx, rules[2], view.w / 2, 11, { align: "center", size: 12, bold: true });
    } else {
      label(ctx, g.parallel ? "Đoạn mạch song song" : "Đoạn mạch nối tiếp", view.w / 2, 26, { align: "center", size: 17, bold: true });
      label(ctx, rules.join("      "), view.w / 2, 52, { align: "center", size: 14, color: COLORS.muted });
    }

    // wires
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    if (g.parallel) {
      ctx.beginPath();
      for (const part of parts.slice(0, -1)) {
        ctx.moveTo(part.x, y0);
        ctx.lineTo(part.x, y1);
      }
      ctx.stroke();
      ctx.fillStyle = COLORS.ink;
      for (const part of parts.slice(0, -1)) {
        for (const y of [y0, y1]) {
          ctx.beginPath();
          ctx.arc(part.x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // electrons: out of the negative pole (bottom plate), back into the positive pole
    if (g.parallel) {
      const n = g.n;
      dots(ctx, [[parts[0].x, y0], [x0, y0], [x0, y1], [parts[0].x, y1]], phase[0] ?? 0);
      for (let j = 1; j < n; j++) {
        dots(ctx, [[parts[j].x, y0], [parts[j - 1].x, y0]], phase[j] ?? 0);
        dots(ctx, [[parts[j - 1].x, y1], [parts[j].x, y1]], phase[j] ?? 0);
      }
      parts.forEach((part, k) => dots(ctx, [[part.x, y1], [part.x, y0]], phase[n + k] ?? 0));
    } else {
      const perimeter = 2 * (x1 - x0 + y1 - y0);
      dots(ctx, [[x0, ym], [x0, y1], [x1, y1], [x1, y0], [x0, y0], [x0, ym]], phase[0] ?? 0, perimeter / Math.round(perimeter / 22));
    }

    // source: long thin plate is the positive pole
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(x0 - 5, ym - 6, 10, 12);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineCap = "butt";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 - 15, ym - 6);
    ctx.lineTo(x0 + 15, ym - 6);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0 - 8, ym + 7);
    ctx.lineTo(x0 + 8, ym + 7);
    ctx.stroke();
    label(ctx, "+", x0 + 24, ym - 9, { color: COLORS.red, bold: true, size, align: "center" });
    label(ctx, "−", x0 + 24, ym + 10, { color: COLORS.blue, bold: true, size, align: "center" });
    if (!small) label(ctx, "Nguồn điện", x0 - 24, ym - 12, { align: "right", size: 13, color: COLORS.muted });
    label(ctx, `U = ${fmt(s.voltage)} V`, x0 - 24, ym + (small ? 0 : 8), { align: "right", bold: true, size });

    // bulbs first (their glow must not hide switches or labels)
    parts.forEach((part, k) => drawBulb(ctx, part.bulb.x, part.bulb.y, g.rb, brightness(c.items[k].p)));
    parts.forEach((part, k) => {
      drawSwitch(ctx, g, part.sw, c.items[k].closed);
      if (g.parallel) {
        label(ctx, `K${SUB[k]}`, part.sw.x + 12, part.sw.y, { size, bold: true });
        label(ctx, `R${SUB[k]}`, part.bulb.x + g.rb + 7, part.bulb.y, { size, bold: true });
      } else {
        label(ctx, `K${SUB[k]}`, part.sw.x, y0 - g.half * 1.3 - 13, { size, bold: true, align: "center" });
        label(ctx, `R${SUB[k]}`, part.bulb.x, y0 + g.rb + 13, { size, bold: true, align: "center" });
      }
    });

    // main current, conventional direction: back into the negative pole along the bottom wire
    if (c.total > 0) arrow(ctx, x0 + (small ? 52 : 70), y1 + 12, x0 + (small ? 22 : 30), y1 + 12, COLORS.red, 2);
    label(ctx, `I = ${fmt(c.total, 3)} A`, x0 + (small ? 58 : 78), y1 + 13, { size, bold: true, color: COLORS.red });
    // convention: the dots are electrons, which move against the conventional current
    const noteY = y1 + (small ? 30 : 40);
    const note = small || view.w < 640 ? "electron, đi ngược chiều dòng điện I" : "electron, chuyển động ngược chiều dòng điện quy ước I (mũi tên đỏ)";
    ctx.font = `${small ? 11 : 13}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const noteX = Math.max(8, (view.w - ctx.measureText(note).width - 12) / 2);
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(noteX + 3, noteY, 3, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, note, noteX + 12, noteY, { size: small ? 11 : 13, color: COLORS.muted });

    drawTable(ctx, s, g, c);
  },
});
