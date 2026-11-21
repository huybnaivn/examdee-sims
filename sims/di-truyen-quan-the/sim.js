import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, history, current, alleleA, hardyWeinberg, fixation, reseed, generationOf, settings, GEN_MAX, SIZES } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const GEN_PER_SECOND = 5;
const COL = { A: COLORS.blue, a: COLORS.orange, AA: COLORS.blue, Aa: COLORS.purple, aa: COLORS.orange };

function fitLabel(ctx, text, x, y, maxW, opts) {
  let size = opts.size;
  for (; size > 8; size--) {
    ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  label(ctx, text, x, y, { ...opts, size });
}

const restart = s => {
  s.generation = 0;
  s._acc = 0;
};

// One more generation, with its events: a report every 10 generations, a goal when an allele is fixed or lost.
function advance(s, api) {
  if (generationOf(s) >= GEN_MAX) return api.pause();
  const before = fixation(current(s));
  s.generation = generationOf(s) + 1;
  const f = current(s);
  if (s.generation % 10 === 0) {
    api.emit("generation-report", { generation: s.generation, p: alleleA(f), AA: f[0], Aa: f[1], aa: f[2] }, "result");
  }
  const now = fixation(f);
  if (now && now !== before) api.emit("allele-fixed", { generation: s.generation, p: alleleA(f) }, "goal");
  if (s.generation >= GEN_MAX) api.pause();
}

/** 100 individuals in proportion to the genotype frequencies (largest remainder). */
function hundred(f) {
  const raw = f.map(x => x * 100);
  const n = raw.map(Math.floor);
  const order = raw.map((x, i) => [x - n[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; n[0] + n[1] + n[2] < 100; k++) n[order[k][1]]++;
  return n;
}

function drawPopulation(ctx, s, box, small) {
  const f = current(s);
  const p = alleleA(f);
  const c = settings(s);
  const size = small ? 11 : 13;
  fitLabel(ctx, `Thế hệ ${generationOf(s)}`, box.x + box.w / 2, box.y + (small ? 9 : 14), box.w, { size: small ? 13 : 17, bold: true, align: "center" });
  fitLabel(ctx, `p(A) = ${fmt(p, 3)} · q(a) = ${fmt(1 - p, 3)}`, box.x + box.w / 2, box.y + (small ? 24 : 38), box.w, { size, align: "center" });

  const top = box.y + (small ? 36 : 58);
  const cell = Math.max(6, Math.min(box.w / 10, (box.h - (small ? 88 : 150)) / 10));
  const x0 = box.x + (box.w - cell * 10) / 2;
  const r = cell * 0.42;
  const n = hundred(f);
  const kinds = [["A", "A"], ["A", "a"], ["a", "a"]];
  let k = 0;
  n.forEach((count, g) => {
    for (let i = 0; i < count; i++, k++) {
      const cx = x0 + cell * (k % 10 + 0.5);
      const cy = top + cell * (Math.floor(k / 10) + 0.5);
      // each individual: two alleles, one per half
      kinds[g].forEach((allele, h) => {
        ctx.fillStyle = COL[allele];
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI / 2 + h * Math.PI, Math.PI * 1.5 + h * Math.PI);
        ctx.fill();
      });
    }
  });
  let y = top + cell * 10 + (small ? 12 : 18);
  const rows = [`AA ${fmt(f[0], 3)}`, `Aa ${fmt(f[1], 3)}`, `aa ${fmt(f[2], 3)}`];
  fitLabel(ctx, rows.join(" · "), box.x + box.w / 2, y, box.w, { size, align: "center", bold: true });
  y += small ? 14 : 20;
  const forces = [
    c.randomMating ? null : "tự thụ phấn",
    c.sel ? `chọn lọc s = ${fmt(c.sel, 2)}` : null,
    c.m ? `dòng gene m = ${fmt(c.m, 2)}` : null,
    c.N ? `N = ${fmt(c.N, 0)}` : "N rất lớn",
  ].filter(Boolean);
  if (!small) {
    fitLabel(ctx, forces.join(" · "), box.x + box.w / 2, y, box.w, { size: size - 1, align: "center", color: COLORS.muted });
    fitLabel(ctx, "Mỗi hình tròn: một cá thể (2 allele), 100 cá thể đại diện", box.x + box.w / 2, y + 20, box.w, { size: 11, align: "center", color: COLORS.muted });
    const fx = fixation(f);
    if (fx) fitLabel(ctx, fx > 0 ? "Allele A đã cố định, allele a bị loại bỏ" : "Allele A đã bị loại bỏ, allele a cố định", box.x + box.w / 2, y + 42, box.w, { size: 13, align: "center", bold: true, color: COLORS.red });
  }
}

function chart(ctx, box, small, title, xMax, series, legend) {
  const size = small ? 10 : 12;
  const left = box.x + (small ? 24 : 34);
  const right = box.x + box.w - 4;
  const top = box.y + (small ? 30 : 42);
  const bottom = box.y + box.h - (small ? 22 : 28);
  const X = g => left + (g / xMax) * (right - left);
  const Y = v => bottom - v * (bottom - top);
  fitLabel(ctx, title, box.x, box.y + (small ? 6 : 9), box.w, { size: small ? 11 : 14, bold: true });
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let v = 0; v <= 1.001; v += 0.25) {
    ctx.beginPath();
    ctx.moveTo(left, Y(v));
    ctx.lineTo(right, Y(v));
    ctx.stroke();
    if (!small || v % 0.5 === 0) label(ctx, fmt(v, 2), left - 3, Y(v), { size, align: "right", color: COLORS.muted });
  }
  const tick = xMax <= 50 ? 10 : 50;
  for (let g = 0; g <= xMax; g += tick) label(ctx, String(g), X(g), bottom + size * 0.9, { size, align: "center", color: COLORS.muted });
  ctx.strokeStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();
  if (!small) label(ctx, "thế hệ", right, bottom - 8, { size: 11, align: "right", color: COLORS.muted });
  for (const { pts, color, dash = [], width = 2.5 } of series) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach((v, g) => (g ? ctx.lineTo(X(g), Y(v)) : ctx.moveTo(X(g), Y(v))));
    if (pts.length === 1) ctx.lineTo(X(0) + 2, Y(pts[0]));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // legend, one row under the title
  let lx = box.x;
  const ly = box.y + (small ? 19 : 26);
  ctx.font = `${size}px ${FONT}`;
  for (const [text, color, dash] of legend) {
    const w = 18 + ctx.measureText(text).width + 10;
    if (lx + w > box.x + box.w) break;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 14, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, text, lx + 17, ly, { size, color: COLORS.muted });
    lx += w;
  }
}

