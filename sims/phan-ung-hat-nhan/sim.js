import { mount, COLORS, arrow, label, fmt, clamp } from "../../kit/v1/kit.js";
import {
  U_MEV, FISSION_MEV, NUCLIDES, REACTANTS, CURVE, PRESETS, G_MAX, CAP, initialState, nuclide, loadPreset, missing, balance, energy,
  binding, classify, expected, nextSeed, chainView, step,
} from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const script = (n, digits) => [...String(n)].map(c => digits[c] ?? c).join("");
const notation = p => `${script(p.A, "⁰¹²³⁴⁵⁶⁷⁸⁹")}${script(p.Z, "₀₁₂₃₄₅₆₇₈₉")}${p.sym}`;
const option = p => ({ value: p.id, label: p.name ? `${notation(p)} (${p.name})` : notation(p) });
const UNKNOWN = { A: "?", Z: "?", sym: "X", unknown: true };
const NEUTRON = nuclide("n");
const KIND = { subcritical: "dưới hạn", critical: "tới hạn", supercritical: "vượt hạn" };
const KIND_COLOR = { subcritical: COLORS.blue, critical: COLORS.green, supercritical: COLORS.red };

// One result per completed (A and Z conserved) reaction.
const reportReaction = (s, api) => {
  const e = energy(s);
  if (!e) return;
  const b = balance(s);
  const data = { energy: e.W, massDefect: e.dm, massNumber: b.left.A, charge: b.left.Z };
  api.emit("reaction-completed", data, "result");
};
const custom = s => {
  s.preset = "custom";
};
const restartChain = (s, api) => {
  s.gens = 0;
  s._clock = 0;
  api.pause();
};

// Draw `text` centred on at most `max` lines; returns the y after the last line.
function wrapped(ctx, text, cx, y, width, { size, color, bold, max = 2 }) {
  ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word;
    if (ctx.measureText(next).width <= width || !lines.at(-1)) lines[lines.length - 1] = next;
    else lines.push(word);
  }
  lines.slice(0, max).forEach((line, i) => label(ctx, line, cx, y + size * 0.7 + i * (size + 4), { size, color, bold, align: "center" }));
  return y + Math.min(lines.length, max) * (size + 4);
}

// ---------- reaction ----------
// A nuclide written with its mass number above its charge number, e.g. ²³⁵₉₂U. Returns the width.
function nuclideText(ctx, p, x, y, size, color, coef = 1, dry = false) {
  const small = size * 0.58;
  ctx.font = `${small}px ${FONT}`;
  const wa = Math.max(ctx.measureText(String(p.A)).width, ctx.measureText(String(p.Z)).width);
  ctx.font = `600 ${size}px ${FONT}`;
  const wc = coef > 1 ? ctx.measureText(String(coef)).width + 3 : 0;
  const ws = ctx.measureText(p.sym).width;
  if (!dry) {
    if (coef > 1) label(ctx, String(coef), x, y, { size, bold: true, color });
    label(ctx, String(p.A), x + wc + wa, y - size * 0.4, { size: small, align: "right", color });
    label(ctx, String(p.Z), x + wc + wa, y + size * 0.36, { size: small, align: "right", color });
    label(ctx, p.sym, x + wc + wa + 2, y, { size, bold: true, color });
  }
  return wc + wa + 2 + ws;
}

function drawNucleus(ctx, p, cx, cy, scale, product, coef) {
  const r = p.unknown ? 14 * scale : (4 + 3.3 * Math.cbrt(p.A)) * scale;
  for (let i = 0; i < coef; i++) {
    const x = cx + (i - (coef - 1) / 2) * (2 * r + 4);
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    if (p.unknown) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, "?", x, cy, { size: 15 * scale, bold: true, align: "center", color: COLORS.red });
    } else {
      ctx.fillStyle = p.Z === 0 ? COLORS.muted : product ? COLORS.orange : COLORS.blue;
      ctx.fill();
    }
  }
}

