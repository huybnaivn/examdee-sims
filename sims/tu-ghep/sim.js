import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, solve, count, reached, TARGETS } from "./model.js";

const SUB = ["₁", "₂", "₃"];
const MIN_NET = 90; // px, least height of the circuit before the table has to give way

// One result per finished change; a goal the first time the requested capacitance is built.
function report(s, api) {
  const c = solve(s);
  api.emit("bank-charged", { capacitance: c.ceq, charge: c.q, energy: c.energy, voltage: s.voltage, capacitors: c.items.length }, "result");
  if (reached(s)) {
    if (s._hit !== s.target) api.emit("target-built", { target: s.target, capacitance: c.ceq }, "goal");
    s._hit = s.target;
  } else {
    s._hit = 0;
  }
}

// Network as a tree of series ("s") and parallel ("p") groups of capacitor indices.
function tree(s) {
  const caps = [0, 1, 2].slice(0, count(s));
  if (s.arrangement === "parallel") return { t: "p", kids: caps };
  if (s.arrangement === "mixed-a") return { t: "s", kids: [0, { t: "p", kids: [1, 2] }] };
  if (s.arrangement === "mixed-b") return { t: "p", kids: [{ t: "s", kids: [0, 1] }, 2] };
  return { t: "s", kids: caps };
}

const CAP_W = 84;
const CAP_H = 66;
const BUS = 18;
function size(node) {
  if (typeof node === "number") return { w: CAP_W, h: CAP_H };
  const ks = node.kids.map(size);
  return node.t === "s"
    ? { w: ks.reduce((a, k) => a + k.w, 0), h: Math.max(...ks.map(k => k.h)) }
    : { w: Math.max(...ks.map(k => k.w)) + 2 * BUS, h: ks.reduce((a, k) => a + k.h, 0) };
}

function wire(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.stroke();
}
const dot = (ctx, x, y) => {
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
};

// Draw `node` from (x, y) to (x + w·k, y), k the scale. Returns nothing; uses ctx state for wires.
function drawNode(ctx, node, x, y, k, info) {
  const { w } = size(node);
  if (typeof node === "number") {
    const it = info.items[node];
    const cx = x + (w * k) / 2;
    const gap = 7 * k;
    const ph = 22 * k; // half plate height
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    wire(ctx, [[x, y], [cx - gap, y]]);
    wire(ctx, [[cx + gap, y], [x + w * k, y]]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.red;
    wire(ctx, [[cx - gap, y - ph], [cx - gap, y + ph]]);
    ctx.strokeStyle = COLORS.blue;
    wire(ctx, [[cx + gap, y - ph], [cx + gap, y + ph]]);
    // charge marks: count grows with the charge on the plate (left plate faces the + pole)
    const marks = it.q > 0 ? Math.max(1, Math.round((5 * it.q) / info.qMax)) : 0;
    const fs = Math.max(9, 11 * k);
    for (let m = 0; m < marks; m++) {
      const my = y - ph + ((m + 0.5) * 2 * ph) / 5;
      label(ctx, "+", cx - gap - 7 * k, my, { size: fs, align: "center", color: COLORS.red, bold: true });
      label(ctx, "−", cx + gap + 7 * k, my, { size: fs, align: "center", color: COLORS.blue, bold: true });
    }
    label(ctx, `C${SUB[node]}`, cx, y - ph - 9 * k, { size: Math.max(11, 14 * k), align: "center", bold: true });
    if (info.showValues) label(ctx, `${fmt(it.c, 1)} µF`, cx, y + ph + 9 * k, { size: Math.max(10, 12 * k), align: "center", color: COLORS.muted });
    return;
  }
  const ks = node.kids.map(size);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  if (node.t === "s") {
    let cx = x;
    node.kids.forEach((kid, i) => {
      drawNode(ctx, kid, cx, y, k, info);
      cx += ks[i].w * k;
    });
    return;
  }
  const h = ks.reduce((a, kk) => a + kk.h, 0);
  let top = y - (h * k) / 2;
  const ys = [];
  const x1 = x + w * k;
  node.kids.forEach((kid, i) => {
    const cy = top + (ks[i].h * k) / 2;
    ys.push(cy);
    const kx = x + ((w - ks[i].w) * k) / 2;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    wire(ctx, [[x, cy], [kx, cy]]);
    wire(ctx, [[kx + ks[i].w * k, cy], [x1, cy]]);
    drawNode(ctx, kid, kx, cy, k, info);
    top += ks[i].h * k;
  });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  wire(ctx, [[x, ys[0]], [x, ys.at(-1)]]);
  wire(ctx, [[x1, ys[0]], [x1, ys.at(-1)]]);
  for (const yy of [ys[0], ys.at(-1)]) {
    dot(ctx, x, yy);
    dot(ctx, x1, yy);
  }
}

function rules(s) {
  const n = count(s);
  const all = (f, j) => [0, 1, 2].slice(0, n).map(f).join(j);
  if (s.arrangement === "parallel") return ["Ghép song song", `Cb = ${all(i => `C${SUB[i]}`, " + ")};  U = ${all(i => `U${SUB[i]}`, " = ")}`];
  if (s.arrangement === "mixed-a") return ["C₁ nt (C₂ // C₃)", "C₂₃ = C₂ + C₃;  1/Cb = 1/C₁ + 1/C₂₃"];
  if (s.arrangement === "mixed-b") return ["(C₁ nt C₂) // C₃", "1/C₁₂ = 1/C₁ + 1/C₂;  Cb = C₁₂ + C₃"];
  return ["Ghép nối tiếp", `1/Cb = ${all(i => `1/C${SUB[i]}`, " + ")};  Q = ${all(i => `Q${SUB[i]}`, " = ")}`];
}

function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const n = count(s);
  const rowH = small ? 20 : 28;
  const top = small ? 40 : 76;
  const gap = small ? 6 : 20;
  const net = size(tree(s));
  const side = 28; // wire from the bank to the side of the loop
  const below = 72; // bottom wire with the source under the bank
  // the circuit gets at least 0,8 of its natural size; the table keeps only the rows that still fit
  const minNet = Math.max(MIN_NET, 0.8 * (net.h + below));
  const rows = Math.min(5, Math.floor((view.h - top - gap - minNet) / rowH));
  const tw = Math.min(view.w - 16, 620);
  const table = rows >= 3 ? { x: (view.w - tw) / 2, y: view.h - rowH * rows - gap, w: tw, rowH, rows } : null;
  const floor = table ? table.y - 8 : view.h - 6;
  const k = Math.min(2, (view.w - 24) / (net.w + 2 * side), (floor - top) / (net.h + below));
  const bankW = net.w * k;
  const x0 = (view.w - bankW) / 2;
  const totalH = (net.h + below) * k;
  const yNet = top + Math.max(0, floor - top - totalH) / 2 + (net.h * k) / 2;
  return { small, n, table, k, x0, x1: x0 + bankW, yNet, yBot: yNet + (net.h / 2 + below * 0.55) * k, side: side * k };
}

