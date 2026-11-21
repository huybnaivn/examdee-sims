import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, summary, numer, denom, N_SCAN } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const num = (v, d = 3) => fmt(v, d);

function polyText(cs) {
  let out = "";
  cs.forEach((c, i) => {
    if (!c) return;
    const p = ["n²", "n", ""][i];
    out += out ? ` ${c < 0 ? "−" : "+"} ` : c < 0 ? "−" : "";
    out += (Math.abs(c) === 1 && p ? "" : String(Math.abs(c))) + p;
  });
  return out || "0";
}

const formula = s => {
  switch (s.seq) {
    case "inv":
      return "uₙ = 1/n";
    case "alt":
      return "uₙ = (−1)ⁿ/n";
    case "ratio":
      return "uₙ = (n + 1)/n";
    case "geo":
      return `uₙ = qⁿ, q = ${num(s.q, 2)}`;
    case "e":
      return "uₙ = (1 + 1/n)ⁿ";
    default:
      return `uₙ = (${polyText(numer(s))})/(${polyText(denom(s))})`;
  }
};

const limitText = lim =>
  lim.value === null ? "dãy không có giới hạn" : lim.value === Infinity ? "lim uₙ = +∞" : lim.value === -Infinity ? "lim uₙ = −∞" : `lim uₙ = ${lim.value === Math.E ? "e ≈ 2,718" : num(lim.value)}`;

const nText = r => (r.N === null ? `không có N (trong ${fmt(N_SCAN, 0)} số hạng đầu)` : `N = ${fmt(r.N, 0)}`);

const commitEps = (s, api) => {
  const r = summary(s);
  api.emit("epsilon-set", { epsilon: r.eps, guess: r.guess, found: r.N === null ? 0 : 1, ...(r.N !== null && { N: r.N }) }, "result");
};

const commitGuess = (s, api) => {
  const r = summary(s);
  if (r.correct) api.emit("limit-guessed", { limit: r.lim.value, guess: r.guess }, "goal");
};

function niceStep(span, count) {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * pow).find(v => v >= raw);
}

const coef = (key, text) => ({ type: "slider", key, label: text, min: -5, max: 5, step: 1, digits: 0, visible: s => s.seq === "poly" });

