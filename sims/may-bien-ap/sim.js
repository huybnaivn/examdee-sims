import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, transformer, transmission, LINE_POWER } from "./model.js";

const watts = w => (Math.abs(w) >= 1e3 ? `${fmt(w / 1e3, 2)} kW` : `${fmt(w, 1)} W`);
const KIND = { "step-up": "Máy tăng áp: N₂ > N₁ nên U₂ > U₁", "step-down": "Máy hạ áp: N₂ < N₁ nên U₂ < U₁", none: "N₁ = N₂ nên U₂ = U₁" };

const reportTransformer = (s, api) => {
  const t = transformer(s);
  api.emit("transformer-solved", { u1: s.u1, n1: s.n1, n2: s.n2, ratio: t.ratio, u2: t.u2, i1: t.i1, i2: t.i2, power: t.p2 }, "result");
};
const reportLine = (s, api) => {
  const l = transmission(s);
  api.emit("transmission-solved", { voltage: s.lineU, lineResistance: s.lineR, current: l.current, loss: l.loss, efficiency: l.efficiency * 100 }, "result");
};

// Label with subscripts written as "P_{hp}".
function sl(ctx, text, x, y, o = {}) {
  const size = o.size ?? 14;
  const parts = text.split(/_\{([^}]*)\}/); // even: normal, odd: subscript
  const font = k => `${o.bold ? "600 " : ""}${k % 2 ? size * 0.75 : size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const widths = parts.map((p, k) => ((ctx.font = font(k)), ctx.measureText(p).width));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = o.align === "center" ? x - total / 2 : o.align === "right" ? x - total : x;
  parts.forEach((p, k) => {
    if (p) label(ctx, p, cx, y + (k % 2 ? size * 0.3 : 0), { ...o, size: k % 2 ? size * 0.75 : size, align: "left" });
    cx += widths[k];
  });
}

function geom(s, view) {
  const pad = 8;
  const both = view.w >= 560 && view.h >= 520;
  const small = view.w < 560 || (both ? view.h < 640 : view.h < 400);
  const full = { x: pad, y: pad, w: view.w - 2 * pad, h: view.h - 2 * pad };
  if (!both) return { small, both, [s.part === "line" ? "line" : "tr"]: full };
  const h1 = Math.round(full.h * 0.54);
  return { small, both, tr: { ...full, h: h1 - 4 }, line: { ...full, y: full.y + h1 + 4, h: full.h - h1 - 4 } };
}

function frame(ctx, r, active, title, small) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = active ? COLORS.blue : COLORS.grid;
  ctx.lineWidth = active ? 2 : 1;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  label(ctx, title, r.x + 10, r.y + (small ? 12 : 16), { size: small ? 12 : 15, bold: true });
}

function coil(ctx, x, yTop, yBot, turns, half, color) {
  // a helix around the core limb: front strokes bold, back strokes (behind the iron) thin
  const pitch = (yBot - yTop) / turns;
  ctx.strokeStyle = color;
  for (let k = 0; k < turns; k++) {
    const y = yTop + pitch * k;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(x + half, y + pitch * 0.5);
    ctx.lineTo(x - half, y + pitch);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x - half, y);
    ctx.quadraticCurveTo(x, y + pitch * 0.55, x + half, y + pitch * 0.5);
    ctx.stroke();
  }
}

function drawTransformer(ctx, s, r, g) {
  const t = transformer(s);
  const small = g.small;
  const size = small ? 11 : 13;
  frame(ctx, r, g.both && s.part !== "line", small ? "Máy biến áp lí tưởng" : "Máy biến áp lí tưởng (bỏ qua mọi hao phí)", small);
  const top = r.y + (small ? 26 : 36);
  const bottom = r.y + r.h - (small ? 34 : 46);
  // labels decide the room left for the source and the load at each side
  const gap = small ? 13 : 17;
  const leftText = [`U₁ = ${fmt(s.u1, 0)} V`, `N₁ = ${fmt(s.n1, 0)}`, `I₁ = ${fmt(t.i1, 3)} A`];
  const rightText = [`U₂ = ${fmt(t.u2, 1)} V`, `N₂ = ${fmt(s.n2, 0)}`, `I₂ = ${fmt(t.i2, 3)} A`, `R = ${fmt(s.load, 0)} Ω`];
  ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const widest = list => Math.max(...list.map(x => ctx.measureText(x).width));
  const sr = small ? 10 : 15;
  const rw = small ? 9 : 12;
  const sx = r.x + 6 + widest(leftText) + 5 + sr; // source centre
  const lx = r.x + r.w - 6 - widest(rightText) - 5 - rw / 2; // load centre
  const wire = small ? 22 : 50; // least wire length between a coil and the source or load
  // core: a square ring of iron, two limbs carry the coils
  const limb0 = small ? 12 : 20;
  const coreW = Math.max(30, Math.min(260, lx - sx - 2 * (limb0 / 2 + 7) - 2 * wire));
  const coreH = Math.max(40, bottom - top);
  const cx = (sx + lx) / 2;
  const cxL = cx - coreW / 2;
  const cxR = cx + coreW / 2;
  const limb = Math.min(limb0, coreW * 0.3);
  ctx.fillStyle = "#c9d0dc";
  ctx.fillRect(cxL - limb / 2, top, coreW + limb, coreH);
  ctx.fillStyle = "#fff";
  ctx.fillRect(cxL + limb / 2, top + limb, coreW - limb, coreH - 2 * limb);
  if (!small) label(ctx, "lõi thép", cx, top + limb + 10, { size: 11, align: "center", color: COLORS.muted });

  // turns drawn in proportion to N (one drawn turn ≈ 125 real turns, at least 2)
  const drawn = n => Math.max(2, Math.round(n / 125));
  const y0 = top + limb + 4;
  const y1 = top + coreH - limb - 4;
  const half = limb / 2 + 7;
  coil(ctx, cxL, y0, y1, Math.min(drawn(s.n1), Math.floor((y1 - y0) / 4)), half, COLORS.orange);
  coil(ctx, cxR, y0, y1, Math.min(drawn(s.n2), Math.floor((y1 - y0) / 4)), half, COLORS.purple);

  // primary circuit: AC source on the left
  const ym = (y0 + y1) / 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cxL - half, y0);
  ctx.lineTo(sx, y0);
  ctx.lineTo(sx, y1);
  ctx.lineTo(cxL - half, y1);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(sx, ym, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k <= 16; k++) {
    const px = sx - sr * 0.6 + (1.2 * sr * k) / 16;
    const py = ym - sr * 0.35 * Math.sin((2 * Math.PI * k) / 16);
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();

  // secondary circuit: load resistor on the right
  ctx.beginPath();
  ctx.moveTo(cxR + half, y0);
  ctx.lineTo(lx, y0);
  ctx.lineTo(lx, y1);
  ctx.lineTo(cxR + half, y1);
  ctx.stroke();
  const rh = Math.min(small ? 26 : 40, (y1 - y0) * 0.5);
  ctx.fillStyle = "#fff";
  ctx.fillRect(lx - rw / 2, ym - rh / 2, rw, rh);
  ctx.strokeRect(lx - rw / 2, ym - rh / 2, rw, rh);

  // current arrows (instantaneous sense drawn for one half-cycle)
  arrow(ctx, sx + 4, y0 - 7, sx + (small ? 24 : 36), y0 - 7, COLORS.red, 2);
  arrow(ctx, cxR + half + 4, y0 - 7, cxR + half + (small ? 24 : 36), y0 - 7, COLORS.red, 2);

  // primary labels (left of the source), secondary labels (right of the load)
  const left = sx - sr - 5;
  const right = lx + rw / 2 + 5;
  const colorsL = [COLORS.orange, COLORS.orange, COLORS.red];
  const colorsR = [COLORS.purple, COLORS.purple, COLORS.red, COLORS.muted];
  leftText.forEach((text, k) => label(ctx, text, left, ym + (k - 1) * gap, { size, align: "right", bold: k === 0, color: colorsL[k] }));
  rightText.forEach((text, k) => label(ctx, text, right, ym + (k - 1) * gap, { size, bold: k === 0, color: colorsR[k] }));

  // laws and verdict
  const ly = r.y + r.h - (small ? 24 : 32);
  const ratio = fmt(t.ratio, 3);
  label(ctx, `U₁/U₂ = N₁/N₂ = ${ratio}    P₁ = U₁I₁ = P₂ = U₂I₂ = ${watts(t.p2)}`, r.x + r.w / 2, ly, { size, align: "center" });
  label(ctx, KIND[t.kind], r.x + r.w / 2, ly + (small ? 14 : 18), { size, align: "center", bold: true, color: t.kind === "none" ? COLORS.muted : COLORS.blue });
  if (!small) label(ctx, "Số vòng dây vẽ thu nhỏ theo tỉ lệ", r.x + r.w - 10, r.y + 16, { size: 11, align: "right", color: COLORS.muted });
}

function drawLine(ctx, s, r, g) {
  const l = transmission(s);
  const small = g.small;
  const size = small ? 11 : 13;
  frame(ctx, r, g.both && s.part === "line", small ? "Truyền tải điện năng" : "Truyền tải điện năng đi xa (cos φ = 1)", small);
  sl(ctx, "P_{hp} = R·P²/U²", r.x + r.w - 10, r.y + (small ? 12 : 16), { size, align: "right", bold: true, color: COLORS.red });

  // station → line → consumer
  const top = r.y + (small ? 28 : 40);
  const bw = Math.min(small ? 70 : 120, r.w * 0.24);
  const bh = small ? 46 : 62;
  const xa = r.x + 10;
  const xb = r.x + r.w - 10 - bw;
  const yw1 = top + bh * 0.3;
  const yw2 = top + bh * 0.75;
  // wires glow red with the share of power lost
  const heat = Math.min(1, l.loss / l.power / 0.3);
  ctx.strokeStyle = `rgb(${Math.round(31 + 198 * heat)}, ${Math.round(42 + 30 * heat)}, ${Math.round(68 + 9 * heat)})`;
  ctx.lineWidth = 2 + 3 * heat;
  ctx.beginPath();
  ctx.moveTo(xa + bw, yw1);
  ctx.lineTo(xb, yw1);
  ctx.moveTo(xa + bw, yw2);
  ctx.lineTo(xb, yw2);
  ctx.stroke();
  // the line's resistance drawn as one resistor
  const mx = (xa + bw + xb) / 2;
  const rw = small ? 28 : 44;
  ctx.fillStyle = "#fff";
  ctx.fillRect(mx - rw / 2, yw1 - 6, rw, 12);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx - rw / 2, yw1 - 6, rw, 12);
  label(ctx, `R = ${fmt(s.lineR, 0)} Ω`, mx, yw1 - (small ? 14 : 17), { size, align: "center", bold: true });
  label(ctx, `I = P/U = ${fmt(l.current, 1)} A`, mx, yw2 + (small ? 12 : 16), { size, align: "center", color: COLORS.red });
  for (const [x, title, sub, color] of [
    [xa, "Nhà máy", `P = ${watts(l.power)}`, COLORS.blue],
    [xb, "Nơi tiêu thụ", `nhận ${watts(l.delivered)}`, COLORS.green],
  ]) {
    ctx.fillStyle = "#eef3fd";
    ctx.fillRect(x, top, bw, bh);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, top, bw, bh);
    label(ctx, title, x + bw / 2, top + bh * 0.3, { size, align: "center", bold: true });
    label(ctx, sub, x + bw / 2, top + bh * 0.72, { size: small ? 10 : 12, align: "center", color });
  }
  label(ctx, `U = ${fmt(s.lineU, 0)} kV`, xa + bw / 2, top + bh + (small ? 10 : 14), { size, align: "center", bold: true, color: COLORS.blue });

  // power bars
  const by = top + bh + (small ? 24 : 36);
  const avail = r.y + r.h - by - (small ? 18 : 26);
  const rows = [
    ["Phát đi P", l.power, COLORS.blue],
    ["Hao phí P_{hp}", l.loss, COLORS.red],
    ["Nhận được", l.delivered, COLORS.green],
  ];
  const rowH = Math.max(14, Math.min(small ? 28 : 30, avail / rows.length));
  const lab = small ? 86 : 120;
  const valW = small ? 62 : 84;
  const barW = r.w - 20 - lab - valW;
  rows.forEach(([name, value, color], k) => {
    const y = by + rowH * k;
    sl(ctx, name, r.x + 10, y + rowH / 2, { size, color: COLORS.muted });
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(r.x + 10 + lab, y + rowH * 0.2, barW, rowH * 0.6);
    ctx.fillStyle = color;
    ctx.fillRect(r.x + 10 + lab, y + rowH * 0.2, Math.max(1, (barW * value) / l.power), rowH * 0.6);
    label(ctx, watts(value), r.x + r.w - 10, y + rowH / 2, { size, align: "right", bold: true });
  });
  const hy = by + rowH * rows.length + (small ? 10 : 14);
  sl(ctx, `Hiệu suất H = (P − P_{hp})/P = ${fmt(l.efficiency * 100, 2)} %`, r.x + 10, hy, { size, bold: true, color: COLORS.green });
  if (!small) sl(ctx, "Tăng U lên 10 lần thì P_{hp} giảm 100 lần", r.x + r.w - 10, hy, { size: 12, align: "right", color: COLORS.muted });
  else if (hy + 34 < r.y + r.h) sl(ctx, "Tăng U lên 10 lần thì P_{hp} giảm 100 lần", r.x + 10, hy + 18, { size: 11, color: COLORS.muted });
}

mount({
  slug: "may-bien-ap",
  version: "1.0.0",
  title: "Máy biến áp và truyền tải điện năng",
  hint: "Đổi số vòng dây để có máy tăng áp hoặc hạ áp; tăng điện áp truyền tải để giảm hao phí trên đường dây.",
  initialState,
  controls: [
    {
      type: "select",
      key: "part",
      label: "Phần thí nghiệm",
      options: [
        { value: "transformer", label: "Máy biến áp" },
        { value: "line", label: "Truyền tải điện năng đi xa" },
      ],
    },
    ...[
      { type: "slider", key: "u1", label: "Điện áp cuộn sơ cấp U₁", min: 10, max: 400, step: 10, unit: "V", digits: 0 },
      { type: "slider", key: "n1", label: "Số vòng cuộn sơ cấp N₁", min: 100, max: 2000, step: 50, digits: 0 },
      { type: "slider", key: "n2", label: "Số vòng cuộn thứ cấp N₂", min: 50, max: 4000, step: 50, digits: 0 },
      { type: "slider", key: "load", label: "Điện trở tải R", min: 10, max: 1000, step: 5, unit: "Ω", digits: 0 },
    ].map(c => ({ ...c, visible: s => s.part !== "line", onCommit: reportTransformer })),
    ...[
      { type: "slider", key: "lineU", label: "Điện áp truyền tải U", min: 5, max: 500, step: 5, unit: "kV", digits: 0 },
      { type: "slider", key: "lineR", label: "Điện trở đường dây R", min: 1, max: 20, step: 1, unit: "Ω", digits: 0 },
    ].map(c => ({ ...c, visible: s => s.part === "line", onCommit: reportLine })),
  ],
  readouts: [
    { label: "U₂ = U₁·N₂/N₁", value: s => `${fmt(transformer(s).u2, 1)} V` },
    { label: "Tỉ số N₁/N₂", value: s => fmt(transformer(s).ratio, 3) },
    { label: "I₁ / I₂", value: s => `${fmt(transformer(s).i1, 3)} A / ${fmt(transformer(s).i2, 3)} A` },
    { label: "P₁ = P₂", value: s => watts(transformer(s).p2) },
    { label: "Công suất truyền đi P", value: () => watts(LINE_POWER) },
    { label: "Hao phí Php = R·P²/U²", value: s => watts(transmission(s).loss) },
    { label: "Hiệu suất truyền tải H", value: s => `${fmt(transmission(s).efficiency * 100, 2)} %` },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    if (g.tr) drawTransformer(ctx, s, g.tr, g);
    if (g.line) drawLine(ctx, s, g.line, g);
  },
});
