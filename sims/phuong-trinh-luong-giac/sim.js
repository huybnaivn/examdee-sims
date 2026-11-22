import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { FORMS, PRESETS, INTERVALS, A_MIN, A_MAX, initialState, f, families, hasSolution, solutions, count, general, num, aLabel, angleText, intervalText, isCorrect, newQuestion } from "./model.js";

const PI = Math.PI;
const FONT = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const code = s => FORMS.indexOf(s.form) + 1;
const reveal = s => !s.practice || s.status === "right"; // practice hides the answer until it is counted
const unasked = s => {
  s.status = "";
  s.answer = 0;
};

// One result per finished choice of equation or interval.
const report = (s, api) => {
  api.emit("equation-solved", { form: code(s), a: s.a, count: count(s), solvable: hasSolution(s.form, s.a) ? 1 : 0 }, "result");
};

const line = (ctx, x1, y1, x2, y2, color, width = 1.5, dash = []) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
};
const dot = (ctx, x, y, color, r = 4.5) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * PI);
  ctx.fill();
};

function drawCircle(ctx, s, box, small) {
  const { form, a } = s;
  // The picture zooms out only when the line leaves the usual frame, so the unit circle stays large.
  const e = Math.max(1.35, Math.abs(a) + 0.3);
  const k = Math.min(box.w, box.h) / (2 * e);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const X = x => cx + k * x;
  const Y = y => cy - k * y;
  const size = small ? 10 : 13;

  line(ctx, X(-e), cy, X(e), cy, COLORS.muted, 1);
  line(ctx, cx, Y(-e), cx, Y(e), COLORS.muted, 1);
  label(ctx, "cos", X(e) - 2, cy + size * 0.8, { size, color: COLORS.muted, align: "right" });
  label(ctx, "sin", cx + 4, Y(e) + size * 0.6, { size, color: COLORS.muted });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, k, 0, 2 * PI);
  ctx.stroke();

  const value = aLabel(a);
  if (form === "sin") {
    line(ctx, X(-e), Y(a), X(e), Y(a), COLORS.orange, 2);
    dot(ctx, cx, Y(a), COLORS.orange, 3.5);
    label(ctx, value, cx - 5, Y(a) + (a < 0 ? size * 0.8 : -size * 0.8), { size, color: COLORS.orange, bold: true, align: "right" });
  } else if (form === "cos") {
    line(ctx, X(a), Y(-e), X(a), Y(e), COLORS.orange, 2);
    dot(ctx, X(a), cy, COLORS.orange, 3.5);
    label(ctx, value, X(a) + (a < 0 ? -5 : 5), cy - size * 0.8, { size, color: COLORS.orange, bold: true, align: a < 0 ? "right" : "left" });
  } else {
    // tan: axis x = 1 with the point T(1; a). cot: axis y = 1 with the point S(a; 1). The line OT (OS) cuts the circle.
    const tan = form === "tan";
    const [px, py] = tan ? [1, a] : [a, 1];
    if (tan) line(ctx, X(1), Y(-e), X(1), Y(e), COLORS.purple, 1.5);
    else line(ctx, X(-e), Y(1), X(e), Y(1), COLORS.purple, 1.5);
    // the axis name goes to the end the point is not at
    if (tan) label(ctx, form, X(1) + 4, a < 0 ? Y(e) + size * 0.6 : Y(-e) - size * 0.6, { size, color: COLORS.purple });
    else label(ctx, form, a < 0 ? X(e) - 2 : X(-e) + 2, Y(1) - size * 0.8, { size, color: COLORS.purple, align: a < 0 ? "right" : "left" });
    const far = (e * 1.5) / Math.hypot(px, py);
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(-e), Y(e), 2 * e * k, 2 * e * k);
    ctx.clip();
    line(ctx, X(-px * far), Y(-py * far), X(px * far), Y(py * far), COLORS.orange, 2);
    ctx.restore();
    dot(ctx, X(px), Y(py), COLORS.orange, 3.5);
    if (tan) label(ctx, value, X(1) - 6, Y(a) + (a < 0 ? size * 0.8 : -size * 0.8), { size, color: COLORS.orange, bold: true, align: "right" });
    else label(ctx, value, X(a), Y(1) - size * 0.9, { size, color: COLORS.orange, bold: true, align: "center" });
  }

  // the points that represent the solutions, named by the angle of the formula
  for (const fam of families(form, a)) {
    for (let t = fam.base; t < fam.base + 2 * PI - 1e-9; t += fam.period) {
      const x = X(Math.cos(t));
      const y = Y(Math.sin(t));
      line(ctx, cx, cy, x, y, COLORS.red, 1.2, [4, 3]);
      dot(ctx, x, y, COLORS.red);
      const out = k + size * 1.3;
      // keep the label inside the box
      const text = angleText(t, s.unit);
      ctx.font = FONT(size, true);
      const w = ctx.measureText(text).width;
      const lx = cx + out * Math.cos(t) - (Math.cos(t) > 0.3 ? 0 : Math.cos(t) < -0.3 ? w : w / 2);
      label(ctx, text, Math.max(box.x, Math.min(box.x + box.w - w, lx)), cy - out * Math.sin(t), { size, color: COLORS.red, bold: true });
    }
  }
}

