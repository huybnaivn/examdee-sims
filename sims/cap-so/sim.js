import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { N_MAX, U_LIM, D_LIM, Q_LIM, initialState, summary } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const NAME = { arith: "Cấp số cộng", geo: "Cấp số nhân" };
const COLOR = { arith: COLORS.green, geo: COLORS.blue };
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUB = "₀₁₂₃₄₅₆₇₈₉";

const num = v => fmt(v, 3);
const sup = k => String(k).replace(/\d/g, c => SUP[c]);
const sub = k => String(k).replace(/\d/g, c => SUB[c]);
const p = v => (v < 0 ? `(${num(v)})` : num(v)); // a negative factor goes in brackets

// The formula lines with numbers substituted; `full` adds the general formula in front.
function formulas(r, full) {
  const n = r.n;
  const un = `u${sub(n)}`;
  const Sn = `S${sub(n)}`;
  if (r.kind === "arith") {
    return [
      `${full ? "uₙ = u₁ + (n − 1)d ⇒ " : ""}${un} = ${num(r.u1)} + (${n} − 1)·${p(r.d)} = ${num(r.un)}`,
      `${full ? "Sₙ = n(u₁ + uₙ)/2 ⇒ " : ""}${Sn} = ${n}·(${num(r.u1)} + ${p(r.un)})/2 = ${num(r.sum)}`,
    ];
  }
  const qn = r.q === 1 ? "" : `${p(r.q)}${sup(n - 1)}`;
  return [
    `${full ? "uₙ = u₁·qⁿ⁻¹ ⇒ " : ""}${un} = ${p(r.u1)}·${qn || "1"} = ${num(r.un)}`,
    r.q === 1
      ? `${full ? "q = 1: Sₙ = n·u₁ ⇒ " : ""}${Sn} = ${n}·${p(r.u1)} = ${num(r.sum)}`
      : `${full ? "Sₙ = u₁(1 − qⁿ)/(1 − q) ⇒ " : ""}${Sn} = ${p(r.u1)}·(1 − ${p(r.q)}${sup(n)})/(1 − ${p(r.q)}) = ${num(r.sum)}`,
  ];
}

const infiniteText = r =>
  r.infinite === null ? "|q| ≥ 1: không có tổng vô hạn" : `|q| < 1: S = u₁/(1 − q) = ${p(r.u1)}/(1 − ${p(r.q)}) = ${num(r.infinite)}`;

const middleText = r => {
  const m = r.middle;
  if (!m) return "cần n ≥ 3";
  const k = m.k;
  return r.kind === "arith"
    ? `u${sub(k)} = (u${sub(k - 1)} + u${sub(k + 1)})/2 = ${num(m.right)}`
    : `u${sub(k)}² = u${sub(k - 1)}·u${sub(k + 1)} = ${num(m.right)}`;
};

// One result per finished change.
const commit = (s, api) => {
  const r = summary(s);
  api.emit("sequence-computed", { type: r.kind === "arith" ? 1 : 2, u1: r.u1, common: r.c, n: r.n, un: r.un, sum: r.sum }, "result");
};

// A tick step of 1, 2 or 5 × 10ᵏ giving about `count` intervals.
function niceStep(span, count) {
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * pow).find(v => v >= raw);
}

