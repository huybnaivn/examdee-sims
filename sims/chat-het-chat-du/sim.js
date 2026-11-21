import { mount, COLORS, label, fmt, clamp, arrow } from "../../kit/v1/kit.js";
import { REACTIONS, MOL_MAX, MASS_MAX, initialState, reactionById, reactionIndex, amounts, solveState, molarMass, parseFormula, pretty, equationText } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const width = (ctx, text, size, bold) => {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  return ctx.measureText(text).width;
};
const fit = (ctx, text, x, y, maxW, opts) => {
  const tw = width(ctx, text, opts.size, opts.bold);
  label(ctx, text, x, y, { ...opts, size: tw > maxW ? (opts.size * maxW) / tw : opts.size });
};

const ATOM = { H: "#ffffff", O: COLORS.red, N: COLORS.blue, C: "#3b4252", Fe: "#b9622c", S: COLORS.yellow, Ca: "#8fa3b8", Cl: COLORS.green, Zn: "#5f7d95", Al: "#c3cad6" };

// ponytail: schematic molecules (row of up to 3 atoms, otherwise a ring around one atom), not real geometry
function atomsOf(f) {
  const counts = parseFormula(f);
  const els = Object.keys(counts);
  const list = els.flatMap(el => Array(counts[el]).fill(el));
  if (els.length === 1 || list.length <= 3) {
    if (list.length === 3) {
      const center = els.find(el => counts[el] === 1);
      const rest = list.filter((el, i) => i !== list.indexOf(center));
      return [{ el: rest[0], x: -1.6, y: 0 }, { el: center, x: 0, y: 0 }, { el: rest[1], x: 1.6, y: 0 }];
    }
    return list.map((el, i) => ({ el, x: (i - (list.length - 1) / 2) * 1.6, y: 0 }));
  }
  const center = els.reduce((a, b) => (counts[b] < counts[a] ? b : a));
  const ring = list.filter((el, i) => i !== list.indexOf(center));
  return [
    ...ring.map((el, i) => ({ el, x: 1.6 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / ring.length), y: 1.6 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / ring.length) })),
    { el: center, x: 0, y: 0 },
  ];
}

