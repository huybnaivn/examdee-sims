import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { SCENARIOS, N, initialState, tree, counts } from "./model.js";

const NB = "B̄"; // B̄
const NA = "Ā"; // Ā
const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
// one colour per leaf, shared by the tree and the grid
const LEAF = {
  BA: COLORS.red,
  BNA: "#f4b4b6",
  NBA: COLORS.orange,
  NBNA: "#c9d3e6",
};
const p = v => fmt(v, 4);
const lc = t => t[0].toLowerCase() + t.slice(1); // "Chọn hộp I" → "chọn hộp I"

const report = (s, api) => {
  const t = tree(s);
  api.emit(
    "probabilities-set",
    { pB: t.pB, pAgivenB: t.pAB, pAgivenNotB: t.pANB, pA: t.pA, ...(t.pA > 0 && { pBgivenA: t.pBA }) },
    "result"
  );
};

// Draw text, shrinking the font until it fits in maxW.
function fit(ctx, text, x, y, maxW, { size = 14, min = 9, ...rest } = {}) {
  let k = size;
  for (; k > min; k--) {
    ctx.font = `${rest.bold ? "600 " : ""}${k}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  label(ctx, text, x, y, { size: k, ...rest });
}

function geom(s, view) {
  const small = view.w < 560 || view.h < 430;
  const both = s.view === "both" && view.w >= 640 && view.h >= 330;
  const pad = small ? 8 : 16;
  const top = small ? 34 : 48;
  const showTree = s.view !== "grid";
  const showGrid = s.view === "grid" || both;
  const treeW = showGrid && showTree ? Math.round(view.w * 0.56) : view.w;
  const formulaH = small ? 92 : 140;
  return {
    small,
    pad,
    top,
    tree: showTree ? { x: pad, y: top, w: treeW - 2 * pad, h: Math.max(110, view.h - top - formulaH - pad) } : null,
    formulas: showTree ? { x: pad, y: view.h - formulaH, w: treeW - 2 * pad, h: formulaH - pad } : null,
    grid: showGrid ? { x: (showTree ? treeW : 0) + pad, y: top, w: view.w - (showTree ? treeW : 0) - 2 * pad, h: view.h - top - pad } : null,
  };
}

function drawTree(ctx, s, R, small) {
  const sc = SCENARIOS[s.scenario];
  const t = tree(s);
  const x0 = R.x + 6;
  const x1 = R.x + R.w * 0.3;
  const x2 = R.x + R.w * 0.6;
  const ys = [1, 3, 5, 7].map(k => R.y + (R.h * k) / 8);
  const yB = (ys[0] + ys[1]) / 2;
  const yNB = (ys[2] + ys[3]) / 2;
  const y0 = (yB + yNB) / 2;
  const size = small ? 11 : 13;

  const edge = (ax, ay, bx, by, prob, text, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 + 5 * prob;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    ctx.font = `600 ${size}px ${FONT}`;
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(mx - w / 2, my - size * 0.75, w, size * 1.5, 5);
    ctx.fill();
    label(ctx, text, mx, my, { size, align: "center", bold: true, color: COLORS.ink });
  };
  const dot = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  };

  const branch = small ? (a, b) => fmt(b, 2) : (a, b) => `${a} = ${fmt(b, 2)}`;
  edge(x0, y0, x1, yB, t.pB, branch("P(B)", t.pB), COLORS.ink);
  edge(x0, y0, x1, yNB, t.pNB, branch(`P(${NB})`, t.pNB), COLORS.ink);
  edge(x1, yB, x2, ys[0], t.pAB, branch("P(A|B)", t.pAB), COLORS.red);
  edge(x1, yB, x2, ys[1], t.pNAB, branch(`P(${NA}|B)`, t.pNAB), COLORS.muted);
  edge(x1, yNB, x2, ys[2], t.pANB, branch(`P(A|${NB})`, t.pANB), COLORS.orange);
  edge(x1, yNB, x2, ys[3], t.pNANB, branch(`P(${NA}|${NB})`, t.pNANB), COLORS.muted);
  dot(x0, y0, COLORS.ink);
  dot(x1, yB, COLORS.ink);
  dot(x1, yNB, COLORS.ink);
  // first-stage names above B, below B̄
  // above-left of B and below-left of B̄: the only corners no edge passes through
  fit(ctx, `B: ${sc.B}`, x1 + 4, yB - (small ? 14 : 18), x1 - R.x - 4, { size, align: "right", bold: true });
  fit(ctx, `${NB}: ${sc.NB}`, x1 + 4, yNB + (small ? 14 : 18), x1 - R.x - 4, { size, align: "right", bold: true });

  const leaves = [
    ["BA", `A: ${sc.A}`, "P(B∩A)", t.joint.BA],
    ["BNA", `${NA}: ${sc.NA}`, `P(B∩${NA})`, t.joint.BNA],
    ["NBA", `A: ${sc.A}`, `P(${NB}∩A)`, t.joint.NBA],
    ["NBNA", `${NA}: ${sc.NA}`, `P(${NB}∩${NA})`, t.joint.NBNA],
  ];
  const textW = R.x + R.w - x2 - 22;
  leaves.forEach(([key, name, sym, value], i) => {
    const y = ys[i];
    ctx.fillStyle = LEAF[key];
    ctx.fillRect(x2 + 2, y - 7, 14, 14);
    const isA = key === "BA" || key === "NBA";
    fit(ctx, name, x2 + 22, y - size * 0.7, textW, { size, color: isA ? COLORS.ink : COLORS.muted, bold: isA });
    fit(ctx, `${sym} = ${p(value)}`, x2 + 22, y + size * 0.7, textW, { size, color: isA ? COLORS.ink : COLORS.muted });
  });
}

function drawFormulas(ctx, s, R, small) {
  const t = tree(s);
  const size = small ? 12 : 14;
  const lh = small ? 15 : 19;
  const pA = p(t.pA);
  const lines = [
    [`Xác suất toàn phần: P(A) = P(B)·P(A|B) + P(${NB})·P(A|${NB})`, COLORS.muted],
    [`P(A) = ${fmt(t.pB, 2)}·${fmt(t.pAB, 2)} + ${fmt(t.pNB, 2)}·${fmt(t.pANB, 2)} = ${pA}`, COLORS.ink, true],
    [`Công thức Bay-ét: P(B|A) = P(B)·P(A|B) / P(A)`, COLORS.muted],
    [
      t.pA > 0 ? `P(B|A) = ${p(t.joint.BA)} / ${pA} ≈ ${p(t.pBA)}` : "P(A) = 0 nên P(B|A) không xác định",
      COLORS.red,
      true,
    ],
    [
      t.independent
        ? `P(A|B) = P(A|${NB}) = P(A): A và B độc lập`
        : `P(A|B) ≠ P(A|${NB}): A và B không độc lập`,
      t.independent ? COLORS.green : COLORS.muted,
    ],
  ];
  if (small) lines.splice(2, 1); // keep the numbers, drop the generic Bayes line
  if (small) lines[0][0] = `P(A) = P(B)·P(A|B) + P(${NB})·P(A|${NB})`;
  lines.forEach(([text, color, bold], i) =>
    fit(ctx, text, R.x, R.y + lh * (i + 0.5), R.w, { size, color, bold })
  );
}

function drawGrid(ctx, s, R, small) {
  const sc = SCENARIOS[s.scenario];
  const c = counts(s);
  const size = small ? 11 : 13;
  const lh = small ? 15 : 18;
  const legendH = 4 * lh + 2.4 * lh + 8;
  fit(ctx, `${N} ${sc.unit} (mỗi ô là một ${sc.unit === "lần" ? "lần thử" : sc.unit})`, R.x, R.y - lh * 0.4, R.w, { size, bold: true });
  const wide = R.w >= R.h - legendH;
  const cols = wide ? 40 : 25;
  const rows = N / cols;
  const cell = Math.max(2, Math.min(R.w / cols, (R.h - legendH - lh * 0.4) / rows));
  const gx = R.x;
  const gy = R.y + lh * 0.5;
  const order = [
    ["BA", c.BA],
    ["BNA", c.BNA],
    ["NBA", c.NBA],
    ["NBNA", c.NBNA],
  ];
  let i = 0;
  for (const [key, n] of order) {
    ctx.fillStyle = LEAF[key];
    for (let k = 0; k < n; k++, i++) {
      // groups fill along the long side, so each forms a band
      const col = wide ? Math.floor(i / rows) : i % cols;
      const row = wide ? i % rows : Math.floor(i / cols);
      ctx.fillRect(gx + col * cell + 0.5, gy + row * cell + 0.5, cell - 1, cell - 1);
    }
  }
  let y = gy + rows * cell + lh * 0.9;
  const names = { BA: [sc.B, sc.A], BNA: [sc.B, sc.NA], NBA: [sc.NB, sc.A], NBNA: [sc.NB, sc.NA] };
  for (const [key, n] of order) {
    ctx.fillStyle = LEAF[key];
    ctx.fillRect(R.x, y - 6, 12, 12);
    fit(ctx, `${names[key][0]}, ${lc(names[key][1])}: ${n}`, R.x + 18, y, R.w - 18, { size });
    y += lh;
  }
  y += lh * 0.3;
  const text =
    c.A > 0
      ? [`Trong ${c.A} trường hợp "${lc(sc.A)}" có ${c.BA} trường hợp "${lc(sc.B)}"`, `P(B|A) ≈ ${c.BA}/${c.A} ≈ ${p(c.BA / c.A)}`]
      : [`Không có trường hợp "${lc(sc.A)}" nào`, "P(B|A) không xác định"];
  fit(ctx, text[0], R.x, y, R.w, { size });
  fit(ctx, text[1], R.x, y + lh, R.w, { size, bold: true, color: COLORS.red });
}

mount({
  slug: "xac-suat-co-dieu-kien",
  version: "1.0.0",
  title: "Xác suất có điều kiện và công thức Bay-ét",
  hint: "Đổi xác suất trên các nhánh của sơ đồ cây, rồi so sánh P(B|A) tính theo công thức Bay-ét với cách đếm trên lưới 1000 trường hợp.",
  initialState,
  controls: [
    {
      type: "select",
      key: "scenario",
      label: "Tình huống",
      options: [
        { value: "benh", label: "Xét nghiệm bệnh" },
        { value: "hop", label: "Chọn hộp rồi lấy bi" },
        { value: "may", label: "Sản phẩm của hai máy" },
      ],
      onChange(s) {
        Object.assign(s, SCENARIOS[s.scenario].preset);
      },
      onCommit: report,
    },
    { type: "heading", label: "Xác suất trên các nhánh" },
    { type: "slider", key: "pB", label: "P(B)", min: 0, max: 1, step: 0.01, digits: 2, onCommit: report },
    { type: "slider", key: "pAB", label: "P(A | B)", min: 0, max: 1, step: 0.01, digits: 2, onCommit: report },
    { type: "slider", key: "pANB", label: `P(A | ${NB})`, min: 0, max: 1, step: 0.01, digits: 2, onCommit: report },
    {
      type: "select",
      key: "view",
      label: "Hiển thị",
      options: [
        { value: "both", label: "Sơ đồ cây và lưới 1000 trường hợp" },
        { value: "tree", label: "Sơ đồ cây và công thức" },
        { value: "grid", label: "Lưới 1000 trường hợp" },
      ],
    },
  ],
  readouts: [
    { label: "P(A) (xác suất toàn phần)", value: s => p(tree(s).pA) },
    { label: "P(B|A) (Bay-ét)", value: s => (tree(s).pA > 0 ? p(tree(s).pBA) : "không xác định") },
    { label: `P(${NB}|A)`, value: s => (tree(s).pA > 0 ? p(tree(s).pNBA) : "không xác định") },
    { label: "A và B", value: s => (tree(s).independent ? "độc lập" : "không độc lập") },
  ],
  draw(ctx, s, view) {
    const g = geom(s, view);
    const sc = SCENARIOS[s.scenario];
    fit(ctx, `${sc.trial}. B: ${lc(sc.B)}; A: ${lc(sc.A)}.`, g.pad, g.small ? 13 : 20, view.w - 2 * g.pad, {
      size: g.small ? 12 : 15,
      bold: true,
    });
    if (g.tree) drawTree(ctx, s, g.tree, g.small);
    if (g.formulas) drawFormulas(ctx, s, g.formulas, g.small);
    if (g.grid) drawGrid(ctx, s, g.grid, g.small);
    if (!g.small && g.tree) label(ctx, "Độ dày nhánh tỉ lệ với xác suất", g.pad, g.top + 4, { size: 11, color: COLORS.muted });
  },
});