mount({
  slug: "cap-so",
  version: "1.0.0",
  title: "Cấp số cộng và cấp số nhân",
  hint: "Chọn loại dãy số, số hạng đầu, công sai hoặc công bội và số số hạng. Bật so sánh để thấy cấp số cộng tăng đều còn cấp số nhân tăng ngày càng nhanh.",
  initialState,
  controls: [
    {
      type: "select",
      key: "kind",
      label: "Loại dãy số",
      options: [
        { value: "arith", label: "Cấp số cộng" },
        { value: "geo", label: "Cấp số nhân" },
      ],
      onCommit: commit,
    },
    { type: "slider", key: "u1", label: "Số hạng đầu u₁", min: -U_LIM, max: U_LIM, step: 0.5, digits: 1, onCommit: commit },
    { type: "slider", key: "d", label: "Công sai d", min: -D_LIM, max: D_LIM, step: 0.5, digits: 1, visible: s => s.kind === "arith" || s.overlay, onCommit: commit },
    { type: "slider", key: "q", label: "Công bội q", min: -Q_LIM, max: Q_LIM, step: 0.1, digits: 1, visible: s => s.kind === "geo" || s.overlay, onCommit: commit },
    { type: "slider", key: "n", label: "Số số hạng n", min: 1, max: N_MAX, step: 1, digits: 0, onCommit: commit },
    { type: "checkbox", key: "overlay", label: "Vẽ thêm dãy loại kia (cùng u₁) để so sánh", onCommit: commit },
  ],
  readouts: [
    { label: "Số hạng tổng quát", value: s => (summary(s).kind === "arith" ? "uₙ = u₁ + (n − 1)d" : "uₙ = u₁·qⁿ⁻¹") },
    {
      label: "Tổng Sₙ",
      value: s => {
        const r = summary(s);
        return r.kind === "arith" ? "Sₙ = n(u₁ + uₙ)/2" : r.q === 1 ? "Sₙ = n·u₁ (q = 1)" : "Sₙ = u₁(1 − qⁿ)/(1 − q)";
      },
    },
    { label: "Kết quả uₙ", value: s => `u${sub(summary(s).n)} = ${num(summary(s).un)}` },
    { label: "Kết quả Sₙ", value: s => `S${sub(summary(s).n)} = ${num(summary(s).sum)}` },
    { label: "Tổng vô hạn", value: s => (summary(s).kind === "arith" ? "không có (cấp số cộng)" : infiniteText(summary(s))) },
    { label: "Số hạng giữa", value: s => middleText(summary(s)) },
    { label: "Các số hạng", value: s => summary(s).terms.map(num).join("; ") },
  ],
  draw(ctx, s, view) {
    const r = summary(s);
    const { w, h } = view;
    const small = w < 560 || h < 420;
    const size = small ? 12 : 14;
    const lineH = size * 1.5;
    const otherKind = r.kind === "arith" ? "geo" : "arith";

    // ----- box with the formulas -----
    const lines = [{ text: `${NAME[r.kind]}: u₁ = ${num(r.u1)}, ${r.kind === "arith" ? `d = ${num(r.d)}` : `q = ${num(r.q)}`}`, color: COLOR[r.kind], big: true }];
    for (const t of formulas(r, !small)) lines.push({ text: t, color: COLORS.ink });
    if (r.kind === "geo") lines.push({ text: infiniteText(r), color: r.infinite === null ? COLORS.muted : COLORS.purple });
    if (s.overlay) lines.push({ text: `So sánh: ${NAME[otherKind].toLowerCase()}, ${otherKind === "arith" ? `d = ${num(r.d)}` : `q = ${num(r.q)}`}`, color: COLOR[otherKind] });
    const fontOf = l => `600 ${l.big ? size + 2 : size}px ${FONT}`;
    const boxW = Math.min(w - 16, Math.max(...lines.map(l => ((ctx.font = fontOf(l)), ctx.measureText(l.text).width))) + 22);
    const boxH = lineH * lines.length + 10;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(8, 8, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(8, 8, boxW - 4, boxH);
    ctx.clip(); // a very long line (huge numbers) is cut at the box edge; the panel shows the values in full
    lines.forEach((l, i) => label(ctx, l.text, 18, 13 + lineH * (i + 0.5), { size: l.big ? size + 2 : size, bold: true, color: l.color }));
    ctx.restore();

    // ----- chart: term index on the x axis, value on the y axis -----
    const series = [{ kind: r.kind, vals: r.terms }];
    if (s.overlay) series.push({ kind: otherKind, vals: r.other });
    const all = series.flatMap(x => x.vals);
    let lo = Math.min(0, ...all);
    let hi = Math.max(0, ...all);
    if (hi - lo < 1e-9) hi = lo + 1;
    const stepY = niceStep(hi - lo, small ? 4 : 6);
    lo = Math.floor(lo / stepY + 1e-9) * stepY;
    hi = Math.ceil(hi / stepY - 1e-9) * stepY;
    const tickLabels = [];
    // ticks of a million and more are written as a·10ᵏ so they stay short
    const e = stepY >= 1e6 ? Math.floor(Math.log10(Math.max(Math.abs(lo), Math.abs(hi)))) : 0;
    for (let v = lo; v <= hi + stepY / 2; v += stepY) tickLabels.push({ v, text: e && v ? `${fmt(v / 10 ** e, 2)}·10${sup(e)}` : fmt(v, 3) });
    ctx.font = `11px ${FONT}`;
    const left = 14 + Math.max(...tickLabels.map(t => ctx.measureText(t.text).width));
    const right = w - 22; // room for the axis name n
    const top = 8 + boxH + 18;
    const bottom = h - 26;
    const Y = v => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    const slot = (right - left) / r.n;
    const X = k => left + slot * (k - 0.5); // centre of term k

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const t of tickLabels) {
      ctx.moveTo(left, Y(t.v));
      ctx.lineTo(right, Y(t.v));
    }
    ctx.stroke();
    for (const t of tickLabels) label(ctx, t.text, left - 6, Y(t.v), { size: 11, color: COLORS.muted, align: "right" });
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, Y(0));
    ctx.lineTo(right, Y(0));
    ctx.moveTo(left, top - 6);
    ctx.lineTo(left, bottom);
    ctx.stroke();
    const every = Math.ceil(22 / slot); // index labels at most every 22 px
    for (let k = 1; k <= r.n; k++) {
      if ((r.n - k) % every === 0) label(ctx, String(k), X(k), bottom + 13, { size: 11, color: COLORS.muted, align: "center" });
    }
    label(ctx, "n", w - 8, bottom + 13, { size: 12, bold: true, align: "right" });

    // bars from 0 to uₖ, then the points uₖ joined by a thin line
    const m = series.length;
    const barW = Math.max(2, Math.min(28, (slot * 0.7) / m));
    series.forEach((sr, j) => {
      const dx = (j - (m - 1) / 2) * barW;
      const color = COLOR[sr.kind];
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      sr.vals.forEach((v, i) => {
        const y0 = Y(0);
        const y1 = Y(v);
        ctx.fillRect(X(i + 1) + dx - barW / 2, Math.min(y0, y1), barW, Math.abs(y1 - y0));
      });
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      sr.vals.forEach((v, i) => (i ? ctx.lineTo(X(i + 1) + dx, Y(v)) : ctx.moveTo(X(i + 1) + dx, Y(v))));
      ctx.stroke();
      ctx.setLineDash([]);
      sr.vals.forEach((v, i) => {
        ctx.fillStyle = color;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(X(i + 1) + dx, Y(v), j === 0 ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    });

    // values of the selected sequence above its points when there is room
    ctx.font = `600 11px ${FONT}`;
    const widest = Math.max(...r.terms.map(v => ctx.measureText(num(v)).width));
    if (widest + 6 < slot) {
      const dx = (-(m - 1) / 2) * barW;
      r.terms.forEach((v, i) => {
        const y = Y(v) + (v >= 0 ? -12 : 12);
        ctx.lineWidth = 3;
        ctx.strokeStyle = COLORS.bg;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(num(v), X(i + 1) + dx, y);
        label(ctx, num(v), X(i + 1) + dx, y, { size: 11, bold: true, color: COLOR[r.kind], align: "center" });
      });
    }
  },
});
