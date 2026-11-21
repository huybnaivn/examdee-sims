import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { SOLUTIONS, LOG_C_MIN, LOG_C_MAX, initialState, measure, solutionIndex, equation, ionText, pretty, P_RATED } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const fit = (ctx, text, x, y, maxW, opts) => {
  ctx.font = `${opts.bold ? "600 " : ""}${opts.size}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, size: tw > maxW ? (opts.size * maxW) / tw : opts.size });
};

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** Number with 3 significant digits; very small values as a·10⁻ⁿ. */
function num(x) {
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -3) return fmt(x, clamp(2 - e, 0, 6));
  const m = x / 10 ** e;
  return `${fmt(m, 2)}·10⁻${String(-e).replace(/\d/g, d => SUP[d])}`;
}

// deterministic scatter so the picture does not jump on every redraw
const rand = seed => {
  const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

function particles(m, logC) {
  const n = Math.round(4 + 4 * (logC - LOG_C_MIN)); // formula units drawn: 4 at 0,001 mol/L … 16 at 1 mol/L
  const list = [];
  if (m.sol.kind === "strong") {
    for (let i = 0; i < n; i++) for (const [ion, k] of m.sol.ions) for (let j = 0; j < k; j++) list.push(ion);
  } else if (m.sol.kind === "weak") {
    const pairs = Math.max(1, Math.round(n * m.alpha)); // ponytail: at least one pair drawn so the ions are visible
    for (let i = 0; i < n - pairs; i++) list.push("mol");
    for (let i = 0; i < pairs; i++) for (const [ion] of m.sol.ions) list.push(ion);
  } else if (m.sol.kind === "none") {
    for (let i = 0; i < n; i++) list.push("mol");
  }
  return list;
}

function drawParticle(ctx, kind, x, y, r) {
  if (kind === "mol") {
    ctx.fillStyle = "#c7ccd6";
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  const cation = kind.endsWith("+");
  ctx.fillStyle = cation ? "#dbe6ff" : "#ffe0e0";
  ctx.strokeStyle = cation ? COLORS.blue : COLORS.red;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const text = r >= 11 ? ionText(kind) : cation ? "+" : "−";
  const size = r >= 11 ? Math.min(r * 0.8, (2 * r * 0.9) / Math.max(2, text.length * 0.55)) : r * 1.4;
  label(ctx, text, x, y + 0.5, { size, align: "center", bold: true, color: cation ? COLORS.blue : COLORS.red });
}

function drawBulb(ctx, x, y, r, b) {
  const level = Math.cbrt(clamp(b, 0, 1)); // ponytail: perceptual glow curve; the number shown is P/P(định mức)
  if (level > 0.01) {
    const R = r * (1.5 + 3 * level);
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, R);
    g.addColorStop(0, `rgba(245, 197, 24, ${0.9 * level})`);
    g.addColorStop(1, "rgba(245, 197, 24, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgb(255, ${Math.round(255 - 40 * level)}, ${Math.round(255 - 200 * level)})`;
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

const report = (s, api) => {
  const m = measure(s);
  api.emit("conductivity-measured", { solution: solutionIndex(s.solution), concentration: m.C, alpha: m.alpha, conductivity: m.kappa, current: m.current, brightness: m.brightness }, "result");
};

mount({
  slug: "chat-dien-li",
  version: "1.0.0",
  title: "Chất điện li và độ dẫn điện",
  hint: "Chọn dung dịch và nồng độ, quan sát đèn của bộ thử tính dẫn điện và các hạt trong cốc.",
  initialState,
  controls: [
    { type: "select", key: "solution", label: "Dung dịch trong cốc", options: SOLUTIONS.map(x => ({ value: x.id, label: x.name })), onCommit: report },
    {
      type: "slider",
      key: "logC",
      label: "Nồng độ chất tan",
      min: LOG_C_MIN,
      max: LOG_C_MAX,
      step: 0.05,
      format: (v, s) => (s.solution === "water" ? "–" : `${num(10 ** v)} mol/L`),
      disabled: s => s.solution === "water",
      onCommit: report,
    },
  ],
  readouts: [
    { label: "Độ điện li α", value: s => (measure(s).sol.kind === "water" ? "≈ 0" : `${num(measure(s).alpha * 100)} %`) },
    { label: "Độ dẫn điện κ (mô hình)", value: s => `${num(measure(s).kappa)} S/m` },
    { label: "Cường độ dòng điện", value: s => `${num(measure(s).current * 1000)} mA` },
    { label: "Công suất đèn / định mức", value: s => `${num(measure(s).brightness * 100)} %` },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const m = measure(s);
    const small = w < 560 || h < 420;
    const pad = 10;
    const base = clamp(Math.min(w / 50, h / 32), 11, 15);

    fit(ctx, equation(m.sol), w / 2, small ? 15 : 24, w - 2 * pad, { size: clamp(w / 30, 14, 24), bold: true, align: "center" });

    // geometry
    const top = small ? 34 : 54;
    const bottom = h - (small ? 46 : 64);
    const H = bottom - top;
    const bw = Math.min(w * 0.62, H * 1.25, 460);
    const bx = (w - bw) / 2;
    const beakerTop = top + H * 0.36;
    const liquidTop = beakerTop + H * 0.1;
    const xl = bx + bw * 0.2;
    const xr = bx + bw * 0.8;
    const yw = top + H * 0.08;

    // wires: left electrode – battery – bulb – right electrode
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xl, beakerTop - 6);
    ctx.lineTo(xl, yw);
    ctx.lineTo(xr, yw);
    ctx.lineTo(xr, beakerTop - 6);
    ctx.stroke();
    const batX = bx + bw * 0.36;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(batX - 8, yw - 14, 16, 28);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(batX - 5, yw - 13);
    ctx.lineTo(batX - 5, yw + 13);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(batX + 5, yw - 7);
    ctx.lineTo(batX + 5, yw + 7);
    ctx.stroke();
    label(ctx, "6 V", batX, yw + 24, { size: base - 1, align: "center", color: COLORS.muted });
    const bulbX = bx + bw * 0.64;
    const rb = clamp(H * 0.07, 9, 18);
    drawBulb(ctx, bulbX, yw, rb, m.brightness);
    label(ctx, `I = ${num(m.current * 1000)} mA`, bulbX, yw + rb + 12, { size: base - 1, align: "center", color: COLORS.muted });

    // beaker and liquid
    const liquidKind = m.sol.kind;
    ctx.fillStyle = liquidKind === "water" ? "rgba(140, 190, 240, 0.18)" : "rgba(140, 190, 240, 0.3)";
    ctx.fillRect(bx, liquidTop, bw, bottom - liquidTop);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - 6, beakerTop);
    ctx.lineTo(bx, beakerTop + 4);
    ctx.lineTo(bx, bottom);
    ctx.lineTo(bx + bw, bottom);
    ctx.lineTo(bx + bw, beakerTop + 4);
    ctx.lineTo(bx + bw + 6, beakerTop);
    ctx.stroke();

    // particles in the liquid (the rods are drawn over them)
    const list = particles(m, Math.log10(Math.max(m.C, 1e-3)));
    const r = clamp(Math.min(bw, bottom - liquidTop) * 0.045, 5, 14);
    const zone = { x: bx + r * 1.6, y: liquidTop + r * 1.4, w: bw - r * 3.2, h: bottom - liquidTop - r * 2.8 };
    const cols = Math.max(1, Math.round(Math.sqrt((list.length * zone.w) / Math.max(1, zone.h))));
    const rows = Math.max(1, Math.ceil(list.length / cols));
    list.forEach((kind, i) => {
      const cx = zone.x + (zone.w * ((i % cols) + 0.15 + 0.7 * rand(i + 1))) / cols;
      const cy = zone.y + (zone.h * (Math.floor(i / cols) + 0.15 + 0.7 * rand(i + 101))) / rows;
      drawParticle(ctx, kind, cx, cy, r);
    });
    // electrodes (graphite rods)
    const ew = clamp(bw * 0.04, 6, 12);
    const eBottom = bottom - (bottom - liquidTop) * 0.12;
    ctx.fillStyle = "#4a4f5c";
    for (const x of [xl, xr]) ctx.fillRect(x - ew / 2, beakerTop - 8, ew, eBottom - beakerTop + 8);

    if (m.sol.kind === "water" || (m.sol.kind === "none" && !small)) {
      label(ctx, m.sol.kind === "water" ? "gần như không có ion" : "không có ion", bx + bw / 2, liquidTop + 14, { size: base - 1, align: "center", color: COLORS.muted });
    }

    // numbers and conventions
    const kindText = { strong: "chất điện li mạnh", weak: "chất điện li yếu", none: "chất không điện li", water: "điện li rất yếu" }[m.sol.kind];
    const conc = m.sol.kind === "water" ? "" : ` · C = ${num(m.C)} mol/L`;
    const aText = m.sol.kind === "water" ? "" : ` · α = ${num(m.alpha * 100)} %`;
    fit(ctx, `${pretty(m.sol.formula)}: ${kindText}${conc}${aText} · κ = ${num(m.kappa)} S/m`, w / 2, h - (small ? 30 : 42), w - 2 * pad, { size: base, bold: true, align: "center" });
    const legend = small
      ? "xanh: cation, đỏ: anion, xám: phân tử · số hạt chỉ minh họa"
      : `Vòng xanh: cation · vòng đỏ: anion · hình xám: phân tử chất tan · không vẽ phân tử nước · số hạt chỉ minh họa · độ sáng đèn = P/P định mức (${fmt(P_RATED, 0)} W)`;
    fit(ctx, legend, w / 2, h - (small ? 12 : 18), w - 2 * pad, { size: base - 2, align: "center", color: COLORS.muted });
  },
});
