import { mount, COLORS, arrow, label, fmt } from "../../kit/v1/kit.js";
import { initialState, angleDeg, classify, intersection, perpendicularSlope, taskMet, equation, same, CODES, NAMES, TASKS } from "./model.js";

const C1 = COLORS.blue;
const C2 = COLORS.red;
const pt = (x, y) => `(${fmt(x, 2)}; ${fmt(y, 2)})`;

function report(s, api) {
  const rel = classify(s.a1, s.b1, s.a2, s.b2);
  const p = intersection(s.a1, s.b1, s.a2, s.b2);
  api.emit("lines-committed", { classification: CODES[rel], hasIntersection: p ? 1 : 0, ...(p && { x: p.x, y: p.y }), a1: s.a1, a2: s.a2 }, "result");
  const met = taskMet(s);
  if (met && !s.taskDone) api.emit("task-done", { task: s.task, a2: s.a2, b2: s.b2 }, "goal");
  s.taskDone = met;
}

// Warning when the slope a perpendicular d₂ needs is not on the slider grid.
function perpNote(s) {
  const t = TASKS[s.task];
  if (!t || t.rel !== "vuong-goc") return "";
  const want = perpendicularSlope(s.a1);
  if (Number.isNaN(want)) return "d₁ song song với Ox (a₁ = 0): đổi a₁ khác 0.";
  if (Math.abs(want) > 4 || !same(Math.round(want * 4) / 4, want)) return `Cần a₂ = −1/a₁ ≈ ${fmt(want, 3)}, không có trên thanh trượt: đổi a₁.`;
  return "";
}

function view2(view) {
  const small = view.w < 520 || view.h < 420;
  const head = small ? 52 : 70;
  const u = Math.max(14, Math.min(48, Math.min(view.w / 13, (view.h - head) / 11)));
  return { small, head, u, ox: view.w / 2, oy: head + (view.h - head) / 2 };
}

function drawLine(ctx, g, view, a, b, color) {
  const x0 = -g.ox / g.u - 1;
  const x1 = (view.w - g.ox) / g.u + 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(g.ox + x0 * g.u, g.oy - (a * x0 + b) * g.u);
  ctx.lineTo(g.ox + x1 * g.u, g.oy - (a * x1 + b) * g.u);
  ctx.stroke();
}

// Rise over run from x = xs: run 1 to the right, rise a.
function slopeTriangle(ctx, g, a, b, xs, color, name, size) {
  const X = x => g.ox + x * g.u;
  const Y = y => g.oy - y * g.u;
  const y0 = a * xs + b;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(X(xs), Y(y0));
  ctx.lineTo(X(xs + 1), Y(y0));
  ctx.lineTo(X(xs + 1), Y(y0 + a));
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, "1", X(xs + 0.5), Y(y0) + (a >= 0 ? 9 : -9), { size: size - 1, align: "center", color, bold: true });
  if (!same(a, 0)) label(ctx, `${name} = ${fmt(a, 2)}`, X(xs + 1) + 4, Y(y0 + a / 2), { size: size - 1, color, bold: true });
}

// Angle from the positive direction of Ox to the line, at the x-intercept.
function angleArc(ctx, g, view, a, b, color, name, size) {
  if (same(a, 0)) return;
  const xi = -b / a;
  const px = g.ox + xi * g.u;
  if (px < 10 || px > view.w - 10) return;
  const al = (angleDeg(a) * Math.PI) / 180;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, g.oy, 18, 0, -al, true);
  ctx.stroke();
  label(ctx, name, px + 26 * Math.cos(al / 2), g.oy - 26 * Math.sin(al / 2), { size: size - 1, color, bold: true, align: "center" });
}