mount({
  slug: "gioi-han-day-so",
  version: "1.0.0",
  title: "Giới hạn của dãy số",
  hint: "Chọn một dãy số, dự đoán giới hạn L rồi thu hẹp ε. Nếu L đúng là giới hạn thì dù ε nhỏ đến đâu, kể từ một chỉ số N nào đó mọi số hạng đều nằm trong dải (L − ε; L + ε).",
  initialState,
  controls: [
    {
      type: "select",
      key: "seq",
      label: "Dãy số",
      options: [
        { value: "inv", label: "uₙ = 1/n" },
        { value: "alt", label: "uₙ = (−1)ⁿ/n" },
        { value: "ratio", label: "uₙ = (n + 1)/n" },
        { value: "geo", label: "uₙ = qⁿ" },
        { value: "e", label: "uₙ = (1 + 1/n)ⁿ" },
        { value: "poly", label: "uₙ = P(n)/Q(n) (tự chọn)" },
      ],
    },
    { type: "slider", key: "q", label: "Công bội q", min: -1.5, max: 1.5, step: 0.05, digits: 2, visible: s => s.seq === "geo" },
    coef("p2", "Tử số: hệ số của n²"),
    coef("p1", "Tử số: hệ số của n"),
    coef("p0", "Tử số: hệ số tự do"),
    coef("r2", "Mẫu số: hệ số của n²"),
    coef("r1", "Mẫu số: hệ số của n"),
    coef("r0", "Mẫu số: hệ số tự do"),
    { type: "heading", label: "Dự đoán giới hạn" },
    { type: "slider", key: "guess", label: "Giới hạn dự đoán L", min: -5, max: 5, step: 0.01, digits: 2, onCommit: commitGuess },
    { type: "slider", key: "eps", label: "Độ rộng ε", min: 0.01, max: 1, step: 0.01, digits: 2, onCommit: commitEps },
    { type: "slider", key: "nShow", label: "Số số hạng vẽ", min: 10, max: 200, step: 10, digits: 0 },
    { type: "checkbox", key: "showLimit", label: "Hiện giới hạn đúng" },
  ],
  readouts: [
    { label: "Dãy số", value: s => formula(s) },
    { label: "Dải", value: s => `(${num(summary(s).guess - summary(s).eps)}; ${num(summary(s).guess + summary(s).eps)})` },
    { label: "Chỉ số N", value: s => nText(summary(s)) },
    { label: "Dự đoán", value: s => (summary(s).correct ? "đúng" : s.showLimit ? "chưa đúng" : "chưa đúng hoặc chưa kiểm tra được") },
    { label: "Giới hạn", value: s => (s.showLimit || summary(s).correct ? limitText(summary(s).lim) : "(bật “Hiện giới hạn đúng”)") },
  ],
  draw(ctx, s, view) {
    const r = summary(s);
    const { w, h } = view;
    const small = w < 560 || h < 420;
    const size = small ? 12 : 14;
    const lineH = size * 1.5;

    // ----- text box -----
    const lines = [{ text: formula(s), color: COLORS.blue, big: true }];
    lines.push({ text: `L = ${num(r.guess, 2)}, ε = ${num(r.eps, 2)}: ${nText(r)}`, color: r.N === null ? COLORS.red : COLORS.green });
    if (r.N !== null && !small) lines.push({ text: `Mọi n ≥ ${fmt(r.N, 0)} đều có |uₙ − ${num(r.guess, 2)}| < ${num(r.eps, 2)}`, color: COLORS.ink });
    if (s.showLimit || r.correct) lines.push({ text: `${limitText(r.lim)}${r.correct ? " — dự đoán đúng!" : ""}`, color: COLORS.purple });
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
    lines.forEach((l, i) => label(ctx, l.text, 18, 13 + lineH * (i + 0.5), { size: l.big ? size + 2 : size, bold: true, color: l.color }));

    // ----- chart -----
    const vals = r.terms.filter(v => v !== null && Number.isFinite(v));
    let lo = Math.min(r.guess - r.eps, ...vals);
    let hi = Math.max(r.guess + r.eps, ...vals);
    const padY = (hi - lo) * 0.06 || 0.5;
    lo -= padY;
    hi += padY;
    const stepY = niceStep(hi - lo, small ? 4 : 6);
    const ticks = [];
    for (let v = Math.ceil(lo / stepY) * stepY; v <= hi; v += stepY) ticks.push(v);
    ctx.font = `11px ${FONT}`;
    const left = 12 + Math.max(...ticks.map(v => ctx.measureText(fmt(v, 3)).width));
    const right = w - 18;
    const top = 8 + boxH + 14;
    const bottom = h - (small ? 30 : 36);
    const X = n => left + ((n - 0.5) / r.nShow) * (right - left);
    const Y = v => bottom - ((v - lo) / (hi - lo)) * (bottom - top);

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top - 4, right - left, bottom - top + 8);
    ctx.clip();
    // band (L − ε; L + ε)
    ctx.fillStyle = "rgba(47, 111, 237, 0.12)";
    ctx.fillRect(left, Y(r.guess + r.eps), right - left, Y(r.guess - r.eps) - Y(r.guess + r.eps));
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const v of ticks) {
      ctx.moveTo(left, Y(v));
      ctx.lineTo(right, Y(v));
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.blue;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, Y(r.guess));
    ctx.lineTo(right, Y(r.guess));
    ctx.stroke();
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    for (const v of [r.guess - r.eps, r.guess + r.eps]) {
      ctx.beginPath();
      ctx.moveTo(left, Y(v));
      ctx.lineTo(right, Y(v));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the true limit, when revealed
    if ((s.showLimit || r.correct) && Number.isFinite(r.lim.value) && !r.correct) {
      ctx.strokeStyle = COLORS.purple;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, Y(r.lim.value));
      ctx.lineTo(right, Y(r.lim.value));
      ctx.stroke();
      label(ctx, "lim uₙ", left + 6, Y(r.lim.value) - 9, { size: 11, bold: true, color: COLORS.purple });
    }
    // from N on: shaded and marked
    if (r.N !== null && r.N <= r.nShow) {
      const xN = X(r.N) - (X(2) - X(1)) / 2;
      ctx.fillStyle = "rgba(31, 157, 107, 0.08)";
      ctx.fillRect(xN, top - 4, right - xN, bottom - top + 8);
      ctx.strokeStyle = COLORS.green;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xN, top - 4);
      ctx.lineTo(xN, bottom + 4);
      ctx.stroke();
    }
    // the terms
    const rad = r.nShow > 100 ? 2.5 : r.nShow > 50 ? 3.5 : 4.5;
    r.terms.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) return;
      const inside = Math.abs(v - r.guess) < r.eps;
      ctx.fillStyle = inside ? COLORS.green : COLORS.red;
      ctx.beginPath();
      ctx.arc(X(i + 1), Y(v), rad, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // axes and labels
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, top - 6);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    for (const v of ticks) label(ctx, fmt(v, 3), left - 5, Y(v), { size: 11, color: COLORS.muted, align: "right" });
    const stepN = Math.max(1, niceStep(r.nShow, (right - left) / 40));
    for (let n = stepN; n <= r.nShow; n += stepN) label(ctx, String(n), X(n), bottom + 11, { size: 11, color: COLORS.muted, align: "center" });
    label(ctx, "n", w - 8, bottom + 11, { size: 12, bold: true, align: "right" });
    label(ctx, small ? "L ± ε" : `L ± ε = ${num(r.guess, 2)} ± ${num(r.eps, 2)}`, right - 4, Math.max(top + 8, Y(r.guess + r.eps) - 9), { size: 11, bold: true, color: COLORS.blue, align: "right" });
    if (r.N !== null && r.N <= r.nShow) {
      const xN = X(r.N) - (X(2) - X(1)) / 2;
      label(ctx, `N = ${r.N}`, xN + 5, top + 6, { size: 12, bold: true, color: COLORS.green });
    } else if (r.N !== null) label(ctx, `N = ${fmt(r.N, 0)}: ở ngoài khung hình →`, right, top + 6, { size: 12, bold: true, color: COLORS.green, align: "right" });
    if (!small) label(ctx, "Xanh: số hạng trong dải, đỏ: ngoài dải", left, bottom + 25, { size: 11, color: COLORS.muted });
  },
});
