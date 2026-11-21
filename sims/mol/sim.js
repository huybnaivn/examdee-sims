import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { NA, VM, SUBSTANCES, LIMITS, initialState, convert, sci, align, dotScale, pretty, substanceById } from "./model.js";

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = e => String(e).replace("-", "⁻").replace(/\d/g, d => SUP[d]);
/** 4 significant figures, half up (0,25·24,79 = 6,1975 shows as 6,198), decimal comma. */
const sig = x => {
  if (!x) return "0";
  const k = 10 ** (3 - Math.floor(Math.log10(Math.abs(x))));
  return fmt(Math.round(x * k * (1 + 1e-12)) / k, 10);
};
const big = x => {
  const [m, e] = sci(x);
  return m === 0 ? "0" : `${fmt(m, 3)}·10${sup(e)}`;
};
const font = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;

// label() with subscripts written as _{…}, e.g. "N_{A}". Measures itself so align works.
function rich(ctx, text, x, y, { size = 14, color = COLORS.ink, bold = false, align = "left" } = {}) {
  const parts = text.split(/_\{([^}]*)\}/).map((t, i) => ({ t, sub: i % 2 === 1, sz: i % 2 ? size * 0.72 : size }));
  const width = parts.reduce((sum, p) => ((ctx.font = font(p.sz, bold)), sum + ctx.measureText(p.t).width), 0);
  x -= align === "center" ? width / 2 : align === "right" ? width : 0;
  for (const p of parts) {
    label(ctx, p.t, x, y + (p.sub ? size * 0.28 : 0), { size: p.sz, color, bold });
    ctx.font = font(p.sz, bold);
    x += ctx.measureText(p.t).width;
  }
}

// One result per committed value. A refused conversion (volume of a non-gas) has no outcome to report.
function report(s, api) {
  align(s);
  const c = convert(s);
  if (c.error) return;
  const data = { substance: SUBSTANCES.indexOf(c.sub), mass: c.mass, mol: c.mol, particles: c.particles };
  if (c.volume !== null) data.volume = c.volume;
  api.emit("converted", data, "result");
}

const rand = i => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

function box(ctx, x, y, w, h, { title, value, active, off, size }) {
  ctx.fillStyle = off ? "#eef1f6" : active ? "#e8f0fe" : "#fff";
  ctx.strokeStyle = off ? COLORS.grid : active ? COLORS.blue : "#c9d3e3";
  ctx.lineWidth = active ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  label(ctx, title, x + w / 2, y + h * 0.3, { size: size - 2, align: "center", color: off ? COLORS.muted : active ? COLORS.blue : COLORS.muted, bold: active });
  label(ctx, value, x + w / 2, y + h * 0.68, { size, align: "center", bold: true, color: off ? COLORS.muted : COLORS.ink });
}

// Two opposite arrows between boxes, the operation written beside each.
function link(ctx, a, b, forward, back, vertical, size) {
  const d = 5;
  if (vertical) {
    arrow(ctx, a.x - d, a.y, b.x - d, b.y, COLORS.ink, 1.5);
    arrow(ctx, b.x + d, b.y, a.x + d, a.y, COLORS.muted, 1.5);
    rich(ctx, forward, a.x - d - 6, (a.y + b.y) / 2, { size, align: "right" });
    rich(ctx, back, a.x + d + 6, (a.y + b.y) / 2, { size, color: COLORS.muted });
  } else {
    arrow(ctx, a.x, a.y - d, b.x, b.y - d, COLORS.ink, 1.5);
    arrow(ctx, b.x, b.y + d, a.x, a.y + d, COLORS.muted, 1.5);
    rich(ctx, forward, (a.x + b.x) / 2, a.y - d - 9, { size, align: "center" });
    rich(ctx, back, (a.x + b.x) / 2, a.y + d + 10, { size, align: "center", color: COLORS.muted });
  }
}

