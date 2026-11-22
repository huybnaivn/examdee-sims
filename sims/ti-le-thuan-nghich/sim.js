import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, SCENARIOS, SCENARIO_KEYS, X_RANGE, table, answerOf, graphKind, DIRECT, INVERSE, NEITHER } from "./model.js";

const X_MAX = 13; // graph domain 0…13

// Tick step (1, 2, 2,5 or 5 × 10ⁿ) giving about five gridlines up to v.
const niceStep = v => {
  const p = 10 ** Math.floor(Math.log10(v / 5));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(n => n >= v / 5);
};

// One result per finished change of the table.
function report(s, api) {
  const t = table(s);
  api.emit("table-classified", { type: t.type, constant: Number.isFinite(t.constant) ? t.constant : 0, scenario: SCENARIO_KEYS.indexOf(s.scenario) + 1 }, "result");
}

function verdict(t, sc) {
  if (t.type === DIRECT) return [`y/x = ${fmt(t.constant)} không đổi ⇒ y tỉ lệ thuận với x, k = ${fmt(t.constant)}: y = ${fmt(t.constant)}x`, COLORS.green];
  if (t.type === INVERSE) return [`x·y = ${fmt(t.constant)} không đổi ⇒ y tỉ lệ nghịch với x, a = ${fmt(t.constant)}: y = ${fmt(t.constant)}/x`, COLORS.blue];
  if (t.type === NEITHER) return ["y/x và x·y đều thay đổi ⇒ y không tỉ lệ thuận, cũng không tỉ lệ nghịch với x", COLORS.red];
  return [`Chọn ít nhất hai giá trị khác nhau của x (${sc.xu})`, COLORS.muted];
}

function drawTable(ctx, t, sc, g) {
  const { x, y, w, rowH, first, small } = g.table;
  const rows = [
    [small ? "x" : `x (${sc.xu})`, t.x, null],
    [small ? "y" : `y (${sc.yu})`, t.y, null],
    ["y/x", t.ratio, t.type === DIRECT ? COLORS.green : null],
    ["x·y", t.product, t.type === INVERSE ? COLORS.blue : null],
  ];
  const cw = (w - first) / 4;
  const size = small ? 12 : 14;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, rowH * rows.length);
  rows.forEach(([name, vals, hi], r) => {
    const cy = y + rowH * (r + 0.5);
    if (hi) {
      ctx.fillStyle = hi === COLORS.green ? "rgba(31, 157, 107, 0.14)" : "rgba(47, 111, 237, 0.14)";
      ctx.fillRect(x, y + rowH * r, w, rowH);
    } else if (r === 0) {
      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(x, y, w, rowH);
    }
    label(ctx, name, x + 8, cy, { size, color: r < 2 ? COLORS.ink : COLORS.muted, bold: r < 2 });
    vals.forEach((v, i) => label(ctx, fmt(v, 2), x + first + cw * (i + 0.5), cy, { size, align: "center", bold: !!hi, color: hi ?? COLORS.ink }));
  });
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, rowH * rows.length);
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + first + cw * i, y);
    ctx.lineTo(x + first + cw * i, y + rowH * rows.length);
    ctx.stroke();
  }
}

function drawGraph(ctx, s, t, sc, box, small) {
  const kind = graphKind(s.scenario);
  const top = Math.max(...Array.from({ length: X_MAX + 1 }, (_, i) => (i ? sc.f(i) : kind === "line" ? sc.f(0) : 0)));
  const yStep = niceStep(top);
  const yMax = Math.ceil(top / yStep) * yStep;
  const px = v => box.x + (v / X_MAX) * box.w;
  const py = v => box.y + box.h - (v / yMax) * box.h;
  const size = small ? 10 : 12;

  // grid and axes
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i * yStep <= yMax + 1e-9; i++) {
    ctx.beginPath();
    ctx.moveTo(box.x, py(i * yStep));
    ctx.lineTo(box.x + box.w, py(i * yStep));
    ctx.stroke();
    label(ctx, fmt(i * yStep, 1), box.x - 4, py(i * yStep), { size, align: "right", color: COLORS.muted });
  }
  for (let v = 2; v <= 12; v += 2) {
    ctx.beginPath();
    ctx.moveTo(px(v), box.y);
    ctx.lineTo(px(v), box.y + box.h);
    ctx.stroke();
    label(ctx, String(v), px(v), box.y + box.h + 9, { size, align: "center", color: COLORS.muted });
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y - 6);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w + 6, box.y + box.h);
  ctx.stroke();
  label(ctx, "O", box.x - 4, box.y + box.h + 9, { size, align: "right" });
  label(ctx, "x", box.x + box.w + 8, box.y + box.h, { size: size + 2, bold: true });
  label(ctx, "y", box.x + 8, box.y - 4, { size: size + 2, bold: true });

  // the situation's graph: a line through O, a hyperbola branch, or a line that misses O
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y - 2, box.w + 2, box.h + 2);
  ctx.clip();
  ctx.strokeStyle = kind === "hyperbola" ? COLORS.blue : kind === "line" ? COLORS.red : COLORS.green;
  ctx.lineWidth = 2;
  if (kind === "line") ctx.setLineDash([6, 5]);
  ctx.beginPath();
  const x0 = kind === "hyperbola" ? sc.f(1) / yMax : 0; // y = a/x enters the box at y = yMax
  for (let i = 0; i <= 200; i++) {
    const v = x0 + ((X_MAX - x0) * i) / 200;
    const fy = sc.f(v);
    if (i) ctx.lineTo(px(v), py(fy));
    else ctx.moveTo(px(v), py(fy));
  }
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = COLORS.orange;
  t.x.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(px(v), py(t.y[i]), small ? 4 : 5, 0, Math.PI * 2);
    ctx.fill();
  });
  const name = kind === "line-origin" ? "đường thẳng qua O" : kind === "hyperbola" ? "đường cong y = a/x (x > 0)" : "đường thẳng không qua O";
  label(ctx, name, box.x + box.w, box.y + 6, { size: size + 1, align: "right", bold: true, color: ctx.strokeStyle });
  if (!small) label(ctx, "Hai trục có đơn vị khác nhau.", box.x + box.w, box.y + 24, { size, align: "right", color: COLORS.muted });
}

