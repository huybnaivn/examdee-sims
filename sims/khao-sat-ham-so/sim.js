import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, summary, f, df } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TYPE = { max: { name: "CĐ", color: COLORS.red }, min: { name: "CT", color: COLORS.blue } };
const num = v => fmt(v, 2);
const pt = (x, y) => `(${num(x)}; ${num(y)})`;

/** "x³ − 3x² + 2" from coefficients of x³, x², x, 1. */
function polyText(cs, powers = ["x³", "x²", "x", ""]) {
  let out = "";
  cs.forEach((c, i) => {
    if (Math.abs(c) < 1e-9) return;
    const p = powers[i];
    const mag = Math.abs(c) === 1 && p ? "" : num(Math.abs(c));
    out += out ? ` ${c < 0 ? "−" : "+"} ` : c < 0 ? "−" : "";
    out += mag + p;
  });
  return out || "0";
}

const rootsText = r => (r.roots === null ? "vô số (y ≡ 0)" : String(r.roots.length));

const commit = (s, api) => {
  const r = summary(s);
  api.emit(
    "function-surveyed",
    { extrema: r.extrema.length, ...(r.inflection && { inflection: r.inflection.x }), roots: r.roots === null ? -1 : r.roots.length, degree: Math.max(0, r.deg) },
    "result"
  );
};

function niceStep(span, count) {
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * pow).find(v => v >= raw);
}

function tag(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = `600 ${opts.size ?? 12}px ${FONT}`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = opts.halo ?? COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { size: 12, bold: true, ...opts });
}

function dot(ctx, x, y, color, r = 5) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// x window holding every critical point, the inflection point and the roots; y window holding their values.
function windowOf(r) {
  const k = r.k;
  const xs = [...r.crit.map(p => p.x), ...(r.inflection ? [r.inflection.x] : []), ...(r.roots ?? [])];
  let lo = xs.length ? Math.min(...xs) - 1.5 : -2;
  let hi = xs.length ? Math.max(...xs) + 1.5 : 2;
  if (hi - lo < 4) {
    const m = (lo + hi) / 2;
    lo = m - 2;
    hi = m + 2;
  }
  const span = hi - lo;
  const ys = [0, ...r.crit.map(p => p.y), ...(r.inflection ? [r.inflection.y] : []), f(k, lo + span * 0.2), f(k, hi - span * 0.2)];
  let ylo = Math.min(...ys);
  let yhi = Math.max(...ys);
  const pad = Math.max(0.6, (yhi - ylo) * 0.18);
  ylo -= pad;
  yhi += pad;
  return { lo, hi, ylo, yhi };
}

function grid(ctx, X, Y, win, x0, x1, y0, y1, ticksY) {
  const sx = niceStep(win.hi - win.lo, (x1 - x0) / 60);
  const sy = niceStep(win.yhi - win.ylo, (y1 - y0) / 34);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let v = Math.ceil(win.lo / sx) * sx; v <= win.hi; v += sx) {
    ctx.moveTo(X(v), y0);
    ctx.lineTo(X(v), y1);
  }
  if (ticksY)
    for (let v = Math.ceil(win.ylo / sy) * sy; v <= win.yhi; v += sy) {
      ctx.moveTo(x0, Y(v));
      ctx.lineTo(x1, Y(v));
    }
  ctx.stroke();
  return { sx, sy };
}

