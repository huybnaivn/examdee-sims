import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { N_MAX, initialState, summary } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sup = k => String(k).replace(/\d/g, c => SUP[c]);
const sub = k => String(k).replace(/\d/g, c => SUB[c]);
const PIECE = [COLORS.blue, COLORS.green, COLORS.orange, COLORS.red]; // colour by the power of b

const pw = (v, p) => (p === 0 ? "" : p === 1 ? v : v + sup(p));
const mono = (p, q) => pw("a", p) + pw("b", q) || "1";
const termText = t => (t.coef === 1 && (t.aPow || t.bPow) ? "" : String(t.coef)) + (t.aPow || t.bPow ? mono(t.aPow, t.bPow) : "");
const num = v => fmt(v, 3);
const par = v => (v < 0 ? `(${num(v)})` : num(v));

let hits = []; // clickable terms from the last draw: { x, y, w, h, k }

const clampKeys = s => {
  s.target = Math.min(s.target, s.n);
  s.pick = Math.min(s.pick, s.n);
};

const commitN = (s, api) => {
  const n = summary(s).n;
  api.emit("expanded", { n, sum: 2 ** n }, "result");
};

const checkPick = (s, api) => {
  const r = summary(s);
  if (r.found) api.emit("coefficient-found", { n: r.n, k: r.target, coefficient: r.answer }, "goal");
};

function wrap(ctx, parts, maxW) {
  const lines = [[]];
  let x = 0;
  for (const p of parts) {
    const tw = ctx.measureText(p.text).width;
    if (x + tw > maxW && lines.at(-1).length) {
      lines.push([]);
      x = 0;
    }
    lines.at(-1).push({ ...p, x, w: tw });
    x += tw;
  }
  return lines;
}

function box(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();
}

function drawPascal(ctx, r, x0, y0, w, h, small) {
  const rows = r.rows;
  const cw = Math.min(46, w / (r.n + 1.2));
  const rh = Math.min(32, h / (r.n + 1));
  const size = Math.max(9, Math.min(15, cw * 0.4, rh * 0.55));
  const cx = x0 + w / 2;
  const P = (row, k) => ({ x: cx + (k - row / 2) * cw, y: y0 + rh * (row + 0.5) });
  // highlighted row n
  box(ctx, cx - ((r.n + 1) / 2) * cw - 2, y0 + rh * r.n + 2, (r.n + 1) * cw + 4, rh - 4, "rgba(47, 111, 237, 0.12)", COLORS.blue);
  // Pascal's rule for the chosen entry
  if (r.n >= 2 && r.pick > 0 && r.pick < r.n) {
    const c = P(r.n, r.pick);
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 1.5;
    for (const k of [r.pick - 1, r.pick]) {
      const p = P(r.n - 1, k);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + size * 0.5);
      ctx.lineTo(c.x, c.y - size * 0.55);
      ctx.stroke();
    }
  }
  rows.forEach((row, i) =>
    row.forEach((v, k) => {
      const p = P(i, k);
      const on = i === r.n;
      const picked = on && k === r.pick;
      if (picked) {
        ctx.font = `600 ${size}px ${FONT}`;
        const bw = Math.max(cw * 0.8, ctx.measureText(String(v)).width + 8);
        box(ctx, p.x - bw / 2, p.y - rh * 0.4, bw, rh * 0.8, "#fff", r.found ? COLORS.green : COLORS.orange);
        hits.push({ x: p.x - bw / 2, y: p.y - rh / 2, w: bw, h: rh, k });
      } else if (on) hits.push({ x: p.x - cw / 2, y: p.y - rh / 2, w: cw, h: rh, k });
      const parent = i === r.n - 1 && r.pick > 0 && r.pick < r.n && (k === r.pick - 1 || k === r.pick);
      label(ctx, String(v), p.x, p.y, { size, align: "center", bold: on || parent, color: on ? COLORS.blue : parent ? COLORS.purple : COLORS.ink });
    })
  );
  if (!small && cw > 30) for (let i = 0; i <= r.n; i++) label(ctx, `n = ${i}`, x0 + 4, P(i, 0).y, { size: 11, color: COLORS.muted });
}