mount({
  slug: "ti-le-thuan-nghich",
  version: "1.0.0",
  title: "Đại lượng tỉ lệ thuận và tỉ lệ nghịch",
  hint: "Chọn tình huống, điền bốn giá trị của x vào bảng. Xem y/x hay x·y không đổi, rồi tính giá trị y còn thiếu.",
  initialState,
  controls: [
    { type: "select", key: "scenario", label: "Tình huống", options: SCENARIO_KEYS.map(k => ({ value: k, label: SCENARIOS[k].label })), onCommit: report, onChange: s => (s._fb = null) },
    { type: "heading", label: "Điền giá trị x vào bảng" },
    ...["x1", "x2", "x3", "x4"].map((key, i) => ({ type: "stepper", key, label: `x${"₁₂₃₄"[i]}`, min: X_RANGE[0], max: X_RANGE[1], step: 1, onCommit: report })),
    { type: "heading", label: "Tìm giá trị còn thiếu" },
    {
      type: "slider",
      key: "answer",
      label: "Giá trị y em tính được",
      min: 0,
      max: 200,
      step: 1,
      format: (v, s) => `${fmt(v, 0)} ${SCENARIOS[s.scenario].yu}`,
      onChange: s => (s._fb = null),
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      action(s, api) {
        const ok = s.answer === answerOf(s.scenario);
        s._fb = ok;
        api.emit("check-answer", { answer: s.answer, correct: ok ? 1 : 0 }, "action");
        if (ok) api.emit("missing-value-found", { x: SCENARIOS[s.scenario].ask, y: s.answer, scenario: SCENARIO_KEYS.indexOf(s.scenario) + 1 }, "goal");
      },
    },
    { type: "checkbox", key: "showGraph", label: "Vẽ các điểm và đồ thị" },
  ],
  readouts: [
    { label: "x", value: s => SCENARIOS[s.scenario].x },
    { label: "y", value: s => SCENARIOS[s.scenario].y },
  ],
  draw(ctx, s, view) {
    const sc = SCENARIOS[s.scenario];
    const t = table(s);
    const small = view.w < 560 || view.h < 430;
    const size = small ? 12 : 15;
    const pad = small ? 8 : 20;
    let y = small ? 12 : 22;

    // the question, and the feedback once checked
    const q = `Biết x = ${sc.known} thì y = ${fmt(sc.f(sc.known))}. Khi x = ${sc.ask} thì y = ?`;
    label(ctx, q, pad, y, { size, bold: true });
    if (s._fb != null) {
      ctx.font = `600 ${size}px system-ui, sans-serif`;
      const right = pad + ctx.measureText(q).width + 10;
      const text = s._fb ? `Đúng: y = ${fmt(s.answer)}` : "Chưa đúng";
      const fits = right + ctx.measureText(text).width < view.w - 4;
      label(ctx, text, fits ? right : view.w - pad, fits ? y : y + size + 4, { size, bold: true, align: fits ? "left" : "right", color: s._fb ? COLORS.green : COLORS.red });
      if (!fits) y += size + 4;
    }
    y += small ? 10 : 18;

    const rowH = small ? 19 : 28;
    const w = Math.min(view.w - 2 * pad, 640);
    const tb = { x: (view.w - w) / 2, y, w, rowH, first: small ? 44 : 150, small };
    drawTable(ctx, t, sc, { table: tb });
    y += rowH * 4 + (small ? 13 : 22);

    const [text, color] = verdict(t, sc);
    const vsize = small ? 11 : 14;
    ctx.font = `600 ${vsize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    // too wide for the stage: break before "⇒"
    const lines = ctx.measureText(text).width > view.w - 12 ? text.replace(" ⇒ ", "\n⇒ ").split("\n") : [text];
    lines.forEach((line, i) => label(ctx, line, view.w / 2, y + i * (vsize + 3), { size: vsize, align: "center", bold: true, color }));
    y += (lines.length - 1) * (vsize + 3) + (small ? 16 : 30);

    if (s.showGraph) {
      const left = small ? 34 : 56;
      const box = { x: left, y: y + 8, w: Math.min(view.w - left - (small ? 18 : 40), 700), h: view.h - y - 8 - (small ? 18 : 30) };
      if (box.h > 60) drawGraph(ctx, s, t, sc, box, small);
    }
  },
});