function drawMolecule(ctx, f, x, y, r) {
  for (const a of atomsOf(f)) {
    ctx.fillStyle = ATOM[a.el] ?? COLORS.muted;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + a.x * r, y + a.y * r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

const NICE = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
/** Smallest "nice" amount per drawn particle so neither box needs more than `cap` drawings. */
const unitFor = (totals, cap) => NICE.find(u => totals.every(t => t / u <= cap)) ?? NICE.at(-1);

function drawBox(ctx, x, y, w, h, title, items, unit, small) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  const head = small ? 16 : 22;
  const foot = small ? 15 : 20;
  fit(ctx, title, x + w / 2, y + head / 2 + 3, w - 10, { size: small ? 11 : 13, align: "center", bold: true, color: COLORS.muted });
  // molecules, grouped by substance, in a grid
  const list = items.flatMap(it => Array(Math.round(it.n / unit)).fill(it.f));
  const ih = h - head - foot - 6;
  const iw = w - 12;
  if (list.length) {
    const cols = Math.max(1, Math.round(Math.sqrt((list.length * iw) / ih)));
    const rows = Math.ceil(list.length / cols);
    const cw = iw / cols;
    const ch = ih / rows;
    const r = clamp(Math.min(cw, ch) * 0.17, 2.5, 14);
    list.forEach((f, i) => drawMolecule(ctx, f, x + 6 + cw * ((i % cols) + 0.5), y + head + 3 + ch * (Math.floor(i / cols) + 0.5), r));
  }
  const text = items.filter(it => it.n > 1e-9).map(it => `${pretty(it.f)} ${fmt(it.n, 3)}`).join(" · ") || "trống";
  fit(ctx, `${text} (mol)`, x + w / 2, y + h - foot / 2 - 2, w - 10, { size: small ? 10 : 12, align: "center" });
}

const report = (s, api) => {
  const x = solveState(s);
  const excess = x.limiting === -1 ? 0 : x.leftComplete[1 - x.limiting];
  api.emit(
    "reaction-result",
    { reaction: reactionIndex(s.reaction), limiting: x.limiting + 1, excessLeft: excess, productTheoretical: x.main.theoretical, productActual: x.main.actual, yield: s.yield },
    "result"
  );
};

const amountLabel = (i, unit) => (v, s) => {
  const r = reactionById(s.reaction);
  const [f] = r.left[i];
  return unit === "g" ? `${pretty(f)}: ${fmt(v, 1)} g (${fmt(v / molarMass(f), 3)} mol)` : `${pretty(f)}: ${fmt(v, 2)} mol`;
};

mount({
  slug: "chat-het-chat-du",
  version: "1.0.0",
  title: "Chất hết, chất dư và hiệu suất",
  hint: "Chọn phản ứng, đặt lượng hai chất tham gia và hiệu suất. Chất có tỉ lệ n : hệ số nhỏ hơn là chất hết; sản phẩm tính theo chất hết.",
  initialState,
  controls: [
    { type: "select", key: "reaction", label: "Phản ứng", options: REACTIONS.map(r => ({ value: r.id, label: equationText(r) })) },
    {
      type: "select",
      key: "unit",
      label: "Nhập lượng chất theo",
      options: [
        { value: "mol", label: "Số mol (mol)" },
        { value: "g", label: "Khối lượng (g)" },
      ],
    },
    { type: "slider", key: "n1", label: "Chất tham gia 1", min: 0, max: MOL_MAX, step: 0.1, format: amountLabel(0, "mol"), visible: s => s.unit === "mol" },
    { type: "slider", key: "n2", label: "Chất tham gia 2", min: 0, max: MOL_MAX, step: 0.1, format: amountLabel(1, "mol"), visible: s => s.unit === "mol" },
    { type: "slider", key: "m1", label: "Chất tham gia 1", min: 0, max: MASS_MAX, step: 0.5, format: amountLabel(0, "g"), visible: s => s.unit === "g" },
    { type: "slider", key: "m2", label: "Chất tham gia 2", min: 0, max: MASS_MAX, step: 0.5, format: amountLabel(1, "g"), visible: s => s.unit === "g" },
    { type: "slider", key: "yield", label: "Hiệu suất H", min: 0, max: 100, step: 1, unit: "%", digits: 0 },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    {
      label: "Chất hết",
      value: s => {
        const x = solveState(s);
        const r = reactionById(s.reaction);
        return x.extent === 0 && x.limiting === -1 ? "–" : x.limiting === -1 ? "cả hai (vừa đủ)" : pretty(r.left[x.limiting][0]);
      },
    },
    {
      label: "Chất dư (phản ứng hoàn toàn)",
      value: s => {
        const x = solveState(s);
        const r = reactionById(s.reaction);
        if (x.limiting === -1) return "không";
        const j = 1 - x.limiting;
        return `${pretty(r.left[j][0])} còn ${fmt(x.leftComplete[j], 3)} mol`;
      },
    },
    {
      label: "Sản phẩm lí thuyết",
      value: s => {
        const x = solveState(s);
        return `${fmt(x.main.theoretical, 3)} mol = ${fmt(x.main.theoretical * x.main.M, 2)} g ${pretty(reactionById(s.reaction).right[reactionById(s.reaction).main][0])}`;
      },
    },
    {
      label: "Sản phẩm thực tế",
      value: s => {
        const x = solveState(s);
        return `${fmt(x.main.actual, 3)} mol = ${fmt(x.main.actual * x.main.M, 2)} g`;
      },
    },
    {
      label: "Khối lượng trước / sau",
      value: s => {
        const x = solveState(s);
        return `${fmt(x.massBefore, 2)} g / ${fmt(x.massAfter, 2)} g`;
      },
    },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const r = reactionById(s.reaction);
    const n = amounts(s);
    const x = solveState(s);
    const small = w < 560 || h < 420;
    const pad = 10;
    const base = clamp(Math.min(w / 52, h / 32), 11, 15);

    // equation, then n : hệ số under each reactant
    let y = small ? 16 : 26;
    fit(ctx, `${equationText(r)}${r.cond ? `   (${r.cond})` : ""}`, w / 2, y, w - 2 * pad, { size: clamp(w / 26, 15, 26), align: "center", bold: true });
    y += small ? 20 : 30;
    const parts = r.left.map(([f, nu], i) => {
      const lim = x.limiting === i || x.limiting === -1;
      return { text: `${pretty(f)}: ${fmt(n[i], 3)} : ${nu} = ${fmt(x.ratios[i], 3)}`, color: x.extent === 0 && n[i] > 0 ? COLORS.ink : lim ? COLORS.red : COLORS.green };
    });
    const sign = x.limiting === -1 ? "=" : x.limiting === 0 ? "<" : ">";
    const line = `${parts[0].text}   ${sign}   ${parts[1].text}`;
    const size = Math.min(base + 1, ((base + 1) * (w - 2 * pad)) / width(ctx, line, base + 1, true));
    let cx = (w - width(ctx, line, size, true)) / 2;
    for (const [text, color] of [[parts[0].text, parts[0].color], [`   ${sign}   `, COLORS.muted], [parts[1].text, parts[1].color]]) {
      label(ctx, text, cx, y, { size, bold: true, color });
      cx += width(ctx, text, size, true);
    }
    if (!small) {
      label(ctx, "So sánh tỉ lệ n : hệ số; chất có tỉ lệ nhỏ hơn hết trước (đỏ), chất kia dư (xanh)", w / 2, y + 20, { size: base - 1, align: "center", color: COLORS.muted });
    }

    // before / after boxes
    const top = y + (small ? 14 : 38);
    const bottom = h - (small ? 50 : 70);
    const gap = small ? 24 : 40;
    const bw = (w - 2 * pad - gap) / 2;
    const before = r.left.map(([f], i) => ({ f, n: n[i] }));
    const after = [...r.left.map(([f], i) => ({ f, n: x.leftActual[i] })), ...r.right.map(([f], i) => ({ f, n: x.actual[i] }))];
    const sum = list => list.reduce((a, it) => a + it.n, 0);
    const cap = clamp(Math.floor((bw * (bottom - top)) / (small ? 380 : 520)), 8, 40);
    const unit = unitFor([sum(before), sum(after)], cap);
    if (bottom - top > 60) {
      drawBox(ctx, pad, top, bw, bottom - top, "Trước phản ứng", before, unit, small);
      drawBox(ctx, pad + bw + gap, top, bw, bottom - top, `Sau phản ứng (H = ${fmt(s.yield, 0)}%)`, after, unit, small);
      arrow(ctx, pad + bw + 5, (top + bottom) / 2, pad + bw + gap - 5, (top + bottom) / 2, COLORS.muted, 2.5);
    }

    // summary
    const main = r.right[r.main][0];
    const lines = [
      x.extent === 0
        ? "Chưa có phản ứng: cần có đủ cả hai chất tham gia"
        : x.limiting === -1
          ? "Hai chất vừa đủ: cả hai đều hết (khi phản ứng hoàn toàn)"
          : `Chất hết: ${pretty(r.left[x.limiting][0])} · Chất dư: ${pretty(r.left[1 - x.limiting][0])}, còn ${fmt(x.leftComplete[1 - x.limiting], 3)} mol khi phản ứng hoàn toàn`,
      `${pretty(main)}: lí thuyết ${fmt(x.main.theoretical, 3)} mol · thực tế = ${fmt(s.yield, 0)}% × lí thuyết = ${fmt(x.main.actual, 3)} mol (${fmt(x.main.actual * x.main.M, 2)} g)`,
    ];
    const ly = bottom + (small ? 12 : 18);
    lines.forEach((t, i) => fit(ctx, t, w / 2, ly + i * (small ? 15 : 20), w - 2 * pad, { size: base, align: "center", bold: i === 0, color: i === 0 && x.limiting !== -1 && x.extent > 0 ? COLORS.red : COLORS.ink }));
    fit(ctx, `Mỗi hình phân tử ứng với ${fmt(unit, 2)} mol (số hình được làm tròn) · mô hình phân tử chỉ để minh họa`, w / 2, h - 7, w - 2 * pad, { size: base - 2, align: "center", color: COLORS.muted });
  },
});
