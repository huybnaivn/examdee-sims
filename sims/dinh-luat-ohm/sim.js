import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, step, current, power } from "./model.js";

const U_MAX = 12; // V, right end of the graph
const I_MAX = 2.4; // A, top of the graph (= U_MAX / smallest R)

const layout = view => {
  const small = view.w < 560; // narrow: circuit above the graph, otherwise side by side
  const split = Math.round(small ? view.h * 0.53 : view.w * 0.52);
  const circuit = small ? { x: 0, y: 0, w: view.w, h: split } : { x: 0, y: 0, w: split, h: view.h };
  const g = small ? { x: 0, y: split, w: view.w, h: view.h - split } : { x: split, y: 0, w: view.w - split, h: view.h };
  const ml = small ? 40 : 54;
  const mr = small ? 58 : 56;
  const mt = small ? 34 : 70;
  const mb = small ? 24 : 60;
  const w = g.w - ml - mr;
  const h = Math.min(g.h - mt - mb, w * 0.9);
  return { small, circuit, plot: { x: g.x + ml, y: g.y + mt + (g.h - mt - mb - h) / 2, w, h } };
};

const setVoltage = (p, s, view) => {
  const { plot } = layout(view);
  s.voltage = clamp(Math.round(((p.x - plot.x) / plot.w) * U_MAX * 2) / 2, 0, U_MAX);
};

function dots(ctx, pts, phase, gap) {
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

function meter(ctx, x, y, r, letter) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, letter, x, y + 1, { align: "center", bold: true, size: r });
}

