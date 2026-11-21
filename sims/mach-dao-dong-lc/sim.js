import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { VISUAL_PERIOD, LIMITS, initialState, recharge, tidy, step, omega, period, maxCurrent, initialEnergy, energy } from "./model.js";

const range = key => ({ min: LIMITS[key][0], max: LIMITS[key][1] });
const ms = t => `${fmt(t * 1000, 3)} ms`;
/** Energy in the friendliest unit. */
const joule = w => (w >= 1e-3 ? `${fmt(w * 1e3, 2)} mJ` : `${fmt(w * 1e6, 1)} µJ`);
const restart = s => recharge(s);

function line(ctx, pts, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.stroke();
}

/** Dots spaced `gap` apart along a polyline, shifted by `phase` (0..1 of a gap): the moving charges. */
function dots(ctx, pts, phase, gap, color) {
  ctx.fillStyle = color;
  let d = (((phase % 1) + 1) % 1) * gap;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k];
    const [bx, by] = pts[k + 1];
    const len = Math.hypot(bx - ax, by - ay);
    for (; d < len; d += gap) {
      ctx.beginPath();
      ctx.arc(ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    d -= len;
  }
}

function geom(view) {
  const small = view.w < 560 || view.h < 420;
  const top = small ? 44 : 66;
  const graphsH = Math.max(110, Math.min((view.h - top) * 0.42, 260));
  const upperH = view.h - top - graphsH - (small ? 6 : 14);
  const barsW = Math.min(small ? 132 : 230, view.w * 0.4);
  // room on the left for the capacitor plates and their labels, on the right for the coil's field
  const left = small ? 46 : 84;
  const right = small ? 34 : 60;
  const bars = { x: view.w - barsW - (small ? 6 : 16), y: top, w: barsW, h: upperH };
  const cw = Math.min(bars.x - left - right, 420);
  const ch = Math.min(upperH - (small ? 26 : 40), 280);
  const circuit = { x: left + (bars.x - left - right - cw) / 2, y: top + (small ? 10 : 18) + (upperH - (small ? 26 : 40) - ch) / 2, w: cw, h: ch };
  const graphs = { x: small ? 26 : 50, y: view.h - graphsH, w: view.w - (small ? 34 : 70), h: graphsH - (small ? 16 : 22) };
  return { small, top, circuit, bars, graphs };
}