function drawGraph(ctx, s, box, small) {
  const { form, a, unit } = s;
  const [lo12, hi12] = INTERVALS[s.interval];
  const lo = (lo12 * PI) / 12;
  const hi = (hi12 * PI) / 12;
  const size = small ? 10 : 13;
  const left = box.x + (small ? 18 : 26);
  const right = box.x + box.w - 4;
  const top = box.y;
  const bottom = box.y + box.h - size * 1.5;
  const pad = (hi - lo) * 0.05;
  const X = x => left + ((x - lo + pad) / (hi - lo + 2 * pad)) * (right - left);
  const YM = 2.4;
  const Y = y => (top + bottom) / 2 - (y / YM) * ((bottom - top) / 2);

  ctx.fillStyle = "#fff";
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.fillStyle = "rgba(47, 111, 237, 0.08)"; // the interval the solutions are taken from
  ctx.fillRect(X(lo), top, X(hi) - X(lo), bottom - top);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, right - left, bottom - top);

  // x ticks at multiples of π/2, thinned out until the labels have room
  const step = [6, 12, 24].find(n => ((n * PI) / 12 / (hi - lo + 2 * pad)) * (right - left) >= (small ? 34 : 46)) ?? 24;
  for (let n = Math.ceil(lo12 / step) * step; n <= hi12; n += step) {
    const x = X((n * PI) / 12);
    line(ctx, x, top, x, bottom, COLORS.grid, 1);
    label(ctx, angleText((n * PI) / 12, unit), x, bottom + size * 0.8, { size, color: COLORS.muted, align: "center" });
  }
  for (const y of [-1, 1]) {
    line(ctx, left, Y(y), right, Y(y), COLORS.grid, 1, [4, 4]);
    label(ctx, y < 0 ? "−1" : "1", left - 4, Y(y), { size, color: COLORS.muted, align: "right" });
  }
  line(ctx, left, Y(0), right, Y(0), COLORS.muted, 1);
  label(ctx, "O", left - 4, Y(0), { size, color: COLORS.muted, align: "right" });

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, right - left, bottom - top);
  ctx.clip();
  if (form === "tan" || form === "cot") {
    // asymptotes: tan at π/2 + kπ, cot at kπ
    const shift = form === "tan" ? PI / 2 : 0;
    for (let n = Math.ceil((lo - pad - shift) / PI); shift + n * PI <= hi + pad; n++) {
      line(ctx, X(shift + n * PI), top, X(shift + n * PI), bottom, COLORS.muted, 1, [3, 4]);
    }
  }
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let prev = NaN;
  for (let px = left; px <= right; px += 0.5) {
    const y = f(form, lo - pad + ((px - left) / (right - left)) * (hi - lo + 2 * pad));
    const ok = Math.abs(y) < 50 && !(Math.abs(y - prev) > 4 && y * prev < 0); // a jump across an asymptote
    if (ok && Number.isFinite(prev) && Math.abs(prev) < 50) ctx.lineTo(px, Y(y));
    else ctx.moveTo(px, Y(y));
    prev = y;
  }
  ctx.stroke();
  line(ctx, left, Y(a), right, Y(a), COLORS.orange, 2);
  if (reveal(s)) {
    for (const sol of solutions(form, a, s.interval)) {
      line(ctx, X(sol.x), Y(a), X(sol.x), Y(0), COLORS.red, 1.2, [4, 3]);
      dot(ctx, X(sol.x), Y(a), COLORS.red);
      dot(ctx, X(sol.x), Y(0), COLORS.red, 2.5);
    }
  }
  ctx.restore();
  label(ctx, `y = ${form} x`, left + 6, top + size * 0.9, { size, color: COLORS.blue, bold: true });
  label(ctx, `y = ${aLabel(a)}`, right - 6, top + size * 0.9, { size, color: COLORS.orange, bold: true, align: "right" });
}

function drawText(ctx, s, box, size) {
  const lh = size * 1.32;
  let y = box.y + lh / 2;
  // word wrap inside the box
  const put = (text, opt = {}) => {
    ctx.font = FONT(opt.size ?? size, opt.bold);
    let row = "";
    const rows = [];
    for (const word of text.split(" ")) {
      const next = row ? `${row} ${word}` : word;
      if (row && ctx.measureText(next).width > box.w) {
        rows.push(row);
        row = word;
      } else row = next;
    }
    rows.push(row);
    for (const r of rows) {
      label(ctx, r, box.x, y, { size, ...opt });
      y += lh;
    }
  };
  const g = general(s.form, s.a, s.unit);
  put("Nghiệm tổng quát (k ∈ ℤ):", { color: COLORS.muted });
  if (g.none) put(g.note, { color: COLORS.red, bold: true });
  for (const text of g.lines) put(text, { color: COLORS.blue, bold: true, size: size + 1 });
  if (!g.none && g.note) put(g.note, { color: COLORS.muted, size: size - 1 });
  if (g.condition) put(`Điều kiện: ${g.condition}`, { color: COLORS.muted, size: size - 1 });
  y += lh * 0.3;
  const where = intervalText(s.interval, s.unit);
  if (!reveal(s)) {
    put(`Trên ${where} có bao nhiêu nghiệm?`, { bold: true });
    if (s.status === "wrong") put("Chưa đúng, hãy đếm lại.", { color: COLORS.red });
    return;
  }
  const list = solutions(s.form, s.a, s.interval, s.unit);
  if (s.practice) put("Đúng rồi!", { color: COLORS.green, bold: true });
  put(list.length ? `Trên ${where} có ${list.length} nghiệm:` : `Trên ${where}: không có nghiệm.`, { bold: true });
  if (list.length) {
    const exact = list.every(v => v.n12 !== null);
    const text = v => (v.n12 !== null ? angleText((v.n12 * PI) / 12, s.unit) : s.unit === "deg" ? `${num(v.x, 2)}°` : num(v.x, 3));
    put(`x ${exact ? "=" : "≈"} ${list.map(text).join("; ")}`, { color: COLORS.red, bold: true });
  }
}

