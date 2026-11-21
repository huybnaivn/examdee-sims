import { mount, COLORS, label, fmt, clamp } from "../../kit/v1/kit.js";
import { initialState, talet, similar, K_MIN, K_MAX } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SIDE_COLORS = [COLORS.red, COLORS.green, COLORS.orange]; // a = BC, b = CA, c = AB
const STEP = 0.05; // M and N move in twentieths of their side, like the sliders

// ---- text helpers: a row of strings and stacked fractions { num, den } ----
const font = (size, bold) => `${bold ? "600 " : ""}${size}px ${FONT}`;
function itemWidth(ctx, it, size) {
  if (typeof it === "string") {
    ctx.font = font(size);
    return ctx.measureText(it).width;
  }
  ctx.font = font(size * 0.9);
  return Math.max(ctx.measureText(it.num).width, ctx.measureText(it.den).width) + 6;
}
const rowWidth = (ctx, items, size) => items.reduce((w, it) => w + itemWidth(ctx, it, size), 0);
function drawRow(ctx, items, cx, y, size, color = COLORS.ink) {
  let x = cx - rowWidth(ctx, items, size) / 2;
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.textBaseline = "middle";
  for (const it of items) {
    const w = itemWidth(ctx, it, size);
    if (typeof it === "string") {
      ctx.font = font(size);
      ctx.textAlign = "left";
      ctx.fillText(it, x, y);
    } else {
      ctx.font = font(size * 0.9);
      ctx.textAlign = "center";
      ctx.fillText(it.num, x + w / 2, y - size * 0.62);
      ctx.fillText(it.den, x + w / 2, y + size * 0.62);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + w - 1, y);
      ctx.stroke();
    }
    x += w;
  }
  ctx.restore();
}
const fit = (ctx, items, size, w) => {
  while (size > 9 && rowWidth(ctx, items, size) > w) size -= 0.5;
  return size;
};
function tag(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = font(opts.size ?? 13, true);
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.bg;
  ctx.strokeText(text, x, y);
  ctx.restore();
  label(ctx, text, x, y, { align: "center", bold: true, ...opts });
}
const dot = (ctx, [x, y], r, fill, stroke) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
};
const seg = (ctx, p, q, color, width) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(...p);
  ctx.lineTo(...q);
  ctx.stroke();
};
// ">" marks across the middle of a segment, the textbook sign for parallel lines
function chevron(ctx, p, q, color) {
  const [mx, my] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const off of [-4, 4]) {
    const cx = mx + off * Math.cos(a), cy = my + off * Math.sin(a);
    ctx.moveTo(cx - 6 * Math.cos(a - 0.6), cy - 6 * Math.sin(a - 0.6));
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - 6 * Math.cos(a + 0.6), cy - 6 * Math.sin(a + 0.6));
  }
  ctx.stroke();
}
// A length written beside segment pq, on the side away from point `away`.
function sideLabel(ctx, p, q, away, text, color, size, gap = 14) {
  const [mx, my] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  let n = [(q[1] - p[1]) / len, (p[0] - q[0]) / len];
  if (n[0] * (away[0] - mx) + n[1] * (away[1] - my) > 0) n = [-n[0], -n[1]];
  tag(ctx, text, mx + n[0] * gap, my + n[1] * gap, { size, color });
}

// World (cm) to screen for a box of world size bw × bh fitted in a screen rectangle.
const fitBox = (x0, y0, bw, bh, left, top, w, h) => {
  const scale = Math.min(w / bw, h / bh);
  const ox = left + (w - bw * scale) / 2 - x0 * scale;
  const oy = top + (h + bh * scale) / 2 + y0 * scale;
  return { scale, S: p => [ox + p[0] * scale, oy - p[1] * scale], W: p => [(p.x - ox) / scale, (oy - p.y) / scale] };
};

const layout = view => {
  const small = view.w < 520 || view.h < 420;
  const head = small ? 26 : 40;
  const foot = small ? 80 : 118;
  return { small, head, foot, pad: small ? 26 : 40 };
};
const taletGeom = view => {
  const L = layout(view);
  const { A } = talet(initialState());
  return { ...L, ...fitBox(0, 0, 8, A[1], L.pad, L.head + 22, view.w - 2 * L.pad, view.h - L.head - L.foot - 44) };
};

// ---- events ----
function reportTalet(s, api) {
  const r = talet(s);
  api.emit("ratio-measured", { ratio: r.rAB, ratioN: r.rAC, parallel: r.parallel ? 1 : 0 }, "result");
  if (s.converse && r.parallel && s._par === false) api.emit("parallel-restored", { ratio: r.rAB }, "goal");
  s._par = r.parallel;
}
function reportSimilar(s, api) {
  const r = similar(s);
  api.emit("similar-measured", { k: r.k, perimeterRatio: r.perimeterRatio, areaRatio: r.areaRatio }, "result");
}
const snap = v => clamp(Math.round(v / STEP) * STEP, 0, 1);