function drawReaction(ctx, s, view, small) {
  const b = balance(s);
  const e = energy(s);
  const x = missing(s);
  const extra = clamp(Math.round(s.extra) || 0, 0, 3);
  const [pa, pb, pc] = [s.a, s.b, s.c].map(nuclide);
  const pd = nuclide(s.d) ?? UNKNOWN;
  const size = small ? 11 : 14;
  const pad = small ? 10 : 28;
  const w = view.w - 2 * pad;
  const fission = [s.a, s.b].includes("U235") && [s.a, s.b].includes("n");
  const fusion = pa.A <= 3 && pb.A <= 3 && pa.Z > 0 && pb.Z > 0;
  const title = fission ? "Phản ứng phân hạch" : fusion ? "Phản ứng nhiệt hạch (tổng hợp hạt nhân)" : "Phản ứng hạt nhân";

  // tokens of the equation, measured first so the whole line can be centred and shrunk to fit
  const tokens = [{ p: pa }, "+", { p: pb }, "→", { p: pc, product: true }, "+", { p: pd, product: true }];
  if (extra) tokens.push("+", { p: NEUTRON, product: true, coef: extra });
  let eq = small ? 20 : 30;
  const measure = () => tokens.reduce((sum, t) => sum + (t.p ? nuclideText(ctx, t.p, 0, 0, eq, "", t.coef, true) : eq * 1.5), 0);
  if (measure() > w) eq *= w / measure();
  const total = measure();

  const picture = view.h >= 300;
  const ph = picture ? (small ? 46 : 76) : 0;
  const lines = 5;
  const block = (small ? 22 : 34) + ph + eq * 1.9 + lines * (size + 8) + 2 * (size + 3) + 10;
  let y = Math.max(4, (view.h - block) / 2);
  label(ctx, title, view.w / 2, y + (small ? 9 : 12), { size: small ? 14 : 19, bold: true, align: "center" });
  y += small ? 22 : 34;

  let tx = (view.w - total) / 2;
  const ey = y + ph + eq * 0.9;
  const scale = (small ? 0.7 : 1.15) * Math.min(1, eq / (small ? 20 : 30) + 0.2);
  for (const t of tokens) {
    if (!t.p) {
      label(ctx, t, tx + eq * 0.75, ey, { size: eq * 0.9, align: "center", color: COLORS.ink });
      if (picture) label(ctx, t, tx + eq * 0.75, y + ph / 2, { size: eq * 0.7, align: "center", color: COLORS.muted });
      tx += eq * 1.5;
      continue;
    }
    const tw = nuclideText(ctx, t.p, tx, ey, eq, t.p.unknown ? COLORS.red : COLORS.ink, t.coef);
    if (picture) drawNucleus(ctx, t.p, tx + tw / 2, y + ph / 2, scale, t.product, t.coef ?? 1);
    tx += tw;
  }
  y = ey + eq;

  // conservation of the mass number and of the charge number
  const sums = (key, sym) => {
    const right = [pc[key], pd.unknown ? `${sym}ₓ` : pd[key], ...(extra && key === "A" ? [`${extra}·1`] : extra ? [`${extra}·0`] : [])].join(" + ");
    return `${pa[key]} + ${pb[key]} = ${right}`;
  };
  const row = (name, key, sym, ok) => {
    const text = `${name}:  ${sums(key, sym)}`;
    const tail = !b.complete ? `  ⟹  ${sym}ₓ = ${x[key]}` : ok ? "   ✓ bảo toàn" : `   ✗ ${b.left[key]} ≠ ${b.right[key]}`;
    label(ctx, text + tail, view.w / 2, y + size / 2, { size, align: "center", bold: true, color: !b.complete ? COLORS.ink : ok ? COLORS.green : COLORS.red });
    y += size + 8;
  };
  row(small ? "Số khối A" : "Bảo toàn số khối A", "A", "A", b.okA);
  row(small ? "Điện tích Z" : "Bảo toàn điện tích Z", "Z", "Z", b.okZ);
  y += 4;
  if (!b.complete) {
    const text = x.id
      ? `Hạt X phải có số khối ${x.A} và điện tích ${x.Z}. Hãy chọn hạt đó ở mục «Hạt tạo thành 2».`
      : `Không có hạt nào trong danh sách có A = ${x.A}, Z = ${x.Z}. Hãy đổi một hạt hoặc số neutron kèm theo.`;
    y = wrapped(ctx, text, view.w / 2, y, w, { size, bold: true, color: COLORS.red, max: 3 });
  } else if (!e) {
    y = wrapped(ctx, "Số khối hoặc điện tích chưa được bảo toàn: phản ứng viết như thế này không thể xảy ra.", view.w / 2, y, w, { size, bold: true, color: COLORS.red, max: 3 });
  } else {
    y = wrapped(ctx, `m trước = ${fmt(e.before, 6)} u;  m sau = ${fmt(e.after, 6)} u;  Δm = ${fmt(e.dm, 6)} u`, view.w / 2, y, w, { size, color: COLORS.ink });
    y = wrapped(ctx, `W = Δm·c² = ${fmt(e.dm, 6)} × ${fmt(U_MEV, 1)} = ${fmt(e.W, 2)} MeV: phản ứng ${e.W >= 0 ? "tỏa" : "thu"} năng lượng`, view.w / 2, y + 2, w, { size: size + 1, bold: true, color: e.W >= 0 ? COLORS.green : COLORS.orange });
  }
  wrapped(ctx, "Khối lượng tính theo khối lượng nguyên tử, 1 u·c² = 931,5 MeV. Kích thước hạt nhân vẽ không theo tỉ lệ.", view.w / 2, Math.min(y + 6, view.h - 2 * (size + 3)), w, { size: size - 1, color: COLORS.muted });
}