function curve(ctx, g, X, Y, lo, hi, x0, x1, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let px = x0; px <= x1; px += 1.5) {
    const x = lo + ((px - x0) / (x1 - x0)) * (hi - lo);
    const py = Math.max(-2000, Math.min(4000, Y(g(x))));
    px === x0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawTable(ctx, r, x0, y0, w, rowH, yRowH, small) {
  const size = small ? 12 : 14;
  const head = small ? 30 : 42;
  const H = rowH * 2 + yRowH;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, w, H);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, H - 1);
  ctx.beginPath();
  ctx.moveTo(x0, y0 + rowH);
  ctx.lineTo(x0 + w, y0 + rowH);
  ctx.moveTo(x0, y0 + 2 * rowH);
  ctx.lineTo(x0 + w, y0 + 2 * rowH);
  ctx.moveTo(x0 + head, y0);
  ctx.lineTo(x0 + head, y0 + H);
  ctx.stroke();
  label(ctx, "x", x0 + head / 2, y0 + rowH / 2, { size, bold: true, align: "center" });
  label(ctx, "y′", x0 + head / 2, y0 + rowH * 1.5, { size, bold: true, align: "center" });
  label(ctx, "y", x0 + head / 2, y0 + 2 * rowH + yRowH / 2, { size, bold: true, align: "center" });

  const { nodes, signs } = r.table;
  const left = x0 + head + (small ? 16 : 24);
  const right = x0 + w - (small ? 16 : 24);
  const NX = i => left + ((right - left) * i) / (nodes.length - 1);
  const yTop = y0 + 2 * rowH;
  const LY = lv => yTop + yRowH / 2 - lv * (yRowH / 2 - size * 0.75);
  const valText = n => (Number.isFinite(n.y) ? num(n.y) : n.y > 0 ? "+∞" : "−∞");
  nodes.forEach((n, i) => {
    const cx = NX(i);
    label(ctx, n.type === "end" ? (n.x < 0 ? "−∞" : "+∞") : num(n.x), cx, y0 + rowH / 2, { size, align: "center" });
    if (n.type !== "end") label(ctx, "0", cx, y0 + rowH * 1.5, { size, align: "center" });
    const color = TYPE[n.type]?.color ?? COLORS.ink;
    label(ctx, valText(n), cx, LY(n.level), { size, align: "center", bold: n.type !== "end", color });
  });
  signs.forEach((sg, i) => {
    const mx = (NX(i) + NX(i + 1)) / 2;
    label(ctx, sg > 0 ? "+" : sg < 0 ? "−" : "0", mx, y0 + rowH * 1.5, { size: size + 2, bold: true, align: "center", color: sg > 0 ? COLORS.green : sg < 0 ? COLORS.red : COLORS.muted });
    ctx.font = `${size}px ${FONT}`;
    const g1 = ctx.measureText(valText(nodes[i])).width / 2 + 6;
    const g2 = ctx.measureText(valText(nodes[i + 1])).width / 2 + 6;
    const ya = LY(nodes[i].level);
    const yb = LY(nodes[i + 1].level);
    const ax = NX(i) + g1;
    const bx = NX(i + 1) - g2;
    if (bx - ax > 10) arrow(ctx, ax, ya + (yb > ya ? 4 : yb < ya ? -4 : 0), bx, yb + (yb > ya ? -4 : yb < ya ? 4 : 0), COLORS.purple, 1.8);
  });
}

