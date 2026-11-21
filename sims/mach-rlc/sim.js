import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, solve, atResonance, instant } from "./model.js";

const F_MIN = 10;
const F_MAX = 200;
const deg = rad => (rad * 180) / Math.PI;

// One result per finished change; the goal once each time the circuit is tuned into resonance.
const report = (s, api) => {
  const c = solve(s);
  api.emit("circuit-solved", { impedance: c.z, current: c.current, phase: deg(c.phi), powerFactor: c.cosPhi, power: c.power, frequency: s.frequency }, "result");
  const res = atResonance(s);
  if (res && !s._res) api.emit("resonance", { frequency: s.frequency, resonantFrequency: c.f0, current: c.current, impedance: c.z }, "goal");
  s._res = res;
};

// Label with subscripts: "Z_L" draws L as a subscript (one letter or digit after "_").
function sl(ctx, text, x, y, o = {}) {
  const size = o.size ?? 14;
  const parts = text.split(/_(.)/); // even: normal text, odd: subscript
  ctx.save();
  const font = sz => `${o.bold ? "600 " : ""}${sz}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const width = parts.reduce((w, p, k) => {
    ctx.font = font(k % 2 ? size * 0.75 : size);
    return w + ctx.measureText(p).width;
  }, 0);
  let cx = o.align === "center" ? x - width / 2 : o.align === "right" ? x - width : x;
  ctx.restore();
  parts.forEach((p, k) => {
    if (!p) return;
    label(ctx, p, cx, y + (k % 2 ? size * 0.3 : 0), { ...o, size: k % 2 ? size * 0.75 : size, align: "left" });
    ctx.font = font(k % 2 ? size * 0.75 : size);
    cx += ctx.measureText(p).width;
  });
}

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 8 : 16;
  const circH = small ? Math.max(70, Math.min(96, view.h * 0.28)) : Math.min(170, view.h * 0.27);
  const circuit = { x: pad, y: pad, w: view.w - 2 * pad, h: circH };
  const top = circuit.y + circuit.h + (small ? 6 : 14);
  const bottom = view.h - pad;
  const leftW = small ? Math.floor((view.w - 2 * pad) * 0.46) : Math.min(380, (view.w - 2 * pad) * 0.45);
  const phasor = { x: pad, y: top, w: leftW, h: bottom - top };
  const rx = pad + leftW + (small ? 8 : 20);
  const rw = view.w - pad - rx;
  // The I(f) curve needs room; on a short or narrow stage only u(t), i(t) are drawn.
  const both = !small && bottom - top > 300;
  const wave = { x: rx, y: top, w: rw, h: both ? (bottom - top) * 0.5 - 8 : bottom - top };
  const curve = both ? { x: rx, y: top + (bottom - top) * 0.5 + 8, w: rw, h: (bottom - top) * 0.5 - 8 } : null;
  return { small, circuit, phasor, wave, curve };
}

function box(ctx, r) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

function drawCircuit(ctx, s, c, r, small) {
  const size = small ? 11 : 13;
  const x0 = r.x + (small ? 34 : 60);
  const x1 = r.x + r.w - (small ? 14 : 30);
  const y0 = r.y + (small ? 22 : 40);
  const y1 = r.y + r.h - (small ? 8 : 18);
  const ym = (y0 + y1) / 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

  // AC source on the left side
  const sr = Math.min(small ? 11 : 16, (y1 - y0) / 2 - 2);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x0, ym, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const px = x0 - sr * 0.6 + 1.2 * sr * t;
    const py = ym - sr * 0.35 * Math.sin(2 * Math.PI * t);
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  label(ctx, "u", x0 - sr - 6, ym, { size, align: "right", bold: true });

  // R, L, C along the top wire
  const slots = [0.25, 0.5, 0.75].map(t => x0 + (x1 - x0) * t);
  const hw = small ? 15 : 24;
  const clear = x => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - hw - 1, y0 - 12, 2 * hw + 2, 24);
  };
  // R: rectangle
  clear(slots[0]);
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  ctx.moveTo(slots[0] - hw - 1, y0);
  ctx.lineTo(slots[0] - hw * 0.8, y0);
  ctx.moveTo(slots[0] + hw * 0.8, y0);
  ctx.lineTo(slots[0] + hw + 1, y0);
  ctx.stroke();
  ctx.strokeRect(slots[0] - hw * 0.8, y0 - 6, hw * 1.6, 12);
  // L: coil, or a plain wire when removed
  clear(slots[1]);
  ctx.strokeStyle = s.useL ? COLORS.ink : COLORS.grid;
  ctx.beginPath();
  ctx.moveTo(slots[1] - hw - 1, y0);
  for (let k = 0; k < 4; k++) {
    const cx = slots[1] - hw + (hw / 2) * (k + 0.5);
    ctx.arc(cx, y0, hw / 4, Math.PI, 0);
  }
  ctx.lineTo(slots[1] + hw + 1, y0);
  ctx.stroke();
  // C: two plates
  clear(slots[2]);
  ctx.strokeStyle = s.useC ? COLORS.ink : COLORS.grid;
  ctx.beginPath();
  ctx.moveTo(slots[2] - hw - 1, y0);
  ctx.lineTo(slots[2] - 4, y0);
  ctx.moveTo(slots[2] + 4, y0);
  ctx.lineTo(slots[2] + hw + 1, y0);
  ctx.moveTo(slots[2] - 4, y0 - 10);
  ctx.lineTo(slots[2] - 4, y0 + 10);
  ctx.moveTo(slots[2] + 4, y0 - 10);
  ctx.lineTo(slots[2] + 4, y0 + 10);
  ctx.stroke();
  // a removed element is bridged by a wire
  ctx.strokeStyle = COLORS.ink;
  ctx.beginPath();
  if (!s.useL) {
    ctx.moveTo(slots[1] - hw - 1, y0);
    ctx.lineTo(slots[1] + hw + 1, y0);
  }
  if (!s.useC) {
    ctx.moveTo(slots[2] - hw - 1, y0);
    ctx.lineTo(slots[2] + hw + 1, y0);
  }
  ctx.stroke();

  const ly = y0 - (small ? 15 : 22);
  label(ctx, small ? `R ${fmt(c.R, 0)} Ω` : `R = ${fmt(c.R, 0)} Ω`, slots[0], ly, { size, align: "center", bold: true });
  label(ctx, s.useL ? (small ? `L ${fmt(s.inductance)} H` : `L = ${fmt(s.inductance)} H`) : "(bỏ L)", slots[1], ly, { size, align: "center", bold: s.useL, color: s.useL ? COLORS.ink : COLORS.muted });
  label(ctx, s.useC ? (small ? `C ${fmt(s.capacitance, 0)} µF` : `C = ${fmt(s.capacitance, 0)} µF`) : "(bỏ C)", slots[2], ly, { size, align: "center", bold: s.useC, color: s.useC ? COLORS.ink : COLORS.muted });
  if (!small) {
    sl(ctx, `Z_L = ${fmt(c.zL, 1)} Ω`, slots[1], y0 + 22, { size: 12, align: "center", color: COLORS.muted });
    sl(ctx, `Z_C = ${fmt(c.zC, 1)} Ω`, slots[2], y0 + 22, { size: 12, align: "center", color: COLORS.muted });
  }
  const text = small
    ? `U = ${fmt(s.voltage, 0)} V, f = ${fmt(s.frequency, 1)} Hz`
    : `U = ${fmt(s.voltage, 0)} V (hiệu dụng), f = ${fmt(s.frequency, 1)} Hz`;
  label(ctx, text, (x0 + x1) / 2, ym + (small ? 4 : 6), { size, align: "center" });
  label(ctx, small ? `I = ${fmt(c.current, 3)} A` : `I = ${fmt(c.current, 3)} A   Z = ${fmt(c.z, 1)} Ω`, (x0 + x1) / 2, ym + (small ? 18 : 26), { size, align: "center", bold: true, color: COLORS.red });
}

function drawPhasor(ctx, s, c, r, small) {
  box(ctx, r);
  const size = small ? 11 : 13;
  label(ctx, small ? "Giản đồ Fre-nen" : "Giản đồ Fre-nen (trục gốc: I)", r.x + 6, r.y + 11, { size, bold: true });
  const ox = r.x + (small ? 14 : 30);
  // between the title (top 22 px) and the verdict line (bottom 20 px), with room for the U_L / U_C labels
  const oy = r.y + 22 + (r.h - 42) / 2;
  const maxLen = Math.min(r.w - (small ? 34 : 70), (r.h - 42) / 2 - 16);
  const big = Math.max(s.voltage, c.uL, c.uC, 1e-9);
  const k = maxLen / big;
  // axis of I
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox - 6, oy);
  ctx.lineTo(r.x + r.w - 6, oy);
  ctx.stroke();
  const ur = c.uR * k;
  const ul = c.uL * k;
  const uc = c.uC * k;
  const ux = ur;
  const uy = ul - uc;
  // projections (dashed)
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(ox + ur, oy);
  ctx.lineTo(ox + ux, oy - uy);
  ctx.moveTo(ox, oy - uy);
  ctx.lineTo(ox + ux, oy - uy);
  ctx.stroke();
  ctx.setLineDash([]);
  const lw = small ? 2 : 3;
  arrow(ctx, ox, oy, ox + ur, oy, COLORS.ink, lw);
  if (s.useL) arrow(ctx, ox, oy, ox, oy - ul, COLORS.orange, lw);
  if (s.useC) arrow(ctx, ox, oy, ox, oy + uc, COLORS.purple, lw);
  arrow(ctx, ox, oy, ox + ux, oy - uy, COLORS.blue, lw + 0.5);
  // φ arc
  if (Math.abs(c.phi) > 0.02) {
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const ra = Math.min(28, ur * 0.6);
    ctx.arc(ox, oy, ra, Math.min(0, -c.phi), Math.max(0, -c.phi));
    ctx.stroke();
    label(ctx, "φ", ox + ra + 4, oy - Math.sign(c.phi) * 9, { size, color: COLORS.green, bold: true });
  }
  sl(ctx, "U_R", ox + ur, oy + (uy < 0 ? -11 : 11), { size, align: "center" }); // on the side away from U
  if (s.useL) sl(ctx, "U_L", ox + 4, oy - ul - (small ? 7 : 9), { size, color: COLORS.orange, bold: true });
  if (s.useC) sl(ctx, "U_C", ox + 4, oy + uc + (small ? 7 : 9), { size, color: COLORS.purple, bold: true });
  label(ctx, "U", ox + ux + 5, oy - uy - 6, { size: size + 1, color: COLORS.blue, bold: true });
  label(ctx, "I", r.x + r.w - 10, oy - 9, { size, align: "right", color: COLORS.red, bold: true });
  const verdict = Math.abs(c.phi) < 1e-3 ? "u, i cùng pha" : c.phi > 0 ? "i trễ pha so với u" : "i sớm pha so với u";
  label(ctx, `φ = ${fmt(deg(c.phi), 1)}°: ${verdict}`, r.x + 6, r.y + r.h - 10, { size, color: COLORS.muted });
}

function drawWave(ctx, s, c, r, small) {
  box(ctx, r);
  const size = small ? 11 : 13;
  label(ctx, "u(t)", r.x + 6, r.y + 11, { size, bold: true, color: COLORS.blue });
  label(ctx, "i(t)", r.x + (small ? 36 : 44), r.y + 11, { size, bold: true, color: COLORS.red });
  if (!small) label(ctx, "(mỗi đường một thang đo)", r.x + 80, r.y + 11, { size: 11, color: COLORS.muted });
  const x0 = r.x + 8;
  const x1 = r.x + r.w - 8;
  const ym = r.y + r.h / 2 + 6;
  const amp = r.h / 2 - 22;
  const period = (2 * Math.PI) / c.omega;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, ym);
  ctx.lineTo(x1, ym);
  for (const t of [1, 2]) {
    const x = x0 + ((x1 - x0) * t) / 2;
    ctx.moveTo(x, ym - amp);
    ctx.lineTo(x, ym + amp);
  }
  ctx.stroke();
  const uMax = s.voltage * Math.SQRT2;
  const iMax = c.current * Math.SQRT2;
  for (const [key, max, color] of [["u", uMax, COLORS.blue], ["i", iMax, COLORS.red]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let k = 0; k <= 160; k++) {
      const t = (2 * period * k) / 160;
      const v = instant(s, t)[key] / (max || 1);
      const x = x0 + ((x1 - x0) * k) / 160;
      k ? ctx.lineTo(x, ym - v * amp * (key === "i" ? 0.8 : 1)) : ctx.moveTo(x, ym - v * amp * (key === "i" ? 0.8 : 1));
    }
    ctx.stroke();
  }
  label(ctx, "T", x0 + (x1 - x0) / 2 + 4, ym + amp - 2, { size: 11, color: COLORS.muted });
  label(ctx, "t", x1 - 2, ym + 9, { size: 11, color: COLORS.muted, align: "right" });
  if (!small) label(ctx, `T = ${fmt(period * 1000, 2)} ms`, r.x + r.w - 8, r.y + 11, { size: 12, align: "right", color: COLORS.muted });
}

function drawCurve(ctx, s, c, r) {
  box(ctx, r);
  label(ctx, "Cường độ hiệu dụng I theo tần số f", r.x + 6, r.y + 11, { size: 13, bold: true });
  const x0 = r.x + 34;
  const x1 = r.x + r.w - 12;
  const y0 = r.y + 28;
  const y1 = r.y + r.h - 22;
  const iAt = f => solve({ ...s, frequency: f }).current;
  const iTop = Math.max(s.voltage / c.R, c.current) * 1.08; // I is largest at resonance, U/R
  const X = f => x0 + ((f - F_MIN) / (F_MAX - F_MIN)) * (x1 - x0);
  const Y = i => y1 - (i / iTop) * (y1 - y0);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  label(ctx, `${F_MIN}`, x0, y1 + 10, { size: 11, align: "center", color: COLORS.muted });
  label(ctx, `${F_MAX} Hz`, x1, y1 + 10, { size: 11, align: "right", color: COLORS.muted });
  label(ctx, "I", x0 - 8, y0 + 2, { size: 12, align: "right", color: COLORS.muted });
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = 0; k <= 240; k++) {
    const f = F_MIN + ((F_MAX - F_MIN) * k) / 240;
    k ? ctx.lineTo(X(f), Y(iAt(f))) : ctx.moveTo(X(f), Y(iAt(f)));
  }
  ctx.stroke();
  if (Number.isFinite(c.f0) && c.f0 >= F_MIN && c.f0 <= F_MAX) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.green;
    ctx.beginPath();
    ctx.moveTo(X(c.f0), y0);
    ctx.lineTo(X(c.f0), y1);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, `f₀ = ${fmt(c.f0, 1)} Hz`, X(c.f0) + 5, y0 + 2, { size: 12, color: COLORS.green, bold: true, align: X(c.f0) > x1 - 90 ? "right" : "left" });
  }
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.arc(X(s.frequency), Y(c.current), 5, 0, Math.PI * 2);
  ctx.fill();
}

mount({
  slug: "mach-rlc",
  version: "1.0.0",
  title: "Mạch RLC nối tiếp",
  hint: "Thay đổi tần số f để tìm cộng hưởng: lúc đó Z = R, u và i cùng pha, I lớn nhất.",
  initialState,
  controls: [
    { type: "heading", label: "Nguồn xoay chiều" },
    { type: "slider", key: "voltage", label: "Điện áp hiệu dụng U", min: 10, max: 220, step: 5, unit: "V", digits: 0 },
    { type: "slider", key: "frequency", label: "Tần số f", min: F_MIN, max: F_MAX, step: 0.5, unit: "Hz", digits: 1 },
    { type: "heading", label: "Đoạn mạch" },
    { type: "slider", key: "resistance", label: "Điện trở R", min: 10, max: 200, step: 1, unit: "Ω", digits: 0 },
    { type: "checkbox", key: "useL", label: "Có cuộn cảm thuần L" },
    { type: "slider", key: "inductance", label: "Độ tự cảm L", min: 0.05, max: 1, step: 0.01, unit: "H", visible: s => s.useL },
    { type: "checkbox", key: "useC", label: "Có tụ điện C" },
    { type: "slider", key: "capacitance", label: "Điện dung C", min: 5, max: 200, step: 1, unit: "µF", digits: 0, visible: s => s.useC },
  ].map(c => (c.key ? { ...c, onCommit: report } : c)),
  readouts: [
    { label: "Cảm kháng ZL = ωL", value: s => `${fmt(solve(s).zL, 1)} Ω` },
    { label: "Dung kháng ZC = 1/(ωC)", value: s => `${fmt(solve(s).zC, 1)} Ω` },
    { label: "Tổng trở Z", value: s => `${fmt(solve(s).z, 1)} Ω` },
    { label: "Cường độ hiệu dụng I = U/Z", value: s => `${fmt(solve(s).current, 3)} A` },
    { label: "Độ lệch pha φ (u so với i)", value: s => `${fmt(deg(solve(s).phi), 1)}°` },
    { label: "Hệ số công suất cos φ", value: s => fmt(solve(s).cosPhi, 3) },
    { label: "Công suất P = UIcos φ", value: s => `${fmt(solve(s).power, 1)} W` },
    { label: "Tần số cộng hưởng f₀", value: s => (Number.isFinite(solve(s).f0) ? `${fmt(solve(s).f0, 1)} Hz` : "– (cần cả L và C)") },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    const c = solve(s);
    drawCircuit(ctx, s, c, g.circuit, g.small);
    drawPhasor(ctx, s, c, g.phasor, g.small);
    drawWave(ctx, s, c, g.wave, g.small);
    if (g.curve) drawCurve(ctx, s, c, g.curve);
    if (atResonance(s)) {
      // badge sits on the bottom wire of the circuit, clear of the element labels
      const size = g.small ? 11 : 13;
      const text = g.small ? "CỘNG HƯỞNG: Z = R" : "CỘNG HƯỞNG ĐIỆN: Z = R, φ = 0, I lớn nhất";
      ctx.font = `600 ${size}px system-ui, sans-serif`;
      const w = ctx.measureText(text).width + 14;
      const h = size + 6;
      const cy = g.circuit.y + g.circuit.h - (g.small ? 8 : 18);
      const x = g.circuit.x + g.circuit.w / 2 - w / 2;
      ctx.fillStyle = COLORS.green;
      ctx.fillRect(x, cy - h / 2, w, h);
      label(ctx, text, x + 7, cy, { size, bold: true, color: "#fff" });
    }
  },
});
