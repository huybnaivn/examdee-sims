import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { N_MAX, K_MAX, initialState, settings, typeCode, TYPE_NAMES, count, firstArrangements, big, formula } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const LETTERS = "ABCDEFGHIJKLMNOPQRST";
const ball = i => `hsl(${(i * 137.5) % 360}, 62%, ${i % 2 ? 44 : 52}%)`; // golden-angle hues, never two alike
const SHOW_MAX = 400; // never enumerate more than this for the picture

const title = s => {
  const { n, k } = settings(s);
  const type = typeCode(s);
  if (type === 1) return `Hoán vị của ${n} phần tử`;
  return `${TYPE_NAMES[type]} chập ${k} của ${n} phần tử`;
};

// ---- formula pieces: "A" with a subscript below and a superscript above, Vietnamese style ----
const font = (size, bold) => `${bold ? "600 " : ""}${size}px ${FONT}`;
function pieceWidth(ctx, p, size) {
  if (typeof p === "string") {
    ctx.font = font(size);
    return ctx.measureText(p).width;
  }
  ctx.font = font(size, true);
  const base = ctx.measureText(p.b).width;
  ctx.font = font(size * 0.68);
  return base + Math.max(p.sub ? ctx.measureText(p.sub).width : 0, p.sup ? ctx.measureText(p.sup).width : 0) + 2;
}
const lineWidth = (ctx, pieces, size) => pieces.reduce((w, p) => w + pieceWidth(ctx, p, size), 0);
function drawPieces(ctx, pieces, cx, y, size, color = COLORS.ink) {
  let x = cx - lineWidth(ctx, pieces, size) / 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (const p of pieces) {
    if (typeof p === "string") {
      ctx.font = font(size);
      ctx.fillText(p, x, y);
    } else {
      ctx.font = font(size, true);
      ctx.fillText(p.b, x, y);
      const bx = x + ctx.measureText(p.b).width + 1;
      ctx.font = font(size * 0.68);
      if (p.sup) ctx.fillText(p.sup, bx, y - size * 0.42);
      if (p.sub) ctx.fillText(p.sub, bx, y + size * 0.42);
    }
    x += pieceWidth(ctx, p, size);
  }
  ctx.restore();
}
// Largest font (from `size` down to 9 px) at which the line fits in `w`.
const fitSize = (ctx, pieces, size, w) => {
  while (size > 9 && lineWidth(ctx, pieces, size) > w) size -= 0.5;
  return size;
};