// n = 1: a segment; n = 2: a square of side a + b; n = 3: a cube of edge a + b, pulled apart a little.
function drawArea(ctx, r, x0, y0, w, h, small) {
  const A = 3;
  const B = 2;
  const size = small ? 11 : 13;
  label(ctx, small ? "a = 3, b = 2 (minh họa)" : "Mô hình (a = 3, b = 2 đơn vị, minh họa)", x0 + w / 2, y0 + 8, { size: 11, color: COLORS.muted, align: "center" });
  y0 += 20;
  h -= 20;
  if (r.n <= 1) {
    const s = Math.min(w * 0.9, 260) / (A + B);
    const lx = x0 + (w - s * (A + B)) / 2;
    const ly = y0 + h / 2;
    if (r.n === 0) return label(ctx, "(a + b)⁰ = 1", x0 + w / 2, ly, { size: size + 2, bold: true, align: "center" });
    ctx.lineWidth = 8;
    [[0, A, PIECE[0], "a"], [A, B, PIECE[1], "b"]].forEach(([o, l, c, t]) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(lx + o * s + 1, ly);
      ctx.lineTo(lx + (o + l) * s - 1, ly);
      ctx.stroke();
      label(ctx, t, lx + (o + l / 2) * s, ly - 16, { size, bold: true, align: "center", color: c });
    });
    return;
  }
  if (r.n === 2) {
    const s = Math.min(w * 0.85, h * 0.85) / (A + B);
    const lx = x0 + (w - s * (A + B)) / 2;
    const ty = y0 + (h - s * (A + B)) / 2;
    const seg = [[0, A], [A, B]];
    seg.forEach(([oy, ly], j) =>
      seg.forEach(([ox, lx2], i) => {
        const nb = i + j;
        ctx.fillStyle = PIECE[nb];
        ctx.globalAlpha = 0.25;
        ctx.fillRect(lx + ox * s, ty + oy * s, lx2 * s, ly * s);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = PIECE[nb];
        ctx.lineWidth = 2;
        ctx.strokeRect(lx + ox * s + 1, ty + oy * s + 1, lx2 * s - 2, ly * s - 2);
        label(ctx, mono(2 - nb, nb), lx + (ox + lx2 / 2) * s, ty + (oy + ly / 2) * s, { size, bold: true, align: "center", color: PIECE[nb] });
      })
    );
    label(ctx, "a² + 2ab + b²", x0 + w / 2, ty + (A + B) * s + 12, { size, bold: true, align: "center" });
    return;
  }
  // n = 3: oblique projection, depth drawn up and to the right
  const g = 0.35; // gap between pieces, units
  const total = A + B + g;
  const s = Math.min(w / (total * 1.45), (h - 18) / (total * 1.4));
  const kx = 0.45;
  const ky = 0.35;
  const ox = x0 + (w - total * (1 + kx) * s) / 2;
  const oy = y0 + total * (1 + ky) * s + (h - 18 - total * (1 + ky) * s) / 2;
  const P = (x, y, zz) => [ox + (x + zz * kx) * s, oy - (y + zz * ky) * s];
  const span = i => (i ? [A + g, B] : [0, A]);
  const blocks = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let l = 0; l < 2; l++) blocks.push({ i, j, l });
  blocks.sort((p, q) => q.l - p.l || p.j - q.j || p.i - q.i); // painter: back to front, bottom to top, left to right
  const face = (pts, color, alpha) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  for (const { i, j, l } of blocks) {
    const [x, dx] = span(i);
    const [y, dy] = span(j);
    const [zz, dz] = span(l);
    const nb = i + j + l;
    const c = PIECE[nb];
    face([P(x, y + dy, zz), P(x + dx, y + dy, zz), P(x + dx, y + dy, zz + dz), P(x, y + dy, zz + dz)], c, 0.45); // top
    face([P(x + dx, y, zz), P(x + dx, y, zz + dz), P(x + dx, y + dy, zz + dz), P(x + dx, y + dy, zz)], c, 0.6); // right
    face([P(x, y, zz), P(x + dx, y, zz), P(x + dx, y + dy, zz), P(x, y + dy, zz)], c, 0.25); // front
    if (l === 0) {
      const [cx, cy] = P(x + dx / 2, y + dy / 2, 0);
      label(ctx, mono(3 - nb, nb), cx, cy, { size, bold: true, align: "center", color: c });
    }
  }
  label(ctx, small ? "8 khối: 1 + 3 + 3 + 1" : "8 khối: a³ + 3a²b + 3ab² + b³", x0 + w / 2, oy + 14, { size, bold: true, align: "center" });
}