mount({
  slug: "ham-so-bac-nhat",
  version: "1.0.0",
  title: "Hệ số góc và vị trí hai đường thẳng",
  hint: "Chỉnh hệ số góc a và tung độ gốc b của hai đường thẳng. Hai đường thẳng song song khi a₁ = a₂, b₁ ≠ b₂; vuông góc khi a₁·a₂ = −1.",
  initialState,
  controls: [
    { type: "heading", label: "d₁: y = a₁x + b₁" },
    { type: "slider", key: "a1", label: "Hệ số góc a₁", min: -4, max: 4, step: 0.25 },
    { type: "slider", key: "b1", label: "Tung độ gốc b₁", min: -6, max: 6, step: 0.25 },
    { type: "heading", label: "d₂: y = a₂x + b₂" },
    { type: "slider", key: "a2", label: "Hệ số góc a₂", min: -4, max: 4, step: 0.25 },
    { type: "slider", key: "b2", label: "Tung độ gốc b₂", min: -6, max: 6, step: 0.25 },
    { type: "checkbox", key: "showSlope", label: "Hiện tam giác hệ số góc và góc tạo với Ox" },
    { type: "heading", label: "Nhiệm vụ" },
    {
      type: "select",
      key: "task",
      label: "Yêu cầu",
      options: TASKS.map((t, i) => ({ value: i, label: t ? t.text : "Tự do khám phá" })),
    },
    { type: "slider", key: "mx", label: "Hoành độ điểm M", min: -4, max: 4, step: 1, digits: 0, visible: s => !!TASKS[s.task]?.throughM },
    { type: "slider", key: "my", label: "Tung độ điểm M", min: -4, max: 4, step: 1, digits: 0, visible: s => !!TASKS[s.task]?.throughM },
  ].map(c => (c.key ? { ...c, onCommit: report } : c)),
  readouts: [
    { label: "Góc α₁ tạo bởi d₁ và Ox", value: s => `${fmt(angleDeg(s.a1), 1)}°` },
    { label: "Góc α₂ tạo bởi d₂ và Ox", value: s => `${fmt(angleDeg(s.a2), 1)}°` },
    { label: "a₁ · a₂", value: s => fmt(s.a1 * s.a2, 4) },
    { label: "Vị trí d₁ và d₂", value: s => NAMES[classify(s.a1, s.b1, s.a2, s.b2)] },
    {
      label: "Giao điểm",
      value: s => {
        const p = intersection(s.a1, s.b1, s.a2, s.b2);
        return p ? pt(p.x, p.y) : "–";
      },
    },
    { label: "Nhiệm vụ", value: s => (!s.task ? "–" : taskMet(s) ? "Đạt" : "Chưa đạt") },
  ],
  draw(ctx, s, view) {
    const g = view2(view);
    const { u, ox, oy, small } = g;
    const size = small ? 12 : 14;

    // grid and axes
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.ceil(-ox / u); i <= (view.w - ox) / u; i++) {
      ctx.moveTo(ox + i * u, g.head);
      ctx.lineTo(ox + i * u, view.h);
    }
    for (let j = Math.ceil((oy - view.h) / u); j <= (oy - g.head) / u; j++) {
      ctx.moveTo(0, oy - j * u);
      ctx.lineTo(view.w, oy - j * u);
    }
    ctx.stroke();
    arrow(ctx, 0, oy, view.w - 2, oy, COLORS.muted, 1.5);
    arrow(ctx, ox, view.h, ox, g.head + 2, COLORS.muted, 1.5);
    label(ctx, "x", view.w - 10, oy - 12, { size, color: COLORS.muted, align: "center" });
    label(ctx, "y", ox + 12, g.head + 10, { size, color: COLORS.muted });
    label(ctx, "O", ox - 6, oy + 10, { size: size - 2, color: COLORS.muted, align: "right" });
    const every = u < 26 ? 2 : 1;
    for (let i = Math.ceil(-ox / u); i <= (view.w - ox) / u - 1; i++) {
      if (i && i % every === 0) label(ctx, fmt(i, 0), ox + i * u, oy + 10, { size: 10, color: COLORS.muted, align: "center" });
    }
    for (let j = Math.ceil((oy - view.h) / u) + 1; j <= (oy - g.head) / u - 1; j++) {
      if (j && j % every === 0) label(ctx, fmt(j, 0), ox - 5, oy - j * u, { size: 10, color: COLORS.muted, align: "right" });
    }

    // lines (d₂ under d₁ so coinciding lines show d₁ dashed on top)
    drawLine(ctx, g, view, s.a2, s.b2, C2);
    drawLine(ctx, g, view, s.a1, s.b1, C1);
    const rel = classify(s.a1, s.b1, s.a2, s.b2);
    if (rel === "trung-nhau") {
      ctx.setLineDash([8, 8]);
      drawLine(ctx, g, view, s.a2, s.b2, C2);
      ctx.setLineDash([]);
    }
    if (s.showSlope) {
      slopeTriangle(ctx, g, s.a1, s.b1, 0, C1, "a₁", size);
      slopeTriangle(ctx, g, s.a2, s.b2, -3, C2, "a₂", size);
      angleArc(ctx, g, view, s.a1, s.b1, C1, "α₁", size);
      angleArc(ctx, g, view, s.a2, s.b2, C2, "α₂", size);
    }

    // intersection, right-angle mark
    const p = intersection(s.a1, s.b1, s.a2, s.b2);
    if (p) {
      const px = ox + p.x * u;
      const py = oy - p.y * u;
      if (rel === "vuong-goc") {
        const d1 = [1, s.a1].map(v => v / Math.hypot(1, s.a1));
        const d2 = [1, s.a2].map(v => v / Math.hypot(1, s.a2));
        const q = 10;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + d1[0] * q, py - d1[1] * q);
        ctx.lineTo(px + (d1[0] + d2[0]) * q, py - (d1[1] + d2[1]) * q);
        ctx.lineTo(px + d2[0] * q, py - d2[1] * q);
        ctx.stroke();
      }
      if (px > -20 && px < view.w + 20 && py > g.head - 20 && py < view.h + 20) {
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        label(ctx, `I${pt(p.x, p.y)}`, px + 8, py - 12, { size, bold: true });
      }
    }
    if (TASKS[s.task]?.throughM) {
      const mx = ox + s.mx * u;
      const my = oy - s.my * u;
      ctx.fillStyle = COLORS.green;
      ctx.beginPath();
      ctx.arc(mx, my, 5.5, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, `M${pt(s.mx, s.my)}`, mx + 8, my + 13, { size, bold: true, color: COLORS.green });
    }

    // header
    ctx.fillStyle = "rgba(247, 249, 253, 0.94)";
    ctx.fillRect(0, 0, view.w, g.head);
    const lh = small ? 16 : 21;
    label(ctx, `d₁: ${equation(s.a1, s.b1, fmt)}`, 10, 11, { size: size + 1, bold: true, color: C1 });
    label(ctx, `d₂: ${equation(s.a2, s.b2, fmt)}`, small ? view.w / 2 : 200, 11, { size: size + 1, bold: true, color: C2 });
    let line2 = `d₁ và d₂ ${NAMES[rel]}`;
    if (rel === "song-song") line2 += ` (a₁ = a₂, b₁ ≠ b₂)`;
    if (rel === "trung-nhau") line2 += ` (a₁ = a₂, b₁ = b₂)`;
    if (rel === "vuong-goc") line2 = `d₁ ⊥ d₂ vì a₁·a₂ = −1`;
    if (rel === "cat-nhau") line2 += ` (a₁ ≠ a₂)`;
    label(ctx, line2, 10, 11 + lh, { size, bold: true });
    const t = TASKS[s.task];
    const zero = same(s.a1, 0) || same(s.a2, 0) ? "a = 0: hàm hằng, không phải hàm số bậc nhất." : "";
    const note = t ? (taskMet(s) ? `Đạt: ${t.text}.` : perpNote(s) || `Nhiệm vụ: ${t.text}.`) : zero;
    if (note) label(ctx, note, 10, 11 + 2 * lh, { size: size - 2, color: t && taskMet(s) ? COLORS.green : COLORS.muted });
  },
});