function drawBall(ctx, i, x, y, d) {
  ctx.fillStyle = ball(i);
  ctx.beginPath();
  ctx.arc(x, y, d / 2, 0, 2 * Math.PI);
  ctx.fill();
  if (d >= 13) label(ctx, LETTERS[i], x, y + 0.5, { color: "#fff", size: Math.round(d * 0.58), align: "center", bold: true });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Biggest balls for which every arrangement fits; if none does, small balls and as many cells as fit.
function gridLayout(w, h, k, total) {
  const gap = 6;
  const fit = d => {
    const cw = k * (d + 3) + 9;
    const ch = d + 10;
    const cols = Math.floor((w + gap) / (cw + gap));
    const rows = Math.floor((h + gap) / (ch + gap));
    return { d, cw, ch, cols, rows, gap, cap: Math.max(0, cols * rows) };
  };
  for (let d = 40; d >= 11; d--) {
    const g = fit(d);
    if (g.cap >= Math.min(total, SHOW_MAX)) return g;
  }
  // too many to show: medium balls (letters still readable) unless one row of k is too wide
  let d = 14;
  while (d > 4 && fit(d).cols < 1) d--;
  return fit(d);
}

const report = (s, api) => {
  const { n, k } = settings(s);
  Object.assign(s, { n, k }); // keep the sliders honest: k ≤ n without repetition
  api.emit("counted", { n, k, type: typeCode(s), count: Number(count(s)) }, "result");
};
const clampK = s => {
  if (!s.repeat && s.k > s.n) s.k = s.n;
};

mount({
  slug: "to-hop",
  version: "1.0.0",
  title: "Hoán vị, chỉnh hợp và tổ hợp",
  hint: "Chọn số đồ vật n, số cần lấy k, có kể thứ tự hay không, có được lặp lại hay không. Mỗi ô trên hình là một cách chọn; công thức ở dưới đếm đúng số ô đó.",
  initialState,
  controls: [
    { type: "slider", key: "n", label: "Số đồ vật khác nhau n", min: 1, max: N_MAX, step: 1, digits: 0, onChange: clampK, onCommit: report },
    { type: "slider", key: "k", label: "Số đồ vật lấy ra k", min: 1, max: K_MAX, step: 1, digits: 0, onChange: clampK, onCommit: report },
    { type: "checkbox", key: "ordered", label: "Có kể thứ tự (đổi chỗ là một cách khác)", onCommit: report },
    { type: "checkbox", key: "repeat", label: "Được lặp lại (mỗi đồ vật lấy nhiều lần, mở rộng)", onChange: clampK, onCommit: report },
  ],
  readouts: [
    { label: "Loại", value: s => TYPE_NAMES[typeCode(s)] },
    { label: "Số cách", value: s => big(count(s)) },
  ],
  draw(ctx, s, view) {
    const { n, k, ordered } = settings(s);
    const small = view.w < 520 || view.h < 420;
    const pad = small ? 8 : 16;
    const W = view.w - 2 * pad;
    const total = count(s);
    const totalNum = Number(total);

    // title
    let y = small ? 13 : 20;
    label(ctx, title(s), view.w / 2, y, { size: small ? 14 : 18, align: "center", bold: true });

    // the n objects
    y += small ? 22 : 34;
    const d0 = Math.max(8, Math.min(small ? 18 : 26, W / n - 4));
    const step0 = d0 + 4;
    let x = view.w / 2 - (n * step0 - 4) / 2 + d0 / 2;
    for (let i = 0; i < n; i++, x += step0) drawBall(ctx, i, x, y, d0);
    y += d0 / 2 + (small ? 10 : 14);
    label(
      ctx,
      ordered ? "Mỗi ô: một cách xếp, đọc từ trái sang phải" : "Mỗi ô: một nhóm, không kể thứ tự",
      view.w / 2,
      y,
      { size: small ? 11 : 13, align: "center", color: COLORS.muted }
    );

    // footer: general formula, formula with numbers, how many are shown
    const [general, numbers] = formula(s);
    const fsize = small ? 14 : 20;
    const footer = small ? 46 : 100;
    const top = y + (small ? 10 : 14);
    const bottom = view.h - footer;

    // the arrangements
    const g = gridLayout(W, bottom - top, k, totalNum);
    const list = firstArrangements(s, Math.min(g.cap, SHOW_MAX));
    const cols = Math.min(g.cols, list.length);
    const left = view.w / 2 - (cols * (g.cw + g.gap) - g.gap) / 2;
    const usedH = Math.ceil(list.length / Math.max(1, cols)) * (g.ch + g.gap) - g.gap;
    const gridTop = top + Math.max(0, (bottom - top - usedH) / 2);
    list.forEach((a, idx) => {
      const cx = left + (idx % cols) * (g.cw + g.gap);
      const cy = gridTop + Math.floor(idx / cols) * (g.ch + g.gap);
      roundRect(ctx, cx, cy, g.cw, g.ch, Math.min(10, g.ch / 2));
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = ordered ? "#c9d3e6" : COLORS.purple;
      ctx.lineWidth = 1;
      ctx.setLineDash(ordered ? [] : [3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      a.forEach((i, j) => drawBall(ctx, i, cx + 6 + g.d / 2 + j * (g.d + 3), cy + g.ch / 2, g.d));
    });

    // footer text
    let fy = view.h - footer + (small ? 12 : 22);
    if (!small) {
      drawPieces(ctx, general, view.w / 2, fy, fitSize(ctx, general, fsize - 4, W), COLORS.muted);
      fy += 32;
    }
    drawPieces(ctx, numbers, view.w / 2, fy, fitSize(ctx, numbers, fsize, W), COLORS.blue);
    fy += small ? 22 : 30;
    const rest = total - BigInt(list.length);
    const note = rest > 0n ? `Đã vẽ ${big(list.length)} cách, còn ${big(rest)} cách chưa vẽ` : `Đủ cả ${big(total)} cách trên hình`;
    label(ctx, note, view.w / 2, fy, { size: fitSize(ctx, [note], small ? 11 : 13, W), align: "center", color: rest > 0n ? COLORS.orange : COLORS.green });
  },
});