mount({
  slug: "nhi-thuc-newton",
  version: "1.0.0",
  title: "Nhị thức Niu-tơn và tam giác Pa-xcan",
  hint: "Chọn số mũ n để khai triển (a + b)ⁿ. Nhiệm vụ: tìm hệ số của số hạng được yêu cầu bằng cách bấm vào số hạng đó trong khai triển hoặc trên hàng của tam giác Pa-xcan (hoặc dùng nút chọn số hạng).",
  initialState,
  controls: [
    { type: "slider", key: "n", label: "Số mũ n", min: 0, max: N_MAX, step: 1, digits: 0, onChange: clampKeys, onCommit: commitN },
    { type: "heading", label: "Tìm hệ số" },
    { type: "slider", key: "target", label: "Số hạng cần tìm chứa", min: 0, max: N_MAX, step: 1, onChange: clampKeys, format: (v, s) => mono(s.n - Math.min(v, s.n), Math.min(v, s.n)) },
    { type: "stepper", key: "pick", label: "Số hạng em chọn: k =", min: 0, max: N_MAX, onChange: clampKeys, onCommit: checkPick },
    { type: "heading", label: "Thay số" },
    { type: "checkbox", key: "numeric", label: "Thay số cho a và b" },
    { type: "slider", key: "a", label: "a", min: -3, max: 3, step: 0.5, digits: 1, visible: s => s.numeric },
    { type: "slider", key: "b", label: "b", min: -3, max: 3, step: 0.5, digits: 1, visible: s => s.numeric },
  ],
  readouts: [
    { label: "Số hạng tổng quát", value: () => "Tₖ₊₁ = Cₙᵏ·aⁿ⁻ᵏ·bᵏ" },
    { label: "Tổng các hệ số", value: s => `2${sup(summary(s).n)} = ${2 ** summary(s).n}` },
    { label: "Cₙ⁰ − Cₙ¹ + Cₙ² − …", value: s => (summary(s).n ? "0 (thay a = 1, b = −1)" : "1 (n = 0)") },
    {
      label: "Số hạng em chọn",
      value: s => {
        const r = summary(s);
        const t = r.terms[r.pick];
        return `T${sub(r.pick + 1)} = C${sub(r.n)}${sup(r.pick)}·${mono(t.aPow, t.bPow)} = ${termText(t)}`;
      },
    },
    { label: "Kết quả", value: s => (summary(s).found ? `đúng, hệ số là ${summary(s).answer}` : "chưa đúng số hạng cần tìm") },
    { label: "(a + b)ⁿ khi thay số", value: s => (s.numeric ? `(${num(summary(s).a)} + ${par(summary(s).b)})${sup(summary(s).n)} = ${num(summary(s).power)}` : "–") },
  ],
  pointer: {
    down(p, s, api) {
      const h = hits.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      if (!h) return false;
      s.pick = h.k;
      api.emit("term-picked", { n: summary(s).n, k: h.k }, "action");
      checkPick(s, api);
    },
  },
  draw(ctx, s, view) {
    const r = summary(s);
    const { w, h } = view;
    const small = w < 560 || h < 420;
    const size = small ? 13 : 16;
    hits = [];

    // ----- expansion, wrapped; each term is clickable -----
    ctx.font = `600 ${size}px ${FONT}`;
    const parts = [{ text: `(a + b)${sup(r.n)} = ` }];
    r.terms.forEach((t, i) => {
      parts.push({ text: termText(t), k: t.k });
      if (i < r.n) parts.push({ text: " + " });
    });
    const lines = wrap(ctx, parts, w - 36);
    const lineH = size * 1.7;
    const extra = [];
    const tgt = r.terms[r.target];
    extra.push({ text: `Tìm hệ số của số hạng chứa ${mono(tgt.aPow, tgt.bPow)}${r.found ? `: C${sub(r.n)}${sup(r.target)} = ${r.answer} ✓` : ""}`, color: r.found ? COLORS.green : COLORS.orange });
    if (s.numeric) {
      const vals = r.numeric.values.map((v, i) => (i ? (v < 0 ? ` − ${num(-v)}` : ` + ${num(v)}`) : num(v))).join("");
      extra.push({ text: `a = ${num(r.a)}, b = ${num(r.b)}: ${r.n <= 6 && !small ? vals + " = " : ""}${num(r.numeric.sum)} = (${num(r.a)} + ${par(r.b)})${sup(r.n)}`, color: COLORS.purple });
    }
    const exSize = small ? 12 : 14;
    const boxH = lines.length * lineH + extra.length * exSize * 1.6 + 12;
    box(ctx, 8, 8, w - 16, boxH, "#fff", COLORS.grid);
    lines.forEach((line, li) => {
      const y = 8 + 6 + lineH * (li + 0.5);
      for (const p of line) {
        const x = 18 + p.x;
        if (p.k !== undefined) {
          const pickedHere = p.k === r.pick;
          if (pickedHere) box(ctx, x - 3, y - lineH * 0.42, p.w + 6, lineH * 0.84, r.found ? "rgba(31, 157, 107, 0.15)" : "rgba(240, 140, 46, 0.15)", r.found ? COLORS.green : COLORS.orange);
          hits.push({ x: x - 3, y: y - lineH / 2, w: p.w + 6, h: lineH, k: p.k });
          label(ctx, p.text, x, y, { size, bold: true });
        } else label(ctx, p.text, x, y, { size, color: COLORS.muted });
      }
    });
    extra.forEach((e, i) => label(ctx, e.text, 18, 8 + 6 + lines.length * lineH + exSize * 1.6 * (i + 0.5), { size: exSize, bold: true, color: e.color }));

    // ----- Pascal's triangle, and the area model for n ≤ 3 -----
    const top = 8 + boxH + 10;
    const rest = h - top - 6;
    const withArea = r.n <= 3;
    const pw2 = withArea ? w * 0.48 : w - 16;
    label(ctx, "Tam giác Pa-xcan", 8 + pw2 / 2, top + 6, { size: 12, bold: true, color: COLORS.muted, align: "center" });
    drawPascal(ctx, r, 8, top + 16, pw2, rest - 16, small);
    if (withArea) {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(8 + pw2 + 4, top);
      ctx.lineTo(8 + pw2 + 4, h - 8);
      ctx.stroke();
      drawArea(ctx, r, 8 + pw2 + 8, top, w - pw2 - 24, rest, small);
    }
  },
});