// ---------- binding energy per nucleon ----------
function drawCurve(ctx, s, view, small) {
  const size = small ? 11 : 13;
  const chosen = nuclide(s.nuclide) ?? nuclide("Fe56");
  const footH = 3 * (size + 4) + 6;
  const box = { x: small ? 34 : 56, y: small ? 40 : 44, w: view.w - (small ? 44 : 84), h: view.h - (small ? 40 : 44) - footH - (small ? 32 : 34) };
  const X = A => box.x + (A / 240) * box.w;
  const Y = e => box.y + box.h - (e / 9) * box.h;
  label(ctx, "Năng lượng liên kết riêng theo số khối", view.w / 2, small ? 11 : 20, { size: small ? 13 : 17, bold: true, align: "center" });
  // most stable region
  ctx.fillStyle = "rgba(31, 157, 107, 0.1)";
  ctx.fillRect(X(50), box.y, X(80) - X(50), box.h);
  label(ctx, small ? "bền nhất" : "bền vững nhất (A ≈ 50–80)", X(65), box.y + box.h - 9, { size: size - 2, align: "center", color: COLORS.green });
  // axes and grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let e = 0; e <= 9; e += small ? 2 : 1) {
    ctx.moveTo(box.x, Y(e));
    ctx.lineTo(box.x + box.w, Y(e));
    label(ctx, String(e), box.x - 6, Y(e), { size: size - 2, align: "right", color: COLORS.muted });
  }
  for (let A = 0; A <= 240; A += small ? 80 : 40) {
    ctx.moveTo(X(A), box.y);
    ctx.lineTo(X(A), box.y + box.h);
    label(ctx, String(A), X(A), box.y + box.h + 10, { size: size - 2, align: "center", color: COLORS.muted });
  }
  ctx.stroke();
  label(ctx, "Số khối A", box.x + box.w, box.y + box.h + (small ? 23 : 24), { size: size - 1, align: "right", color: COLORS.ink });
  label(ctx, "Wlk/A (MeV/nucleon)", small ? 4 : 10, box.y - 10, { size: size - 1, color: COLORS.ink });
  // points joined in order of A
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  CURVE.forEach((p, i) => ctx[i ? "lineTo" : "moveTo"](X(p.A), Y(binding(p).perNucleon)));
  ctx.stroke();
  for (const p of CURVE) {
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(X(p.A), Y(binding(p).perNucleon), small ? 2.5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // where energy is released
  const ay = Y(4.2);
  arrow(ctx, X(18), Y(3), X(42), Y(5.4), COLORS.orange, 2);
  label(ctx, "nhiệt hạch", X(44), Y(3.6), { size, color: COLORS.orange, bold: true });
  arrow(ctx, X(232), ay, X(170), ay, COLORS.purple, 2);
  label(ctx, "phân hạch", X(201), ay + 13, { size, color: COLORS.purple, bold: true, align: "center" });
  // chosen nuclide
  const b = binding(chosen);
  const [cx, cy] = [X(chosen.A), Y(b.perNucleon)];
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, small ? 6 : 8, 0, Math.PI * 2);
  ctx.stroke();
  const right = cx < box.x + box.w * 0.7;
  label(ctx, `${notation(chosen)}: ${fmt(b.perNucleon, 2)}`, cx + (right ? 12 : -12), cy + (b.perNucleon > 7 ? 18 : -2), { size: size + 1, bold: true, color: COLORS.red, align: right ? "left" : "right" });
  const y = wrapped(ctx, `${notation(chosen)} có ${chosen.Z} proton và ${chosen.A - chosen.Z} neutron: Δm = ${fmt(b.dm, 6)} u, Wlk = Δm·c² = ${fmt(b.W, 1)} MeV, Wlk/A = ${fmt(b.perNucleon, 2)} MeV/nucleon.`, view.w / 2, view.h - footH, view.w - 16, { size, bold: true, color: COLORS.ink });
  wrapped(ctx, "Wlk/A càng lớn thì hạt nhân càng bền vững.", view.w / 2, y + 2, view.w - 16, { size: size - 1, color: COLORS.muted, max: 1 });
}