mount({
  slug: "phuong-trinh-luong-giac",
  version: "1.0.0",
  title: "Phương trình lượng giác cơ bản",
  hint: "Chọn dạng phương trình rồi thay đổi a. Điểm đỏ trên đường tròn lượng giác và trên đồ thị là các nghiệm.",
  initialState,
  controls: [
    {
      type: "select",
      key: "form",
      label: "Dạng phương trình",
      options: FORMS.map(value => ({ value, label: `${value} x = a` })),
      onChange: unasked,
      onCommit: report,
    },
    {
      type: "select",
      key: "preset",
      label: "Giá trị đặc biệt của a",
      options: PRESETS.map(p => ({ value: p.value, label: p.label })),
      onChange(s) {
        const p = PRESETS.find(q => q.value === s.preset);
        if (p.a !== null) s.a = p.a;
        unasked(s);
      },
      onCommit: report,
    },
    {
      type: "slider",
      key: "a",
      label: "Giá trị a",
      min: A_MIN,
      max: A_MAX,
      step: 0.05,
      format: v => aLabel(v),
      onChange(s) {
        s.preset = PRESETS.find(p => p.a !== null && Math.abs(p.a - s.a) < 1e-9)?.value ?? "free";
        unasked(s);
      },
      onCommit: report,
    },
    {
      type: "select",
      key: "interval",
      label: "Xét nghiệm trên đoạn",
      options: Object.keys(INTERVALS).map(value => ({ value, label: intervalText(value) })),
      onChange: unasked,
      onCommit: report,
    },
    {
      type: "select",
      key: "unit",
      label: "Đơn vị góc",
      options: [
        { value: "rad", label: "Radian" },
        { value: "deg", label: "Độ" },
      ],
    },
    { type: "heading", label: "Luyện tập" },
    { type: "checkbox", key: "practice", label: "Tự đếm số nghiệm trên đoạn (ẩn đáp án)", onChange: unasked },
    {
      type: "stepper",
      key: "answer",
      label: "Số nghiệm trên đoạn",
      min: 0,
      max: 9,
      visible: s => s.practice,
      onChange(s) {
        s.status = "";
      },
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: s => s.practice,
      action(s, api) {
        const right = isCorrect(s);
        const first = right && s.status !== "right";
        s.status = right ? "right" : "wrong";
        api.emit("answer-checked", { answer: s.answer, correct: right ? 1 : 0 });
        if (first) {
          s.solved += 1;
          api.emit("count-correct", { form: code(s), a: s.a, count: s.answer, solved: s.solved }, "goal");
        }
      },
    },
    { type: "button", label: "Phương trình khác", visible: s => s.practice, action: s => newQuestion(s), event: "new-question" },
  ],
  readouts: [
    { label: "Phương trình", value: s => `${s.form} x = ${aLabel(s.a)}` },
    { label: "Số nghiệm trên đoạn", value: s => (reveal(s) ? String(count(s)) : "?") },
    { label: "Số phương trình đã đếm đúng", value: s => String(s.solved) },
  ],
  draw(ctx, s, view) {
    const small = view.w < 520 || view.h < 420;
    const size = small ? 12 : 15;
    const m = small ? 6 : 16;
    const head = small ? 22 : 40;
    label(ctx, `${s.form} x = ${aLabel(s.a)}`, view.w / 2, head / 2 + 1, { align: "center", bold: true, size: small ? 15 : 21 });

    const rowH = (view.h - head) * 0.5;
    const side = Math.min(rowH, view.w * 0.44);
    const gap = small ? 8 : 28;
    const textW = Math.min(view.w - 2 * m - side - gap, 380);
    const x0 = (view.w - side - gap - textW) / 2;
    drawCircle(ctx, s, { x: x0, y: head, w: side, h: rowH }, small);
    drawText(ctx, s, { x: x0 + side + gap, y: head + (small ? 0 : 12), w: textW }, size);
    const gy = head + rowH + (small ? 4 : 12);
    drawGraph(ctx, s, { x: m, y: gy, w: view.w - 2 * m, h: view.h - gy - (small ? 2 : 8) }, small);
  },
});