function drawCircuit(ctx, s, c, small) {
  const Q0 = s.charge0 * 1e-6;
  const I0 = maxCurrent(s);
  const qr = s.q / Q0; // −1..1
  const ir = s.i / I0;
  const x0 = c.x;
  const x1 = c.x + c.w;
  const y0 = c.y;
  const y1 = c.y + c.h;
  const my = (y0 + y1) / 2;
  const plateW = Math.min(small ? 46 : 80, c.w * 0.35);
  const gapC = small ? 14 : 22;
  const A = [x0, my - gapC / 2];
  const B = [x0, my + gapC / 2];
  const coilTop = my - Math.min(c.h * 0.32, 70);
  const coilBot = my + Math.min(c.h * 0.32, 70);

  // wires; the path runs from plate B round to plate A, so i > 0 (charge flowing onto A) moves along it
  const path = [B, [x0, y1], [x1, y1], [x1, y0], [x0, y0], A];
  line(ctx, path.slice(0, 3).concat([[x1, coilBot]]), COLORS.ink, 2.5);
  line(ctx, [[x1, coilTop], [x1, y0], [x0, y0], A], COLORS.ink, 2.5);

  // resistor on the top wire when R > 0
  if (s.resistance > 0) {
    const rx = (x0 + x1) / 2;
    const rw = small ? 34 : 50;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(rx - rw / 2, y0 - 8, rw, 16);
    const zig = [[rx - rw / 2, y0]];
    for (let k = 0; k < 6; k++) zig.push([rx - rw / 2 + ((k + 0.5) * rw) / 6, y0 + (k % 2 ? 6 : -6)]);
    zig.push([rx + rw / 2, y0]);
    line(ctx, zig, COLORS.ink, 2);
    label(ctx, `R = ${fmt(s.resistance, 1)} Ω`, rx, y0 - (small ? 14 : 18), { size: small ? 11 : 13, align: "center", color: COLORS.muted });
  }

  // capacitor: plates, charges, and an electric field whose strength follows |q|
  const field = Math.abs(qr);
  ctx.strokeStyle = `rgba(47, 111, 237, ${0.15 + 0.75 * field})`;
  ctx.lineWidth = 1.5;
  const nLines = 5;
  for (let k = 0; k < nLines; k++) {
    const x = x0 - plateW / 2 + ((k + 0.5) * plateW) / nLines;
    if (field > 0.05) arrow(ctx, x, qr > 0 ? A[1] + 2 : B[1] - 2, x, qr > 0 ? B[1] - 2 : A[1] + 2, `rgba(47, 111, 237, ${0.15 + 0.75 * field})`, 1.2);
  }
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x0 - plateW / 2, A[1] - 4, plateW, 4);
  ctx.fillRect(x0 - plateW / 2, B[1], plateW, 4);
  const n = Math.round(field * 5);
  for (let k = 0; k < n; k++) {
    const x = x0 - plateW / 2 + ((k + 0.5) * plateW) / 5;
    label(ctx, qr > 0 ? "+" : "−", x, A[1] - 12, { size: 13, align: "center", bold: true, color: qr > 0 ? COLORS.red : COLORS.blue });
    label(ctx, qr > 0 ? "−" : "+", x, B[1] + 13, { size: 13, align: "center", bold: true, color: qr > 0 ? COLORS.blue : COLORS.red });
  }
  label(ctx, "A", x0 - plateW / 2 - 8, A[1] - 2, { size: 12, align: "right", bold: true, color: COLORS.muted });
  label(ctx, "B", x0 - plateW / 2 - 8, B[1] + 3, { size: 12, align: "right", bold: true, color: COLORS.muted });
  label(ctx, "C", x0 + plateW / 2 + 6, my, { size: 14, bold: true });

  // inductor: a coil, with magnetic field loops whose strength follows |i|
  const turns = small ? 6 : 8;
  const cw = small ? 9 : 13;
  const mag = Math.abs(ir);
  if (mag > 0.05) {
    ctx.strokeStyle = `rgba(240, 140, 46, ${0.1 + 0.7 * mag})`;
    ctx.lineWidth = 1.5;
    for (const k of [1, 1.8]) {
      ctx.beginPath();
      ctx.ellipse(x1, my, cw * 1.6 * k, (coilBot - coilTop) / 2 + 8 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    label(ctx, "B", x1 + cw * 1.6 + 6, coilTop - 4, { size: 13, bold: true, color: `rgba(240, 140, 46, ${0.3 + 0.7 * mag})` });
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x1, coilTop);
  for (let k = 0; k < turns; k++) {
    const ya = coilTop + ((coilBot - coilTop) * k) / turns;
    const yb = coilTop + ((coilBot - coilTop) * (k + 1)) / turns;
    ctx.bezierCurveTo(x1 + cw, ya, x1 + cw, yb, x1, yb);
  }
  ctx.stroke();
  label(ctx, "L", x1 - cw - 6, my, { size: 14, bold: true, align: "right" });

  // moving dots: the conventional current, speed and direction following i
  dots(ctx, path, s._flow ?? 0, small ? 18 : 24, `rgba(31, 157, 107, ${0.25 + 0.75 * mag})`);
  if (mag > 0.05) {
    const ay = y1 + (small ? 12 : 16);
    const dir = Math.sign(s.i); // i > 0: along the path B → bottom → right → top → A, i.e. rightwards on the bottom wire
    const cx = (x0 + x1) / 2;
    arrow(ctx, cx - dir * 22, ay, cx + dir * 22, ay, COLORS.green, 2.5);
    label(ctx, "i", cx + dir * 30, ay, { size: 13, bold: true, align: "center", color: COLORS.green });
  }
}

function drawBars(ctx, s, b, small) {
  const W = initialEnergy(s);
  const e = energy(s);
  const items = [
    ["W_C", e.electric, COLORS.blue],
    ["W_L", e.magnetic, COLORS.orange],
    ["W", e.total, COLORS.green],
  ];
  const bw = Math.min(small ? 28 : 44, b.w / 4);
  const gap = (b.w - 3 * bw) / 3;
  const y1 = b.y + b.h - (small ? 30 : 38);
  const hMax = y1 - b.y - (small ? 22 : 28);
  label(ctx, small ? "Năng lượng" : "Năng lượng (W = Q₀²/2C khi R = 0)", b.x + b.w / 2, b.y + 2, { size: small ? 11 : 12, align: "center", color: COLORS.muted });
  items.forEach(([name, value, color], k) => {
    const x = b.x + gap / 2 + k * (bw + gap);
    const h = Math.min(1, value / W) * hMax;
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(x, y1 - hMax, bw, hMax);
    ctx.fillStyle = color;
    ctx.fillRect(x, y1 - h, bw, h);
    label(ctx, name, x + bw / 2, y1 + 10, { size: 12, align: "center", bold: true, color });
    label(ctx, joule(value), x + bw / 2, y1 + (small ? 23 : 27), { size: small ? 9.5 : 11, align: "center", color: COLORS.muted });
  });
}

function drawGraphs(ctx, s, g, small) {
  const T = period(s);
  const hist = s._hist ?? [];
  const t1 = Math.max(2 * T, s.time);
  const t0 = t1 - 2 * T;
  const X = t => g.x + ((t - t0) / (t1 - t0)) * g.w;
  const half = (g.h - 8) / 2;
  const rows = [
    { name: "q", peak: "Q₀", unit: "µC", scale: s.charge0 * 1e-6, k: 1e6, color: COLORS.blue, idx: 1 },
    { name: "i", peak: "I₀", unit: "mA", scale: maxCurrent(s), k: 1e3, color: COLORS.orange, idx: 2 },
  ];
  rows.forEach((r, n) => {
    const y = g.y + n * (half + 8);
    const mid = y + half / 2;
    const Y = v => mid - (v / r.scale) * (half / 2 - 2);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(g.x, y, g.w, half);
    ctx.beginPath();
    ctx.moveTo(g.x, mid);
    ctx.lineTo(g.x + g.w, mid);
    ctx.stroke();
    // quarter-period grid
    for (let t = Math.ceil(t0 / (T / 4)) * (T / 4); t <= t1 + 1e-12; t += T / 4) {
      ctx.beginPath();
      ctx.moveTo(X(t), y);
      ctx.lineTo(X(t), y + half);
      ctx.stroke();
    }
    label(ctx, r.name, g.x - 8, mid, { size: 14, bold: true, align: "right", color: r.color });
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x, y, g.w, half);
    ctx.clip();
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const p of hist) if (p[0] >= t0) ctx.lineTo(X(p[0]), Y(p[r.idx]));
    ctx.stroke();
    ctx.restore();
    // the scale: the top of the box is Q₀ (or I₀), on a backing so the curve cannot hide it
    const peak = `${r.peak} = ${fmt(r.scale * r.k, 1)} ${r.unit}`;
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(247, 249, 253, 0.85)";
    ctx.fillRect(g.x + 1, y + 1, ctx.measureText(peak).width + 8, 13);
    label(ctx, peak, g.x + 4, y + 8, { size: 10, color: COLORS.muted });
    const now = r.idx === 1 ? s.q : s.i;
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(X(s.time), Y(now), 4, 0, Math.PI * 2);
    ctx.fill();
  });
  label(ctx, `${small ? "" : "i sớm pha π/2 so với q.   "}t (lưới: T/4 = ${ms(T / 4)})`, g.x + g.w, g.y + g.h + (small ? 8 : 12), { size: 11, align: "right", color: COLORS.muted });
}