mount({
  slug: "khao-sat-ham-so",
  version: "1.0.0",
  title: "Khảo sát hàm số bậc ba",
  hint: "Chỉnh các hệ số a, b, c, d. Quan sát đồ thị y′ ở giữa: y′ đổi dấu ở đâu thì hàm số có cực trị ở đó. Bảng biến thiên ở dưới được lập lại sau mỗi thay đổi.",
  initialState,
  controls: [
    { type: "heading", label: "y = ax³ + bx² + cx + d" },
    { type: "slider", key: "a", label: "Hệ số a", min: -3, max: 3, step: 0.1, digits: 1, onCommit: commit },
    { type: "slider", key: "b", label: "Hệ số b", min: -5, max: 5, step: 0.1, digits: 1, onCommit: commit },
    { type: "slider", key: "c", label: "Hệ số c", min: -6, max: 6, step: 0.1, digits: 1, onCommit: commit },
    { type: "slider", key: "d", label: "Hệ số d", min: -6, max: 6, step: 0.1, digits: 1, onCommit: commit },
  ],
  readouts: [
    { label: "Hàm số", value: s => `y = ${polyText([s.a, s.b, s.c, s.d])}` },
    { label: "Đạo hàm", value: s => `y′ = ${polyText([3 * s.a, 2 * s.b, s.c], ["x²", "x", ""])}` },
    {
      label: "Δ′ của y′ = 0",
      value: s => {
        const r = summary(s);
        if (r.deg < 3) return "a = 0: không phải hàm bậc ba";
        return `b² − 3ac = ${num(r.delta)}${Math.abs(r.delta) < 1e-9 ? " (nghiệm kép)" : r.delta > 0 ? " > 0 (hai nghiệm)" : " < 0 (vô nghiệm)"}`;
      },
    },
    { label: "Cực đại", value: s => summary(s).crit.filter(p => p.type === "max").map(p => `CĐ${pt(p.x, p.y)}`).join("; ") || "không có" },
    { label: "Cực tiểu", value: s => summary(s).crit.filter(p => p.type === "min").map(p => `CT${pt(p.x, p.y)}`).join("; ") || "không có" },
    { label: "Điểm uốn", value: s => (summary(s).inflection ? `U${pt(summary(s).inflection.x, summary(s).inflection.y)}, x = −b/(3a)` : "không có (a = 0)") },
    { label: "Số nghiệm thực của y = 0", value: s => rootsText(summary(s)) },
  ],
  draw(ctx, s, view) {
    const r = summary(s);
    const k = r.k;
    const { w, h } = view;
    const small = w < 560 || h < 440;
    const rowH = small ? 20 : 28;
    const yRowH = small ? 50 : 76;
    const tH = rowH * 2 + yRowH;
    const tY = h - tH - 6;
    const dH = Math.round((tY - 6) * 0.27);
    const gH = tY - 6 - dH;
    const win = windowOf(r);
    const pad = 8;
    const X = x => pad + ((x - win.lo) / (win.hi - win.lo)) * (w - 2 * pad);
    const Y = y => gH - 4 - ((y - win.ylo) / (win.yhi - win.ylo)) * (gH - 8);

    // ----- graph of y -----
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, gH);
    ctx.clip();
    const { sx, sy } = grid(ctx, X, Y, win, 0, w, 0, gH, true);
    const ox = win.lo < 0 && win.hi > 0 ? X(0) : null;
    arrow(ctx, 0, Y(0), w - 3, Y(0), COLORS.ink, 1.5);
    if (ox !== null) arrow(ctx, ox, gH, ox, 3, COLORS.ink, 1.5);
    label(ctx, "x", w - 10, Y(0) - 12, { bold: true, size: 13 });
    const tick = { size: 11, color: COLORS.muted };
    for (let v = Math.ceil(win.lo / sx) * sx; v <= win.hi; v += sx) if (Math.abs(v) > 1e-9 && X(v) > 14 && X(v) < w - 20) label(ctx, fmt(v, 2), X(v), Y(0) + 11, { ...tick, align: "center" });
    if (ox !== null) for (let v = Math.ceil(win.ylo / sy) * sy; v <= win.yhi; v += sy) if (Math.abs(v) > 1e-9 && Y(v) > 10) label(ctx, fmt(v, 2), ox - 5, Y(v), { ...tick, align: "right" });
    if (r.inflection) {
      ctx.strokeStyle = COLORS.purple;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(X(r.inflection.x), 0);
      ctx.lineTo(X(r.inflection.x), h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    curve(ctx, x => f(k, x), X, Y, win.lo, win.hi, pad, w - pad, COLORS.ink, 3);
    for (const x of r.roots ?? []) dot(ctx, X(x), Y(0), COLORS.green, 4);
    for (const p of r.crit) {
      const t = TYPE[p.type];
      dot(ctx, X(p.x), Y(p.y), t?.color ?? COLORS.orange);
      if (t) tag(ctx, small ? t.name : `${t.name}${pt(p.x, p.y)}`, X(p.x), Y(p.y) + (p.type === "max" ? -13 : 14), { color: t.color, align: "center" });
    }
    if (r.inflection) {
      dot(ctx, X(r.inflection.x), Y(r.inflection.y), COLORS.purple, 4.5);
      tag(ctx, small ? "U" : `U${pt(r.inflection.x, r.inflection.y)}`, X(r.inflection.x) + 8, Y(r.inflection.y) + 2, { color: COLORS.purple });
    }
    tag(ctx, `y = ${polyText([k.a, k.b, k.c, k.d])}`, 10, 13, { size: small ? 13 : 15 });
    tag(ctx, `${rootsText(r)} nghiệm thực`, 10, small ? 30 : 34, { color: COLORS.green });
    const ppx = (w - 2 * pad) / (win.hi - win.lo);
    const ppy = (gH - 8) / (win.yhi - win.ylo);
    if (Math.abs(ppx / ppy - 1) > 0.1) tag(ctx, "Ox, Oy khác tỉ lệ", w - 8, 13, { color: COLORS.muted, align: "right", size: 11 });
    ctx.restore();

    // ----- graph of y′, same x scale, own vertical scale -----
    const top = gH;
    const dv = [df(k, win.lo), df(k, win.hi), ...(r.inflection ? [df(k, r.inflection.x)] : []), 0];
    if (r.deg === 2) dv.push(df(k, (win.lo + win.hi) / 2));
    let dlo = Math.min(...dv);
    let dhi = Math.max(...dv);
    const dp = Math.max(0.5, (dhi - dlo) * 0.12);
    dlo -= dp;
    dhi += dp;
    const Yd = v => top + 3 + ((dhi - v) / (dhi - dlo)) * (dH - 6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, w, dH);
    ctx.clip();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, top, w, dH);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(0, top + 0.5);
    ctx.lineTo(w, top + 0.5);
    ctx.stroke();
    // shade y′ > 0 green and y′ < 0 red
    for (let px = pad; px < w - pad; px += 2) {
      const x = win.lo + ((px - pad) / (w - 2 * pad)) * (win.hi - win.lo);
      const v = df(k, x);
      if (Math.abs(v) < 1e-9) continue;
      ctx.fillStyle = v > 0 ? "rgba(31, 157, 107, 0.12)" : "rgba(229, 72, 77, 0.12)";
      ctx.fillRect(px, top, 2, dH);
    }
    arrow(ctx, 0, Yd(0), w - 3, Yd(0), COLORS.ink, 1.2);
    curve(ctx, x => df(k, x), X, Yd, win.lo, win.hi, pad, w - pad, COLORS.orange, 2.5);
    for (const p of r.crit) dot(ctx, X(p.x), Yd(0), COLORS.orange, 4);
    tag(ctx, `y′ = ${polyText([3 * k.a, 2 * k.b, k.c], ["x²", "x", ""])}`, 10, top + 12, { color: COLORS.orange, halo: "#fff" });
    if (!small) tag(ctx, "(trục tung có tỉ lệ riêng; xanh: y′ > 0, đỏ: y′ < 0)", w - 8, top + 12, { color: COLORS.muted, halo: "#fff", align: "right", size: 11 });
    ctx.restore();

    // ----- variation table -----
    drawTable(ctx, r, 6, tY, w - 12, rowH, yRowH, small);
  },
});