mount({
  slug: "mol",
  version: "1.0.0",
  title: "Mol và các đại lượng liên quan",
  hint: "Chọn chất, chọn đại lượng đã biết rồi kéo thanh trượt; các đại lượng còn lại được tính theo chuỗi m ⇄ n ⇄ N và n ⇄ V.",
  initialState,
  controls: [
    {
      type: "select",
      key: "substance",
      label: "Chất",
      options: SUBSTANCES.map(x => ({ value: x.id, label: `${pretty(x.id)} – ${x.name}${x.gas ? " (khí)" : ""}` })),
      onCommit: report,
    },
    {
      type: "select",
      key: "given",
      label: "Đại lượng đã biết",
      options: [
        { value: "mass", label: "Khối lượng m (g)" },
        { value: "mol", label: "Lượng chất n (mol)" },
        { value: "particles", label: "Số hạt N" },
        { value: "volume", label: "Thể tích khí V (L, đkc)" },
      ],
    },
    { type: "slider", key: "mass", label: "Khối lượng m", min: LIMITS.mass[0], max: LIMITS.mass[1], step: LIMITS.mass[2], unit: "g", digits: 1, visible: s => s.given === "mass", onCommit: report },
    { type: "slider", key: "mol", label: "Lượng chất n", min: LIMITS.mol[0], max: LIMITS.mol[1], step: LIMITS.mol[2], unit: "mol", visible: s => s.given === "mol", onCommit: report },
    {
      type: "slider",
      key: "particles",
      label: "Số hạt N",
      min: LIMITS.particles[0],
      max: LIMITS.particles[1],
      step: LIMITS.particles[2],
      format: v => `${fmt(v, 2)}·10²³`,
      visible: s => s.given === "particles",
      onCommit: report,
    },
    { type: "slider", key: "volume", label: "Thể tích khí V (đkc)", min: LIMITS.volume[0], max: LIMITS.volume[1], step: LIMITS.volume[2], unit: "L", digits: 1, visible: s => s.given === "volume", onCommit: report },
  ],
  readouts: [
    { label: "Khối lượng mol M", value: s => `${fmt(convert(s).M, 1)} g/mol` },
    { label: "Lượng chất n", value: s => (convert(s).error ? "–" : `${sig(convert(s).mol)} mol`) },
  ],
  draw(ctx, s, view) {
    const c = convert(s);
    const { w, h } = view;
    const small = w < 560 || h < 430;
    const size = small ? 12 : 15;
    const pad = small ? 8 : 20;
    let y = small ? 14 : 24;

    // heading: the substance and its molar mass
    label(ctx, `${pretty(c.sub.id)} – ${c.sub.name}`, pad, y, { size: size + 2, bold: true });
    label(ctx, `M = ${fmt(c.M, 1)} g/mol`, w - pad, y, { size, align: "right", color: COLORS.purple, bold: true });
    y += small ? 16 : 26;

    // conversion chain: m ⇄ n ⇄ N on one row, V under n
    const gap = small ? 44 : 90;
    const bw = Math.min(small ? 999 : 200, (w - 2 * pad - 2 * gap) / 3);
    const bh = small ? 38 : 52;
    const x0 = (w - 3 * bw - 2 * gap) / 2;
    const col = k => x0 + k * (bw + gap);
    const vGap = small ? 30 : 44;
    const err = c.error === "not-gas";
    const val = (q, text) => (err && q !== "volume" ? "?" : text);
    const unitName = c.sub.particle;
    const boxes = {
      mass: [col(0), y, small ? "m" : "Khối lượng m", val("mass", `${sig(c.mass ?? 0)} g`)],
      mol: [col(1), y, small ? "n" : "Lượng chất n", val("mol", `${sig(c.mol ?? 0)} mol`)],
      particles: [col(2), y, small ? "N" : `Số ${unitName} N`, val("particles", big(c.particles ?? 0))],
      volume: [col(1), y + bh + vGap, small ? "V (đkc)" : "Thể tích khí V (đkc)", c.sub.gas ? val("volume", `${sig(c.volume ?? s.volume)} L`) : "không phải chất khí"],
    };
    const lsize = small ? 11 : 13;
    link(ctx, { x: col(0) + bw + 3, y: y + bh / 2 }, { x: col(1) - 3, y: y + bh / 2 }, ": M", "× M", false, lsize);
    link(ctx, { x: col(1) + bw + 3, y: y + bh / 2 }, { x: col(2) - 3, y: y + bh / 2 }, "× N_{A}", ": N_{A}", false, lsize);
    if (c.sub.gas) link(ctx, { x: col(1) + bw / 2, y: y + bh + 3 }, { x: col(1) + bw / 2, y: y + bh + vGap - 3 }, `× ${fmt(VM)}`, `: ${fmt(VM)}`, true, lsize);
    for (const [key, [bx, by, title, value]] of Object.entries(boxes)) {
      box(ctx, bx, by, bw, bh, { title, value, active: key === c.given, off: key === "volume" && !c.sub.gas, size: key === "volume" && !c.sub.gas ? size - 2 : size });
    }
    // what each constant is, in the free space under m (left of V)
    const notes = [`N_{A} = 6,022·10²³ mol⁻¹`, `1 mol khí ở đkc: ${fmt(VM)} L`];
    const noteX = small ? pad : col(0);
    notes.forEach((t, i) => rich(ctx, t, noteX, y + bh + vGap + bh / 2 + (i - 0.5) * (small ? 14 : 18), { size: small ? 10 : 13, color: COLORS.muted }));
    y += 2 * bh + vGap + (small ? 18 : 30);

    // the working, from the given quantity
    const lines = [];
    if (err) {
      lines.push([`${c.sub.name} (${pretty(c.sub.id)}) không phải chất khí ở điều kiện chuẩn,`, COLORS.red]);
      lines.push(["nên không tính lượng chất từ thể tích mol khí 24,79 L/mol.", COLORS.red]);
    } else {
      const n = sig(c.mol);
      if (c.given === "mass") lines.push([`n = m : M = ${sig(c.mass)} : ${fmt(c.M, 1)} = ${n} mol`]);
      if (c.given === "particles") lines.push([`n = N : N_{A} = ${big(c.particles)} : 6,022·10²³ = ${n} mol`]);
      if (c.given === "volume") lines.push([`n = V : 24,79 = ${sig(c.volume)} : 24,79 = ${n} mol`]);
      if (c.given !== "mass") lines.push([`m = n·M = ${n} · ${fmt(c.M, 1)} = ${sig(c.mass)} g`]);
      if (c.given !== "particles") lines.push([`N = n·N_{A} = ${n} · 6,022·10²³ = ${big(c.particles)}`]);
      if (c.sub.gas && c.given !== "volume") lines.push([`V = n·24,79 = ${n} · 24,79 = ${sig(c.volume)} L`]);
    }
    const lh = small ? 15 : 22;
    for (const [text, color] of lines) {
      rich(ctx, text, pad, y, { size: small ? 12 : 15, color: color ?? COLORS.ink });
      y += lh;
    }

    // footnote: the convention, always on screen
    const foot = small
      ? "đkc: 25 °C, 1 bar. Hình hạt chỉ minh họa, không theo tỉ lệ."
      : "đkc (điều kiện chuẩn): 25 °C và 1 bar, thể tích mol khí 24,79 L/mol. Hình các hạt chỉ minh họa, không theo tỉ lệ.";
    const footY = h - (small ? 9 : 14);
    label(ctx, foot, pad, footY, { size: small ? 10 : 12, color: COLORS.muted });

    // particle picture: one dot for `unit` particles
    const top = y + 2;
    const bottom = footY - (small ? 12 : 18);
    if (err || bottom - top < 46) return;
    const { unit, count } = dotScale(c.particles);
    const capH = small ? 14 : 18;
    const pw = Math.min(w - 2 * pad, 520);
    const px = pad;
    const ph = Math.min(240, bottom - top - capH);
    const caption = count ? `Mỗi chấm ≈ ${big(unit)} ${unitName} (${count} chấm)` : "Không có hạt nào";
    label(ctx, caption, px, top + capH / 2, { size: small ? 11 : 13, color: COLORS.muted });
    const by = top + capH;
    ctx.strokeStyle = "#c9d3e3";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = c.sub.gas ? "#f1f6ff" : "#fff";
    ctx.beginPath();
    ctx.roundRect(px, by, pw, ph, 6);
    ctx.fill();
    ctx.stroke();
    const r = Math.max(2.5, Math.min(small ? 5 : 7, Math.sqrt((pw * ph) / Math.max(count, 1)) / 4));
    ctx.fillStyle = c.sub.gas ? COLORS.blue : COLORS.orange;
    const perRow = Math.max(1, Math.floor((pw - 8) / (2.6 * r)));
    for (let i = 0; i < count; i++) {
      // gases spread through the whole vessel, solids and liquids pack at the bottom
      const x = c.sub.gas ? px + r + 3 + rand(i + 1) * (pw - 2 * r - 6) : px + 4 + r + (i % perRow) * 2.6 * r;
      const yy = c.sub.gas ? by + r + 3 + rand(i + 99) * (ph - 2 * r - 6) : by + ph - 4 - r - Math.floor(i / perRow) * 2.6 * r;
      if (yy < by + r) break;
      ctx.beginPath();
      ctx.arc(x, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
});