mount({
  slug: "mach-dao-dong-lc",
  version: "1.0.0",
  title: "Mạch dao động LC",
  hint: "Tụ điện đã tích điện phóng điện qua cuộn cảm. Quan sát điện tích, dòng điện và năng lượng chuyển qua lại giữa điện trường của tụ và từ trường của cuộn cảm.",
  initialState,
  autoplay: true,
  step(s, dt, api) {
    if (step(s, dt)) {
      api.emit("period-measured", { period: s.measuredPeriod, formulaPeriod: period(s), resistance: s.resistance }, "result");
    }
    s._flow = (s._flow ?? 0) + (s.i / maxCurrent(s)) * dt * 2.5;
  },
  sanitize(incoming, base) {
    for (const key of Object.keys(base)) {
      if (typeof incoming[key] === "number" && Number.isFinite(incoming[key])) base[key] = incoming[key];
    }
    base._hist = [];
    return tidy(base);
  },
  controls: [
    { type: "slider", key: "inductance", label: "Độ tự cảm L", ...range("inductance"), step: 1, unit: "mH", onChange: restart },
    { type: "slider", key: "capacitance", label: "Điện dung C", ...range("capacitance"), step: 1, unit: "µF", onChange: restart },
    { type: "slider", key: "charge0", label: "Điện tích ban đầu Q₀", ...range("charge0"), step: 10, unit: "µC", onChange: restart },
    { type: "slider", key: "resistance", label: "Điện trở R (gây tắt dần)", ...range("resistance"), step: 0.5, unit: "Ω", digits: 1 },
    {
      type: "button",
      label: "Tích điện lại cho tụ",
      primary: true,
      action(s, api) {
        recharge(s);
        api.play();
        api.emit("recharge", { charge: s.charge0, inductance: s.inductance, capacitance: s.capacitance }, "action");
      },
    },
  ],
  readouts: [
    { label: "ω = 1/√(LC)", value: s => `${fmt(omega(s), 0)} rad/s` },
    { label: "Chu kì T = 2π√(LC)", value: s => ms(period(s)) },
    { label: "Chu kì đo được", value: s => (s.measuredPeriod ? ms(s.measuredPeriod) : "–") },
    { label: "I₀ = ωQ₀", value: s => `${fmt(maxCurrent(s) * 1e3, 1)} mA` },
    { label: "q", value: s => `${fmt(s.q * 1e6, 1)} µC` },
    { label: "i", value: s => `${fmt(s.i * 1e3, 1)} mA` },
    { label: "Năng lượng điện từ W", value: s => joule(energy(s).total) },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const T = period(s);
    const size = g.small ? 12 : 15;
    label(ctx, `T = 2π√(LC) = ${ms(T)}   đo được: ${s.measuredPeriod ? ms(s.measuredPeriod) : "–"}`, 12, g.small ? 13 : 20, { size, bold: true });
    label(
      ctx,
      g.small
        ? `Làm chậm: 1 chu kì hiện trong ${VISUAL_PERIOD} s. i > 0: dòng tới bản A`
        : `Đã làm chậm: mỗi chu kì hiện trong ${VISUAL_PERIOD} s. q là điện tích bản A; i = q′ > 0 khi dòng điện (chiều quy ước) chạy tới bản A.`,
      12,
      g.small ? 31 : 44,
      { size: g.small ? 10.5 : 12, color: COLORS.muted },
    );
    drawCircuit(ctx, s, g.circuit, g.small);
    drawBars(ctx, s, g.bars, g.small);
    drawGraphs(ctx, s, g.graphs, g.small);
  },
});