// ---------- chain reaction ----------
function drawChain(ctx, s, view, small) {
  const size = small ? 11 : 13;
  const v = chainView(s);
  const kind = classify(s.k);
  const color = KIND_COLOR[kind];
  const footH = 5 * (size + 4) + 4;
  const box = { x: small ? 36 : 60, y: small ? 44 : 70, w: view.w - (small ? 46 : 90), h: view.h - (small ? 44 : 70) - footH - (small ? 34 : 30) };
  label(ctx, `Phân hạch dây chuyền của ²³⁵U,  k = ${fmt(s.k, 2)}`, view.w / 2, small ? 11 : 20, { size: small ? 13 : 17, bold: true, align: "center" });
  label(ctx, `Hệ ${KIND[kind]}`, view.w / 2, small ? 28 : 44, { size: small ? 12 : 15, bold: true, align: "center", color });
  const top = Math.max(...v.all, expected(s.k, s.n0, v.all.length - 1), 1) * 1.15;
  const slot = box.w / (G_MAX + 1);
  const Y = n => box.y + box.h - (Math.min(n, top) / top) * box.h;
  // axes
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.stroke();
  for (const f of [0, 0.5, 1]) label(ctx, fmt((top / 1.15) * f, 0), box.x - 5, Y((top / 1.15) * f), { size: size - 2, align: "right", color: COLORS.muted });
  label(ctx, "Số phân hạch", small ? 4 : 10, box.y - 10, { size: size - 1 });
  label(ctx, "Thế hệ", box.x + box.w, box.y + box.h + (small ? 22 : 26), { size: size - 1, align: "right" });
  for (let g = 0; g <= G_MAX; g++) {
    const cx = box.x + slot * (g + 0.5);
    if (!small || g % 2 === 0) label(ctx, String(g), cx, box.y + box.h + 9, { size: size - 2, align: "center", color: COLORS.muted });
    if (g > v.generations) continue;
    ctx.fillStyle = color;
    ctx.fillRect(cx - slot * 0.36, Y(v.counts[g]), slot * 0.72, box.y + box.h - Y(v.counts[g]));
    if (slot >= 30) label(ctx, fmt(v.counts[g], 0), cx, Y(v.counts[g]) - 8, { size: size - 2, align: "center" });
  }
  // theoretical mean N0·k^g
  ctx.strokeStyle = COLORS.ink;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let g = 0; g <= G_MAX; g++) ctx[g ? "lineTo" : "moveTo"](box.x + slot * (g + 0.5), Y(expected(s.k, s.n0, g)));
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, "- - -  trung bình lí thuyết N₀·kⁿ", box.x + box.w, box.y + 8, { size: size - 2, align: "right", color: COLORS.muted });
  const message = {
    subcritical: "k < 1: số phân hạch giảm dần, phản ứng dây chuyền tắt.",
    critical: "k = 1: phản ứng tự duy trì, năng lượng tỏa ra không đổi theo thời gian (lò phản ứng hạt nhân).",
    supercritical: "k > 1: số phân hạch tăng rất nhanh; nếu không khống chế được sẽ gây nổ.",
  }[kind];
  let y = wrapped(ctx, message, view.w / 2, view.h - footH, view.w - 16, { size, bold: true, color });
  y = wrapped(ctx, `${v.capped ? `Dừng khi vượt ${fmt(CAP, 0)} phân hạch trong một thế hệ. ` : ""}Sau ${v.generations} thế hệ: ${fmt(v.fissions, 0)} phân hạch × khoảng ${FISSION_MEV} MeV ≈ ${fmt(v.fissions * FISSION_MEV, 0)} MeV.`, view.w / 2, y + 2, view.w - 16, { size, color: COLORS.ink, max: 1 });
  wrapped(ctx, "Mô hình ngẫu nhiên: mỗi phân hạch sinh 2 hoặc 3 neutron (trung bình 2,5), trung bình k neutron trong số đó gây phân hạch tiếp.", view.w / 2, y + 2, view.w - 16, { size: size - 1, color: COLORS.muted });
}