mount({
  slug: "di-truyen-quan-the",
  version: "1.0.0",
  title: "Di truyền quần thể Hardy – Weinberg",
  hint: "Chọn tần số allele ban đầu và các nhân tố tiến hoá, rồi bấm Chạy để theo dõi tần số allele và tần số kiểu gene qua các thế hệ.",
  initialState,
  step(s, dt, api) {
    s._acc = (s._acc ?? 0) + dt * GEN_PER_SECOND;
    if (s._acc >= 1) {
      s._acc -= 1;
      advance(s, api);
    }
  },
  controls: [
    { type: "heading", label: "Quần thể ban đầu (thế hệ 0)" },
    { type: "slider", key: "p0", label: "Tần số allele A ban đầu (p₀)", min: 0.01, max: 0.99, step: 0.01, onChange: restart },
    {
      type: "select",
      key: "start",
      label: "Cấu trúc di truyền ban đầu",
      onChange: restart,
      options: [
        { value: "homo", label: "Chỉ có đồng hợp: p₀ AA : q₀ aa" },
        { value: "hw", label: "Cân bằng: p₀² AA : 2p₀q₀ Aa : q₀² aa" },
      ],
    },
    { type: "heading", label: "Các nhân tố" },
    { type: "checkbox", key: "randomMating", label: "Giao phối ngẫu nhiên (bỏ chọn: tự thụ phấn)", onChange: restart },
    { type: "checkbox", key: "selection", label: "Chọn lọc chống lại kiểu gene aa", onChange: restart },
    { type: "slider", key: "sel", label: "Hệ số chọn lọc s (sức sống của aa = 1 − s)", min: 0.05, max: 1, step: 0.05, onChange: restart, visible: s => s.selection },
    { type: "checkbox", key: "migration", label: "Dòng gene (di – nhập gene)", onChange: restart },
    { type: "slider", key: "m", label: "Tỉ lệ cá thể nhập cư mỗi thế hệ (m)", min: 0.01, max: 0.3, step: 0.01, onChange: restart, visible: s => s.migration },
    { type: "slider", key: "pm", label: "Tần số A ở quần thể nhập cư (pₘ)", min: 0, max: 1, step: 0.01, onChange: restart, visible: s => s.migration },
    { type: "checkbox", key: "drift", label: "Phiêu bạt di truyền (quần thể có kích thước hữu hạn)", onChange: restart },
    {
      type: "select",
      key: "N",
      label: "Số cá thể mỗi thế hệ (N)",
      onChange: restart,
      visible: s => s.drift,
      options: SIZES.map(n => ({ value: n, label: fmt(n, 0) })),
    },
    { type: "heading", label: "Thế hệ" },
    {
      type: "button",
      label: "Thế hệ tiếp theo",
      disabled: s => generationOf(s) >= GEN_MAX,
      action: (s, api) => advance(s, api),
      event: "next-generation",
    },
    { type: "button", label: "Về thế hệ 0", action: restart, event: "restart-population", disabled: s => generationOf(s) === 0 },
    { type: "button", label: "Mẫu ngẫu nhiên khác", action: reseed, event: "new-sample", visible: s => s.drift },
  ],
  readouts: [
    { label: "Thế hệ", value: s => `${generationOf(s)} / ${GEN_MAX}` },
    { label: "p(A) · q(a)", value: s => `${fmt(alleleA(current(s)), 3)} · ${fmt(1 - alleleA(current(s)), 3)}` },
    { label: "AA · Aa · aa", value: s => current(s).map(x => fmt(x, 3)).join(" · ") },
    { label: "Theo Hardy – Weinberg: p² · 2pq · q²", value: s => hardyWeinberg(alleleA(current(s))).map(x => fmt(x, 3)).join(" · ") },
  ],
  draw(ctx, s, view) {
    const small = view.w < 560;
    const h = history(s);
    const g = h.length - 1;
    const xMax = g <= 50 ? 50 : Math.min(GEN_MAX, Math.ceil(g / 50) * 50);
    const sceneW = Math.round(view.w * (small ? 0.36 : 0.32));
    drawPopulation(ctx, s, { x: 6, y: 4, w: sceneW - 10, h: view.h - 8 }, small);
    const pad = small ? 6 : 20;
    const gx = sceneW + pad;
    const gw = view.w - gx - (small ? 6 : 20);
    const gap = small ? 8 : 22;
    const top = small ? 4 : 14;
    const gh = (view.h - top - gap - 4) / 2;
    const p = h.map(alleleA);
    const p0 = settings(s).p0;
    chart(ctx, { x: gx, y: top, w: gw, h: gh }, small, "Tần số allele qua các thế hệ", xMax,
      [
        { pts: Array(xMax + 1).fill(p0), color: COLORS.muted, dash: [5, 4], width: 1.5 },
        { pts: p.map(x => 1 - x), color: COL.a },
        { pts: p, color: COL.A },
      ],
      [["p (A)", COL.A], ["q (a)", COL.a], [small ? "p₀" : "p₀: dự đoán Hardy – Weinberg", COLORS.muted, [5, 4]]]);
    const hw = p.map(hardyWeinberg);
    chart(ctx, { x: gx, y: top + gh + gap, w: gw, h: gh }, small, "Tần số kiểu gene (nét đứt: p², 2pq, q²)", xMax,
      [0, 1, 2].flatMap(i => [
        { pts: hw.map(x => x[i]), color: [COL.AA, COL.Aa, COL.aa][i], dash: [4, 4], width: 1.5 },
        { pts: h.map(x => x[i]), color: [COL.AA, COL.Aa, COL.aa][i] },
      ]),
      [["AA", COL.AA], ["Aa", COL.Aa], ["aa", COL.aa], [small ? "HW" : "Hardy – Weinberg", COLORS.muted, [4, 4]]]);
  },
});