function drawTable(ctx, s, g, c) {
  if (!g.table) return;
  const { x, y, w, rowH } = g.table;
  const size = g.small ? 12 : 14;
  const first = g.small ? 56 : 190;
  const cw = (w - first) / (g.n + 1);
  const rows = [
    ["", ...c.items.map((_, k) => `C${SUB[k]}`), "Bộ tụ"],
    [g.small ? "C (µF)" : "Điện dung (µF)", ...c.items.map(it => fmt(it.c, 2)), fmt(c.ceq, 3)],
    [g.small ? "Q (µC)" : "Điện tích (µC)", ...c.items.map(it => fmt(it.q, 2)), fmt(c.q, 2)],
    [g.small ? "U (V)" : "Hiệu điện thế (V)", ...c.items.map(it => fmt(it.u, 2)), fmt(s.voltage, 2)],
    [g.small ? "W (µJ)" : "Năng lượng (µJ)", ...c.items.map(it => fmt(it.w, 1)), fmt(c.energy, 1)],
  ].slice(0, g.table.rows);
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, rowH * rows.length);
  ctx.fillStyle = COLORS.grid;
  ctx.fillRect(x, y, w, rowH);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, rowH * rows.length);
  rows.forEach((row, r) => {
    const cy = y + rowH * (r + 0.5);
    if (r > 1) {
      ctx.beginPath();
      ctx.moveTo(x, y + rowH * r);
      ctx.lineTo(x + w, y + rowH * r);
      ctx.stroke();
    }
    row.forEach((text, col) => {
      if (col === 0) return label(ctx, text, x + 8, cy, { size, color: COLORS.muted });
      label(ctx, text, x + first + cw * (col - 0.5), cy, { size, align: "center", bold: r === 0 || col === g.n + 1, color: col === g.n + 1 ? COLORS.blue : COLORS.ink });
    });
  });
}