const particle = (key, text, options) => ({
  type: "select",
  key,
  label: text,
  options,
  visible: s => s.mode === "reaction",
  onChange: key === "d" ? undefined : custom,
  onCommit: reportReaction,
});

mount({
  slug: "phan-ung-hat-nhan",
  version: "1.0.0",
  title: "Phản ứng hạt nhân, phân hạch và nhiệt hạch",
  hint: "Lập phương trình phản ứng hạt nhân, xem năng lượng liên kết riêng, rồi điều khiển phản ứng phân hạch dây chuyền.",
  initialState,
  step(s, dt, api) {
    if (s.mode !== "chain") return api.pause();
    if (chainView(s).done) s.gens = 0; // "Chạy" on a finished run starts it again
    if (!step(s, dt)) return;
    api.pause();
    const v = chainView(s);
    const data = { k: s.k, generations: v.generations, fissions: v.fissions, last: v.counts.at(-1) };
    api.emit("chain-finished", data, "result");
  },
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Nội dung",
      options: [
        { value: "reaction", label: "Lập phương trình phản ứng" },
        { value: "curve", label: "Năng lượng liên kết riêng" },
        { value: "chain", label: "Phản ứng phân hạch dây chuyền" },
      ],
      onChange: (s, api) => api.pause(),
    },
    {
      type: "select",
      key: "preset",
      label: "Phản ứng mẫu (tìm hạt X)",
      options: [
        { value: "custom", label: "Tự chọn các hạt" },
        { value: "dt", label: "Nhiệt hạch: ²₁H + ³₁H" },
        { value: "dd", label: "Nhiệt hạch: ²₁H + ²₁H" },
        { value: "pli", label: "Proton bắn vào ⁷₃Li" },
        { value: "an", label: "Hạt α bắn vào ¹⁴₇N" },
        { value: "abe", label: "Hạt α bắn vào ⁹₄Be" },
        { value: "aal", label: "Hạt α bắn vào ²⁷₁₃Al" },
        { value: "nli", label: "Neutron bắn vào ⁶₃Li" },
        { value: "fbk", label: "Phân hạch ²³⁵₉₂U thành Ba và Kr" },
        { value: "fxs", label: "Phân hạch ²³⁵₉₂U thành Xe và Sr" },
      ],
      visible: s => s.mode === "reaction",
      onChange: s => void loadPreset(s),
    },
    particle("a", "Hạt tham gia 1", REACTANTS.map(option)),
    particle("b", "Hạt tham gia 2", REACTANTS.map(option)),
    particle("c", "Hạt tạo thành 1", REACTANTS.map(option)),
    particle("d", "Hạt tạo thành 2", [{ value: "?", label: "X (chưa biết)" }, ...REACTANTS.map(option)]),
    { type: "stepper", key: "extra", label: "Số neutron kèm theo", min: 0, max: 3, visible: s => s.mode === "reaction", onChange: custom, onCommit: reportReaction },
    {
      type: "button",
      label: "Gợi ý: điền hạt X",
      visible: s => s.mode === "reaction" && s.d === "?",
      disabled: s => !missing(s).id,
      action(s, api) {
        s.d = missing(s).id ?? "?";
        reportReaction(s, api);
      },
      event: "hint-used",
    },
    { type: "select", key: "nuclide", label: "Hạt nhân", options: CURVE.map(option), visible: s => s.mode === "curve" },
    {
      type: "slider",
      key: "k",
      label: "Hệ số nhân neutron k",
      min: 0.5,
      max: 1.5,
      step: 0.05,
      digits: 2,
      visible: s => s.mode === "chain",
      format: v => `${fmt(v, 2)} (${KIND[classify(v)]})`,
      onChange: restartChain,
      onCommit(s, api) {
        api.play();
        if (classify(s.k) === "critical") api.emit("critical-reached", { k: s.k }, "goal");
      },
    },
    { type: "slider", key: "n0", label: "Số phân hạch ban đầu N₀", min: 1, max: 50, step: 1, digits: 0, visible: s => s.mode === "chain", onChange: restartChain, onCommit: (s, api) => api.play() },
    {
      type: "button",
      label: "Chạy chuỗi phản ứng",
      primary: true,
      visible: s => s.mode === "chain",
      action(s, api) {
        restartChain(s, api);
        api.play();
      },
      event: "chain-started",
    },
    {
      type: "button",
      label: "Chạy một lần ngẫu nhiên khác",
      visible: s => s.mode === "chain",
      action(s, api) {
        s.seed = nextSeed(s.seed);
        restartChain(s, api);
        api.play();
      },
      event: "chain-reseeded",
    },
  ],
  readouts: [
    { label: "Năng lượng phản ứng W", value: s => (energy(s) ? `${fmt(energy(s).W, 2)} MeV` : "–") },
    { label: "Wlk/A của hạt nhân đã chọn", value: s => `${fmt(binding(nuclide(s.nuclide) ?? NUCLIDES[2]).perNucleon, 2)} MeV` },
    { label: "Số phân hạch trong chuỗi", value: s => fmt(chainView(s).fissions, 0) },
  ],
  draw(ctx, s, view) {
    const small = view.w < 480 || view.h < 400;
    if (s.mode === "curve") drawCurve(ctx, s, view, small);
    else if (s.mode === "chain") drawChain(ctx, s, view, small);
    else drawReaction(ctx, s, view, small);
  },
});
