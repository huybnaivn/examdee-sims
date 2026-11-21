import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, ELEMENTS, PROPERTIES, CATEGORIES, LINES, MAX_Z, element, line, lineElements, lineSummary, value, range, configuration, shortConfiguration } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const CAT_COLOR = { metal: "#fbd9b0", metalloid: "#e1d6fb", nonmetal: "#c9ecd9", noble: "#d9e2f1" };
const NONE = "#e9ecf2";
const prop = s => PROPERTIES.find(p => p.id === s.prop) ?? PROPERTIES[0];
const propIndex = s => Math.max(0, PROPERTIES.findIndex(p => p.id === s.prop));
const show = (v, p) => (v == null ? "–" : `${fmt(v, p.digits)}${p.unit ? " " + p.unit : ""}`);

// Light → dark blue by value; noble gases without χ stay grey.
function shade(el, s) {
  if (s.prop === "metal") return { fill: CAT_COLOR[el.category], ink: COLORS.ink };
  const v = value(el, s.prop);
  if (v == null) return { fill: NONE, ink: COLORS.muted };
  const { min, max } = range(s.prop);
  const t = (v - min) / (max - min);
  const mix = (a, b) => Math.round(a + (b - a) * t);
  return { fill: `rgb(${mix(232, 32)}, ${mix(240, 72)}, ${mix(254, 170)})`, ink: t > 0.5 ? "#fff" : COLORS.ink };
}

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 6 : 14;
  const cell = Math.min((view.w - 2 * pad) / 18, (view.h * 0.46) / 4);
  const x0 = (view.w - cell * 18) / 2;
  const y0 = pad;
  const top = y0 + 4 * cell + (small ? 6 : 14);
  return { small, pad, cell, x0, y0, chart: { x: pad, y: top, w: view.w - 2 * pad, h: view.h - top - pad } };
}

const cellRect = (g, el) => ({ x: g.x0 + (el.column - 1) * g.cell, y: g.y0 + (el.period - 1) * g.cell, w: g.cell, h: g.cell });

// Bars of the charted line, placed inside the chart area.
function bars(g, s) {
  const els = lineElements(s.line);
  const c = g.chart;
  const head = g.small ? 34 : 52; // legend + title
  const foot = g.small ? 30 : 44; // symbols + footnote
  const slot = Math.min(c.w / els.length, g.small ? 46 : 70);
  const x = c.x + (c.w - slot * els.length) / 2;
  const base = c.y + c.h - foot;
  const height = Math.max(20, base - (c.y + head) - (g.small ? 12 : 16));
  return { els, slot, x, base, height, head };
}