// ---- drawing ----
function drawTalet(ctx, s, view) {
  const g = taletGeom(view);
  const { small, S } = g;
  const r = talet(s);
  const size = small ? 11 : 14;
  const [A, B, C, M, N] = [r.A, r.B, r.C, r.M, r.N].map(S);
  const ok = r.parallel;
  const lineColor = r.degenerate ? COLORS.muted : ok ? COLORS.green : COLORS.red;

  // title: the theorem in play
  const title = s.converse ? "Định lí Ta-lét đảo" : "Định lí Ta-lét và hệ quả";
  label(ctx, title, view.w / 2, small ? 12 : 18, { size: small ? 14 : 18, align: "center", bold: true });

  ctx.beginPath();
  ctx.moveTo(...A);
  ctx.lineTo(...B);
  ctx.lineTo(...C);
  ctx.closePath();
  ctx.fillStyle = "rgba(47, 111, 237, 0.08)";
  ctx.fill();
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  seg(ctx, B, C, COLORS.ink, 3);
  if (!(r.t === 0 && r.u === 0)) seg(ctx, M, N, lineColor, 3);
  if (ok) {
    chevron(ctx, M, N, COLORS.green);
    chevron(ctx, B, C, COLORS.green);
  }

  // lengths (cm)
  if (r.am > 0) sideLabel(ctx, A, M, C, fmt(r.am), COLORS.orange, size);
  if (r.mb > 0) sideLabel(ctx, M, B, C, fmt(r.mb), COLORS.muted, size);
  if (r.an > 0) sideLabel(ctx, A, N, B, fmt(r.an), COLORS.purple, size);
  if (r.nc > 0) sideLabel(ctx, N, C, B, fmt(r.nc), COLORS.muted, size);
  sideLabel(ctx, B, C, A, `BC = ${fmt(r.bc)}`, COLORS.ink, size, 13);
  if (!r.degenerate) sideLabel(ctx, M, N, B, `MN = ${fmt(r.mn)}`, lineColor, size, 12);

  // points
  const name = (p, text, dx, dy) => tag(ctx, text, p[0] + dx, p[1] + dy, { size: size + 2 });
  name(A, "A", 0, -16);
  name(B, "B", -14, 8);
  name(C, "C", 14, 8);
  const hr = small ? 7 : 9;
  dot(ctx, M, hr, s._drag === "M" ? COLORS.orange : "#fff", COLORS.orange);
  dot(ctx, N, hr, s._drag === "N" ? COLORS.purple : "#fff", COLORS.purple);
  // M, N names sit inside the triangle, below the segment; at a vertex they join that vertex's name
  const mName = r.t === 0 ? null : r.t === 1 ? "M ≡ B" : "M";
  const nName = r.u === 0 ? null : r.u === 1 ? "N ≡ C" : "N";
  if (r.t === 0 && r.u === 0) name(A, "A ≡ M ≡ N", 0, -16);
  else {
    if (r.t === 0) name(A, "A ≡ M", 0, -16);
    if (r.u === 0) name(A, "A ≡ N", 0, -16);
  }
  if (mName) name(M, mName, r.t === 1 ? -6 : -18, r.t === 1 ? 26 : -2);
  if (nName) name(N, nName, r.u === 1 ? 6 : 18, r.u === 1 ? 26 : -2);

  // ratios
  let y = view.h - g.foot + (small ? 14 : 22);
  const W = view.w - 16;
  const val = (num, den, v) => (small ? [{ num, den }, ` = ${fmt(v)}`] : [{ num, den }, " = ", { num: fmt(num === "MN" ? r.mn : num === "AM" ? r.am : r.an), den: fmt(den === "BC" ? r.bc : den === "AB" ? r.ab : r.ac) }, ` = ${fmt(v)}`]);
  const row1 = [...val("AM", "AB", r.rAB), "     ", ...val("AN", "AC", r.rAC), "     ", ...val("MN", "BC", r.rBC)];
  drawRow(ctx, row1, view.w / 2, y, fit(ctx, row1, size + 1, W));
  if (!small) {
    y += 42;
    const q = (num, den, a, b, v) => [{ num, den }, " = ", { num: fmt(a), den: fmt(b) }, ` = ${Number.isFinite(v) ? fmt(v) : "–"}`];
    const row2 = [...q("AM", "MB", r.am, r.mb, r.rMB), "     ", ...q("AN", "NC", r.an, r.nc, r.rNC)];
    drawRow(ctx, row2, view.w / 2, y, fit(ctx, row2, size, W), COLORS.muted);
  }

  // what the figure says
  let text;
  let color = COLORS.ink;
  if (r.t === 0 && r.u === 0) [text, color] = ["M, N trùng A: MN thu về một điểm", COLORS.muted];
  else if (r.t === 1 && r.u === 1) [text, color] = ["M ≡ B, N ≡ C: MN chính là BC (trùng, không song song)", COLORS.muted];
  else if (r.degenerate) [text, color] = ["M hoặc N trùng một đỉnh: MN không cắt cả hai cạnh", COLORS.muted];
  else if (!s.converse) [text, color] = ["MN // BC ⇒ AM/AB = AN/AC = MN/BC", COLORS.green];
  else if (ok) [text, color] = ["AM/AB = AN/AC ⇒ MN // BC (định lí Ta-lét đảo)", COLORS.green];
  else [text, color] = ["AM/AB ≠ AN/AC ⇒ MN không song song với BC", COLORS.red];
  const ty = view.h - (small ? 10 : 16);
  tag(ctx, text, view.w / 2, ty, { size: fit(ctx, [text], small ? 12 : 14, W), color });
  if (!small) label(ctx, "Độ dài tính bằng cm", 10, ty - 26, { size: 11, color: COLORS.muted });
}