mount({
  slug: "tu-ghep",
  version: "1.0.0",
  title: "Ghép tụ điện nối tiếp và song song",
  hint: "Chọn cách ghép và điện dung từng tụ. Thử ghép bộ tụ có điện dung theo mục tiêu.",
  initialState,
  controls: [
    {
      type: "select",
      key: "arrangement",
      label: "Cách ghép",
      options: [
        { value: "series", label: "Nối tiếp" },
        { value: "parallel", label: "Song song" },
        { value: "mixed-a", label: "Hỗn hợp: C₁ nt (C₂ // C₃)" },
        { value: "mixed-b", label: "Hỗn hợp: (C₁ nt C₂) // C₃" },
      ],
    },
    { type: "checkbox", key: "useC3", label: "Ghép thêm tụ C₃", visible: s => s.arrangement === "series" || s.arrangement === "parallel" },
    { type: "slider", key: "voltage", label: "Hiệu điện thế nguồn U", min: 0, max: 24, step: 1, unit: "V", digits: 0 },
    { type: "slider", key: "c1", label: "Điện dung C₁", min: 1, max: 12, step: 1, unit: "µF", digits: 0 },
    { type: "slider", key: "c2", label: "Điện dung C₂", min: 1, max: 12, step: 1, unit: "µF", digits: 0 },
    { type: "slider", key: "c3", label: "Điện dung C₃", min: 1, max: 12, step: 1, unit: "µF", digits: 0, visible: s => count(s) === 3 },
    {
      type: "select",
      key: "target",
      label: "Thử thách: ghép bộ tụ có điện dung",
      options: TARGETS.map(t => ({ value: t, label: t ? `Cb = ${fmt(t, 2)} µF` : "Không đặt mục tiêu" })),
    },
  ].map(c => ({ ...c, onCommit: report })),
  readouts: [
    { label: "Điện dung của bộ tụ Cb", value: s => `${fmt(solve(s).ceq, 3)} µF` },
    { label: "Điện tích của bộ tụ Q", value: s => `${fmt(solve(s).q, 2)} µC` },
    { label: "Năng lượng của bộ tụ W", value: s => `${fmt(solve(s).energy, 1)} µJ` },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const c = solve(s);
    const info = { items: c.items, qMax: Math.max(...c.items.map(it => it.q), 1e-12), showValues: !g.table || !g.small };
    const [name, rule] = rules(s);

    // header: rule, and the challenge if one is set
    if (g.small) {
      label(ctx, `${name}: ${rule}`, view.w / 2, 11, { align: "center", size: 11, bold: true });
    } else {
      label(ctx, name, view.w / 2, 22, { align: "center", size: 17, bold: true });
      label(ctx, rule, view.w / 2, 46, { align: "center", size: 14, color: COLORS.muted });
    }
    if (s.target > 0) {
      const ok = reached(s);
      const text = ok ? `Đạt mục tiêu Cb = ${fmt(s.target, 2)} µF ✓` : `Mục tiêu: Cb = ${fmt(s.target, 2)} µF (hiện ${fmt(c.ceq, 3)} µF)`;
      label(ctx, text, view.w / 2, g.small ? 28 : 66, { align: "center", size: g.small ? 11 : 13, bold: true, color: ok ? COLORS.green : COLORS.orange });
    }

    // loop: bank on top, source on the bottom wire
    const { x0, x1, yNet, yBot, side, k } = g;
    const xl = x0 - side;
    const xr = x1 + side;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    wire(ctx, [[x0, yNet], [xl, yNet], [xl, yBot], [xr, yBot], [xr, yNet], [x1, yNet]]);
    drawNode(ctx, tree(s), x0, yNet, k, info);

    // source: long thin plate (+) on the left, short thick plate (−) on the right
    const mx = (xl + xr) / 2;
    const bh = Math.max(10, 14 * k);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(mx - 8, yBot - 3, 16, 6);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    wire(ctx, [[mx - 5, yBot - bh], [mx - 5, yBot + bh]]);
    ctx.lineWidth = 5;
    wire(ctx, [[mx + 5, yBot - bh * 0.55], [mx + 5, yBot + bh * 0.55]]);
    const fs = g.small ? 12 : 14;
    label(ctx, "+", mx - 14, yBot - bh, { color: COLORS.red, bold: true, size: fs, align: "center" });
    label(ctx, "−", mx + 14, yBot - bh, { color: COLORS.blue, bold: true, size: fs, align: "center" });
    label(ctx, `U = ${fmt(s.voltage)} V`, mx, yBot + bh + 9, { bold: true, size: fs, align: "center" });

    drawTable(ctx, s, g, c);
  },
});