function fitText(ctx, text, maxW, size, bold) {
  let sz = size;
  ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`;
  while (sz > 8 && ctx.measureText(text).width > maxW) ctx.font = `${bold ? "600 " : ""}${--sz}px ${FONT}`;
  return sz;
}

function drawGrid(ctx, s, g) {
  const lineSet = new Set(lineElements(s.line).map(e => e.z));
  for (const el of ELEMENTS) {
    const r = cellRect(g, el);
    const { fill, ink } = shade(el, s);
    ctx.fillStyle = fill;
    ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    if (lineSet.has(el.z)) {
      ctx.strokeStyle = COLORS.orange;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    }
    const big = g.cell >= 40;
    label(ctx, el.symbol, r.x + r.w / 2, r.y + r.h * (big ? 0.45 : 0.52), { size: Math.max(8, Math.round(g.cell * (big ? 0.34 : 0.42))), align: "center", bold: true, color: ink });
    if (big) {
      label(ctx, String(el.z), r.x + 4, r.y + 9, { size: 10, color: ink });
      const v = value(el, s.prop);
      label(ctx, v == null ? "–" : fmt(v, prop(s).digits), r.x + r.w / 2, r.y + r.h * 0.8, { size: 10, align: "center", color: ink });
    }
  }
  const sel = cellRect(g, element(s.z));
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
}

// The selected element, written in the empty top of the table (rows 1–3, columns 3–12).
function drawInfo(ctx, s, g) {
  const el = element(s.z);
  const p = prop(s);
  const box = { x: g.x0 + 2 * g.cell + 4, y: g.y0 + 2, w: 10 * g.cell - 8, h: 3 * g.cell - 6 };
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  const size = clamp(Math.round(g.cell * 0.34), 10, 15);
  const lh = size * 1.28;
  const main = s.prop === "metal" ? `${CATEGORIES[el.category]}, χ = ${show(el.en, p)}` : `${p.short} = ${show(value(el, s.prop), p)}`;
  const lines = [
    [`${el.z}  ${el.symbol}  ${el.name}`, true, COLORS.ink],
    [`Chu kì ${el.period}, nhóm ${el.group} (cột ${el.column}), ${CATEGORIES[el.category]}`, false, COLORS.muted],
    [g.cell >= 34 ? configuration(el.z) : shortConfiguration(el.z), false, COLORS.ink],
    [main, true, COLORS.blue],
    ...(g.cell >= 34 ? PROPERTIES.slice(0, 3).filter(q => q.id !== s.prop).map(q => [`${q.short} = ${show(value(el, q.id), q)}`, false, COLORS.muted]) : []),
  ];
  const n = Math.min(lines.length, Math.floor((box.h - 4) / lh));
  const y = box.y + (box.h - n * lh) / 2 + lh / 2;
  lines.slice(0, n).forEach(([t, bold, color], i) => {
    const sz = fitText(ctx, t, box.w - 12, size, bold);
    label(ctx, t, box.x + 6, y + i * lh, { size: sz, bold, color });
  });
}

function drawChart(ctx, s, g) {
  const p = prop(s);
  const b = bars(g, s);
  const c = g.chart;
  const fs = g.small ? 11 : 13;
  // legend
  const ly = c.y + (g.small ? 6 : 9);
  if (s.prop === "metal") {
    const cats = Object.entries(CATEGORIES);
    ctx.font = `${fs}px ${FONT}`;
    const widths = cats.map(([, t]) => ctx.measureText(t).width + 24);
    let x = c.x + (c.w - widths.reduce((a, w) => a + w, 0)) / 2;
    cats.forEach(([k, t], i) => {
      ctx.fillStyle = CAT_COLOR[k];
      ctx.fillRect(x, ly - 5, 12, 10);
      label(ctx, t, x + 16, ly, { size: fs, color: COLORS.muted });
      x += widths[i];
    });
  } else {
    const { min, max } = range(s.prop);
    const w = Math.min(200, c.w * 0.4);
    const x = c.x + (c.w - w) / 2;
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "rgb(232, 240, 254)");
    grad.addColorStop(1, "rgb(32, 72, 170)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, ly - 5, w, 10);
    label(ctx, fmt(min, p.digits), x - 6, ly, { size: fs, align: "right", color: COLORS.muted });
    label(ctx, `${fmt(max, p.digits)}${p.unit ? " " + p.unit : ""}`, x + w + 6, ly, { size: fs, color: COLORS.muted });
  }
  // title
  const l = line(s.line);
  const title = `${s.prop === "metal" ? "Tính kim loại (theo độ âm điện χ)" : p.label + (p.unit ? ` (${p.unit})` : "")}, ${l.label.toLowerCase()}`;
  const tsz = fitText(ctx, title, c.w, g.small ? 12 : 15, true);
  label(ctx, title, c.x + c.w / 2, c.y + (g.small ? 21 : 32), { size: tsz, align: "center", bold: true });

  // bars
  const { max } = range(s.prop);
  const vsz = g.small ? 9 : 11;
  ctx.font = `${vsz}px ${FONT}`;
  const wide = b.els.every(el => ctx.measureText(fmt(value(el, s.prop) ?? 0, p.digits)).width < b.slot - 2);
  const sum = lineSummary(s.prop, s.line);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x, b.base + 0.5);
  ctx.lineTo(c.x + c.w, b.base + 0.5);
  ctx.stroke();
  b.els.forEach((el, i) => {
    const v = value(el, s.prop);
    const x = b.x + i * b.slot;
    const bw = Math.max(3, b.slot * 0.7);
    const h = v == null ? 0 : (v / max) * b.height;
    ctx.fillStyle = shade(el, s).fill;
    ctx.fillRect(x + (b.slot - bw) / 2, b.base - h, bw, h);
    if (el.z === s.z) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + (b.slot - bw) / 2, b.base - h, bw, h);
    }
    const ends = i === 0 || i === b.els.length - 1;
    if (wide || el.z === s.z || (ends && b.els.length <= 8) || v == null) {
      label(ctx, v == null ? "–" : fmt(v, p.digits), x + b.slot / 2, b.base - h - 7, { size: vsz, align: "center", color: el.z === s.z ? COLORS.ink : COLORS.muted, bold: el.z === s.z });
    }
    label(ctx, el.symbol, x + b.slot / 2, b.base + (g.small ? 8 : 11), { size: g.small ? 10 : 13, align: "center", bold: el.z === s.z });
  });

  // what the line shows, then the convention used
  const named = b.els.filter(el => value(el, s.prop) != null);
  const a = named[0];
  const z = named.at(-1);
  const trend = `Từ ${a.symbol} đến ${z.symbol}: ${p.short} ${sum.last > sum.first ? "tăng" : "giảm"} từ ${fmt(sum.first, p.digits)} đến ${fmt(sum.last, p.digits)}${p.unit ? " " + p.unit : ""}`;
  const metalTrend = `Từ ${a.symbol} đến ${z.symbol}: χ ${sum.last > sum.first ? "tăng" : "giảm"}, tính kim loại ${sum.last > sum.first ? "giảm" : "tăng"}`;
  const notes = {
    radius: "Bán kính tính toán, cùng một thang cho mọi nguyên tố",
    en: "Khí hiếm (–): không xét độ âm điện",
    ie: "Có ngoại lệ trong chu kì, ví dụ Be > B, N > O",
    metal: "Tính kim loại không đo trực tiếp: χ càng nhỏ, tính kim loại càng mạnh",
  };
  const fy = c.y + c.h - (g.small ? 6 : 9);
  const text = `${s.prop === "metal" ? metalTrend : trend}. ${notes[s.prop]}.`;
  if (g.small) {
    const sz = fitText(ctx, s.prop === "metal" ? metalTrend : trend, c.w, 10, false);
    label(ctx, s.prop === "metal" ? metalTrend : trend, c.x + c.w / 2, fy, { size: sz, align: "center", color: COLORS.muted });
  } else {
    const sz = fitText(ctx, text, c.w, 12, false);
    label(ctx, text, c.x + c.w / 2, fy, { size: sz, align: "center", color: COLORS.muted });
  }
}

const report = (s, api) => {
  const l = line(s.line);
  const { first, last, count } = lineSummary(s.prop, s.line);
  api.emit("line-charted", { property: propIndex(s), period: l.period, group: l.group, first, last, count }, "result");
};

const pick = (s, api, z) => {
  s.z = z;
  api.emit("select-element", { z, period: element(z).period, column: element(z).column });
};

mount({
  slug: "bang-tuan-hoan",
  version: "1.0.0",
  title: "Xu hướng biến đổi trong bảng tuần hoàn",
  hint: "Chọn một tính chất để tô màu bảng, chọn chu kì hoặc nhóm để vẽ biểu đồ. Bấm vào một ô để xem nguyên tố đó.",
  initialState,
  controls: [
    {
      type: "select",
      key: "prop",
      label: "Tính chất",
      options: PROPERTIES.map(p => ({ value: p.id, label: p.label })),
      onCommit: report,
    },
    {
      type: "select",
      key: "line",
      label: "Biểu đồ theo",
      options: LINES.map(l => ({ value: l.id, label: l.label })),
      onCommit: report,
    },
    {
      type: "slider",
      key: "z",
      label: "Nguyên tố (Z)",
      min: 1,
      max: MAX_Z,
      step: 1,
      format: z => `${z} – ${element(z).symbol}`,
      onCommit: (s, api) => pick(s, api, s.z),
    },
  ],
  readouts: [
    { label: "Nguyên tố", value: s => `${element(s.z).symbol} (${element(s.z).name}), Z = ${s.z}` },
    { label: "Cấu hình electron", value: s => configuration(s.z) },
    { label: "Vị trí", value: s => `chu kì ${element(s.z).period}, nhóm ${element(s.z).group}` },
    ...PROPERTIES.slice(0, 3).map(p => ({ label: p.label, value: s => show(value(element(s.z), p.id), p) })),
  ],
  pointer: {
    down(pt, s, api, view) {
      const g = geom(view);
      const col = Math.floor((pt.x - g.x0) / g.cell) + 1;
      const row = Math.floor((pt.y - g.y0) / g.cell) + 1;
      let el = ELEMENTS.find(e => e.column === col && e.period === row);
      if (!el && pt.y > g.chart.y) {
        const b = bars(g, s);
        el = b.els[Math.floor((pt.x - b.x) / b.slot)];
      }
      if (!el) return false;
      pick(s, api, el.z);
    },
  },
  draw(ctx, s, view) {
    const g = geom(view);
    drawGrid(ctx, s, g);
    drawInfo(ctx, s, g);
    drawChart(ctx, s, g);
  },
});