function drawSimilar(ctx, s, view) {
  const L = layout(view);
  const { small } = L;
  const r = similar(s);
  const size = small ? 11 : 13;
  const xs = [...r.P, ...r.Q].map(p => p[0]);
  const ys = [...r.P, ...r.Q].map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys);
  const g = fitBox(x0, 0, x1 - x0, y1, L.pad, L.head + 24, view.w - 2 * L.pad, view.h - L.head - L.foot - 46);
  const tri = (pts, names, primed) => {
    const P = pts.map(g.S);
    ctx.beginPath();
    ctx.moveTo(...P[0]);
    ctx.lineTo(...P[1]);
    ctx.lineTo(...P[2]);
    ctx.closePath();
    ctx.fillStyle = primed ? "rgba(122, 90, 248, 0.08)" : "rgba(47, 111, 237, 0.08)";
    ctx.fill();
    const m = primed ? r.m2 : r.m;
    const shortest = Math.min(...m.sides) * g.scale;
    // equal angles carry the same number of arcs: one at A, two at B, three at C
    for (let i = 0; i < 3; i++) {
      const p = P[i], q = P[(i + 1) % 3], w = P[(i + 2) % 3];
      const a1 = Math.atan2(q[1] - p[1], q[0] - p[0]);
      let diff = Math.atan2(w[1] - p[1], w[0] - p[0]) - a1;
      diff -= 2 * Math.PI * Math.round(diff / (2 * Math.PI));
      const rad = clamp(shortest * 0.22, 8, 20);
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.2;
      for (let j = 0; j <= i; j++) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], rad + j * 3.5, a1, a1 + diff, diff < 0);
        ctx.stroke();
      }
      if (shortest > (small ? 70 : 90)) {
        const bis = a1 + diff / 2;
        const d = rad + 10 + 3.5 * i + 12;
        tag(ctx, `${fmt(m.angles[i], 1)}°`, p[0] + d * Math.cos(bis), p[1] + d * Math.sin(bis), { size: size - 1, color: COLORS.ink });
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = P[(i + 1) % 3], q = P[(i + 2) % 3];
      seg(ctx, p, q, SIDE_COLORS[i], 3);
      sideLabel(ctx, p, q, P[i], fmt(m.sides[i]), SIDE_COLORS[i], size);
    }
    const c = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3];
    P.forEach((p, i) => {
      const d = Math.hypot(p[0] - c[0], p[1] - c[1]) || 1;
      tag(ctx, names[i], p[0] + ((p[0] - c[0]) / d) * 16, p[1] + ((p[1] - c[1]) / d) * 16, { size: size + 2 });
    });
  };
  tri(r.P, ["A", "B", "C"], false);
  tri(r.Q, ["A'", "B'", "C'"], true);

  const W = view.w - 16;
  const head = `ΔA'B'C' ∽ ΔABC theo tỉ số k = ${fmt(r.k)}`;
  label(ctx, head, view.w / 2, small ? 12 : 18, { size: fit(ctx, [head], small ? 14 : 18, W), align: "center", bold: true });

  let y = view.h - L.foot + (small ? 14 : 22);
  const sides = [
    { num: "A'B'", den: "AB" }, " = ", { num: "B'C'", den: "BC" }, " = ", { num: "C'A'", den: "CA" },
    ` = ${fmt(r.sideRatios[0])}`,
      ];
  drawRow(ctx, sides, view.w / 2, y, fit(ctx, sides, size + 1, W));
  y += small ? 32 : 42;
  const ratios = [
    "Chu vi: ", { num: "P'", den: "P" }, ` = ${fmt(r.m2.perimeter)} : ${fmt(r.m.perimeter)} = ${fmt(r.perimeterRatio)} = k`,
    "     Diện tích: ", { num: "S'", den: "S" }, ` = ${fmt(r.areaRatio, 4)} = k²`,
  ];
  drawRow(ctx, ratios, view.w / 2, y, fit(ctx, ratios, size + 1, W));
  if (small) tag(ctx, "Góc tương ứng bằng nhau (cùng số cung)", view.w / 2, view.h - 9, { size: 10, color: COLORS.muted });
  else label(ctx, "Độ dài tính bằng cm. Các góc tương ứng bằng nhau (đánh cùng số cung)", view.w / 2, view.h - 14, { size: 12, align: "center", color: COLORS.muted });
}