function drawCircuit(ctx, s, b, small) {
  const I = current(s);
  const m = small ? 13 : 18; // meter radius
  const size = small ? 12 : 15;
  const vGap = small ? 34 : 64; // voltmeter height above the resistor
  const padL = small ? 78 : 104;
  const padR = small ? 34 : 44;
  const top = vGap + m + 22;
  const bottom = m + 26 + (small ? 0 : 110);
  const bw = Math.min(b.w - padL - padR, 400);
  const bh = Math.min(b.h - top - bottom, 250);
  const x0 = b.x + padL + (b.w - padL - padR - bw) / 2;
  const x1 = x0 + bw;
  const y0 = b.y + top + (b.h - top - bottom - bh) / 2;
  const y1 = y0 + bh;
  const cx = (x0 + x1) / 2;
  const ym = (y0 + y1) / 2;
  const rw = small ? 54 : 76; // resistor size
  const rh = small ? 18 : 24;
  const tap = rw / 2 + 12; // where the voltmeter leads join the wire
  const yv = y0 - vGap;

  // wires
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeRect(x0, y0, bw, bh);
  ctx.beginPath();
  ctx.moveTo(cx - tap, y0);
  ctx.lineTo(cx - tap, yv);
  ctx.lineTo(cx + tap, yv);
  ctx.lineTo(cx + tap, y0);
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  for (const x of [cx - tap, cx + tap]) {
    ctx.beginPath();
    ctx.arc(x, y0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // electrons: leave the negative pole (bottom plate), go round to the positive pole
  const loop = [[x0, ym], [x0, y1], [x1, y1], [x1, y0], [x0, y0], [x0, ym]];
  const perimeter = 2 * (bw + bh);
  dots(ctx, loop, s._phase || 0, perimeter / Math.round(perimeter / 24));

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
  label(ctx, `U = ${fmt(s.voltage, 1)} V`, x0 - 24, ym + (small ? 0 : 8), { align: "right", bold: true, size });

  // resistor
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.fillRect(cx - rw / 2, y0 - rh / 2, rw, rh);
  ctx.strokeRect(cx - rw / 2, y0 - rh / 2, rw, rh);
  label(ctx, `R = ${fmt(s.resistance)} Ω`, cx, y0 + rh / 2 + 13, { align: "center", bold: true, size });

  // voltmeter across the resistor, ammeter in series
  meter(ctx, cx, yv, m, "V");
  label(ctx, `${fmt(s.voltage, 1)} V`, cx, yv - m - 11, { align: "center", bold: true, size, color: COLORS.green });
  meter(ctx, cx, y1, m, "A");
  label(ctx, `${fmt(I, 3)} A`, cx, y1 + m + 12, { align: "center", bold: true, size, color: COLORS.red });

  // conventional current direction: out of the positive pole
  if (I > 0) {
    const xa = x0 + (small ? 16 : 24);
    arrow(ctx, xa, y0 - 11, xa + (small ? 30 : 40), y0 - 11, COLORS.red, 2);
    label(ctx, "I", xa + (small ? 15 : 20), y0 - 24, { color: COLORS.red, bold: true, size, align: "center" });
  }

  if (!small) {
    const mid = b.x + b.w / 2;
    const y = y1 + m + 62;
    label(ctx, `I = U / R = ${fmt(s.voltage, 1)} / ${fmt(s.resistance)} = ${fmt(I, 3)} A`, mid, y, { align: "center", bold: true, size: 18 });
    label(ctx, `P = U·I = ${fmt(power(s), 2)} W`, mid, y + 30, { align: "center", size: 16, color: COLORS.muted });
  }
}

function drawGraph(ctx, s, p, small) {
  const size = small ? 11 : 13;
  const X = u => p.x + (u / U_MAX) * p.w;
  const Y = i => p.y + p.h - (i / I_MAX) * p.h;
  const I = current(s);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let k = 1; k <= 4; k++) {
    ctx.beginPath();
    ctx.moveTo(X(k * 3), Y(0));
    ctx.lineTo(X(k * 3), p.y);
    ctx.moveTo(p.x, Y(k * 0.6));
    ctx.lineTo(X(U_MAX), Y(k * 0.6));
    ctx.stroke();
  }
  for (let k = 0; k <= 4; k++) {
    label(ctx, fmt(k * 3), X(k * 3), Y(0) + 13, { align: "center", size, color: COLORS.muted });
    if (k) label(ctx, fmt(k * 0.6, 1), p.x - 8, Y(k * 0.6), { align: "right", size, color: COLORS.muted });
  }
  const over = small ? 12 : 18; // how far the axes run past the last tick
  arrow(ctx, p.x, Y(0), X(U_MAX) + over, Y(0), COLORS.ink, 2);
  arrow(ctx, p.x, Y(0), p.x, p.y - over, COLORS.ink, 2);
  label(ctx, "U (V)", X(U_MAX) + over + 4, Y(0), { size, bold: true });
  label(ctx, "I (A)", p.x, p.y - over - 10, { size, bold: true, align: "center" });
  if (!small) label(ctx, "Đồ thị I – U của điện trở", p.x + p.w / 2, p.y - 56, { align: "center", bold: true, size: 16 });

  // I = U / R for the chosen resistor: a straight line through the origin
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  ctx.lineTo(X(U_MAX), Y(U_MAX / s.resistance));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x + 12, p.y + 10);
  ctx.lineTo(p.x + 34, p.y + 10);
  ctx.stroke();
  label(ctx, `R = ${fmt(s.resistance)} Ω`, p.x + 40, p.y + 10, { size, color: COLORS.blue, bold: true });

  // the live measurement
  const px = X(s.voltage);
  const py = Y(I);
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(px, Y(0));
  ctx.lineTo(px, py);
  ctx.lineTo(p.x, py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.orange;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, small ? 6 : 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const text = `(${fmt(s.voltage, 1)} V; ${fmt(I, 3)} A)`;
  const left = px - p.x > (small ? 100 : 130); // room for the text on the left of the point?
  label(ctx, text, px + (left ? -10 : 12), left ? Math.max(py - 14, p.y + 26) : Math.min(py + 16, Y(0) - 10), {
    size,
    bold: true,
    color: COLORS.orange,
    align: left ? "right" : "left",
  });
}

mount({
  slug: "dinh-luat-ohm",
  version: "1.0.0",
  title: "Định luật Ôm",
  hint: "Thay đổi U và R, hoặc kéo điểm đo trên đồ thị. Các chấm xanh là electron, chuyển động ngược chiều dòng điện.",
  initialState,
  step,
  autoplay: true,
  controls: [
    { type: "slider", key: "voltage", label: "Hiệu điện thế U", min: 0, max: U_MAX, step: 0.5, unit: "V", digits: 1 },
    { type: "slider", key: "resistance", label: "Điện trở R", min: 5, max: 50, step: 1, unit: "Ω", digits: 0 },
  ],
  readouts: [
    { label: "Số chỉ vôn kế U", value: s => `${fmt(s.voltage, 1)} V` },
    { label: "Số chỉ ampe kế I = U/R", value: s => `${fmt(current(s), 3)} A` },
    { label: "Tỉ số U/I", value: s => (s.voltage ? `${fmt(s.voltage / current(s))} Ω` : "–") },
    { label: "Công suất P = U·I", value: s => `${fmt(power(s))} W` },
  ],
  pointer: {
    down(p, s, api, view) {
      const { plot } = layout(view);
      if (p.x < plot.x - 20 || p.x > plot.x + plot.w + 20 || p.y < plot.y - 20 || p.y > plot.y + plot.h + 24) return false;
      setVoltage(p, s, view);
    },
    move: (p, s, api, view) => setVoltage(p, s, view),
    up(p, s, api) {
      api.emit("measure", { voltage: s.voltage, current: current(s) }, "result");
    },
  },
  draw(ctx, s, view) {
    const { small, circuit, plot } = layout(view);
    drawCircuit(ctx, s, circuit, small);
    drawGraph(ctx, s, plot, small);
  },
});