mount({
  slug: "dinh-ly-talet",
  version: "1.0.0",
  title: "Định lí Ta-lét và tam giác đồng dạng",
  hint: "Kéo điểm M trên cạnh AB: N chạy theo trên AC sao cho MN // BC. Bật định lí đảo để kéo N tự do. Chế độ thứ hai so sánh hai tam giác đồng dạng theo tỉ số k.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Nội dung",
      options: [
        { value: "talet", label: "Định lí Ta-lét" },
        { value: "similar", label: "Tam giác đồng dạng" },
      ],
    },
    {
      type: "slider", key: "t", label: "Vị trí M: tỉ số AM/AB", min: 0, max: 1, step: STEP, digits: 2,
      visible: s => s.mode === "talet",
      onChange: s => { if (!s.converse) s.u = s.t; },
      onCommit: reportTalet,
    },
    {
      type: "checkbox", key: "converse", label: "Định lí đảo: thả N tự do trên AC",
      visible: s => s.mode === "talet",
      onChange: s => {
        s.u = s.t;
        s._par = talet(s).parallel;
      },
    },
    {
      type: "slider", key: "u", label: "Vị trí N: tỉ số AN/AC", min: 0, max: 1, step: STEP, digits: 2,
      visible: s => s.mode === "talet" && s.converse,
      onCommit: reportTalet,
    },
    {
      type: "slider", key: "k", label: "Tỉ số đồng dạng k", min: K_MIN, max: K_MAX, step: 0.1, digits: 1,
      visible: s => s.mode === "similar",
      onCommit: reportSimilar,
    },
  ],
  readouts: [
    {
      label: "Kết quả",
      value: s => {
        if (s.mode === "similar") {
          const r = similar(s);
          return `k = ${fmt(r.k)}; S'/S = ${fmt(r.areaRatio, 4)}`;
        }
        const r = talet(s);
        return `${fmt(r.rAB)} · ${fmt(r.rAC)} · ${fmt(r.rBC)}${r.parallel ? " (MN // BC)" : ""}`;
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      if (s.mode !== "talet") return false;
      const g = taletGeom(view);
      const r = talet(s);
      const dM = Math.hypot(p.x - g.S(r.M)[0], p.y - g.S(r.M)[1]);
      const dN = Math.hypot(p.x - g.S(r.N)[0], p.y - g.S(r.N)[1]);
      if (Math.min(dM, dN) > 28) return false;
      s._drag = dM <= dN ? "M" : "N"; // M first when they overlap at A
    },
    move(p, s, api, view) {
      const g = taletGeom(view);
      const { A, B, C } = talet(s);
      const [x, y] = g.W(p);
      const along = (P, Q) => ((x - P[0]) * (Q[0] - P[0]) + (y - P[1]) * (Q[1] - P[1])) / ((Q[0] - P[0]) ** 2 + (Q[1] - P[1]) ** 2);
      if (s._drag === "M") {
        s.t = snap(along(A, B));
        if (!s.converse) s.u = s.t;
      } else if (s._drag === "N") {
        const u = snap(along(A, C));
        if (s.converse) s.u = u;
        else s.t = s.u = u; // N locked to M: moving N moves M
      }
    },
    up(p, s, api) {
      if (!s._drag) return;
      s._drag = undefined;
      reportTalet(s, api);
    },
  },
  draw(ctx, s, view) {
    if (s.mode === "similar") drawSimilar(ctx, s, view);
    else drawTalet(ctx, s, view);
  },
});
