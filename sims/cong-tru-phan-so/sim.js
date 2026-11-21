import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { MAX, MAX_WHOLE, ALL, initialState, read, normalize, solve, shownStage, check, newProblem, fracParts, mixedParts, operandParts } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ANIM_MS = 900;
const isFrac = p => typeof p === "object";
const practice = s => s.mode === "practice";

/** One line of text mixed with stacked fractions ({ n, d } parts). Shrinks to fit maxW. align: "center" | "left". */
function rich(ctx, parts, x, y, size, { color = COLORS.ink, bold = false, maxW = Infinity, align = "center" } = {}) {
  const weight = bold ? "600 " : "";
  const fonts = [`${weight}${size}px ${FONT}`, `${weight}${size * 0.88}px ${FONT}`];
  const widths = parts.map(p => {
    ctx.font = fonts[+isFrac(p)];
    return isFrac(p) ? Math.max(ctx.measureText(p.n).width, ctx.measureText(p.d).width) + size * 0.45 : ctx.measureText(p).width;
  });
  const total = widths.reduce((a, b) => a + b, 0);
  if (total > maxW && size > 7) return rich(ctx, parts, x, y, (size * maxW) / total - 0.2, { color, bold, align });
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(1, size / 13);
  let cx = align === "left" ? x : x - total / 2;
  parts.forEach((p, i) => {
    ctx.font = fonts[+isFrac(p)];
    if (isFrac(p)) {
      const mid = cx + widths[i] / 2;
      ctx.textAlign = "center";
      ctx.fillText(p.n, mid, y - size * 0.56);
      ctx.fillText(p.d, mid, y + size * 0.62);
      ctx.beginPath();
      ctx.moveTo(cx + 1.5, y);
      ctx.lineTo(cx + widths[i] - 1.5, y);
      ctx.stroke();
    } else {
      ctx.textAlign = "left";
      ctx.fillText(p, cx, y);
    }
    cx += widths[i];
  });
  ctx.restore();
}

/**
 * A fraction as paper strips: one strip per whole, each cut into `parts` equal pieces.
 * `fill(k)` gives the colour of piece k (null = empty, "cut" = taken away).
 * `old` = the earlier number of pieces per strip: its cuts are bold, the new cuts grow with t.
 */
function strips(ctx, { x, y, U, gap, bh, count, parts, fill, old = parts, t = 1, merge = parts }) {
  ctx.save();
  for (let u = 0; u < count; u++) {
    const left = x + u * (U + gap);
    for (let k = 0; k < parts; k++) {
      const c = fill(u * parts + k);
      if (!c) continue;
      ctx.fillStyle = c === "cut" ? "#fde2e2" : c;
      ctx.fillRect(left + (k * U) / parts, y, U / parts, bh);
      if (c === "cut") {
        ctx.strokeStyle = COLORS.red;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(left + (k * U) / parts + 2, y + 2);
        ctx.lineTo(left + ((k + 1) * U) / parts - 2, y + bh - 2);
        ctx.stroke();
      }
    }
    // cuts: those of the coarser division bold; the finer ones grow down from the top
    for (let k = 1; k < parts; k++) {
      const coarse = (k * old) % parts === 0 && (k * merge) % parts === 0;
      ctx.strokeStyle = COLORS.ink;
      ctx.globalAlpha = coarse ? 1 : 0.35;
      ctx.lineWidth = coarse ? 1.6 : 1;
      const fresh = (k * old) % parts !== 0;
      const len = fresh ? bh * t : bh;
      const xk = left + (k * U) / parts;
      ctx.beginPath();
      ctx.moveTo(xk, y);
      ctx.lineTo(xk, y + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(left, y, U, bh);
  }
  ctx.restore();
}

// ---------- events ----------
const OPCODE = { "+": 1, "-": -1 };
function report(s, api) {
  normalize(s);
  const r = solve(s);
  if (!r.result) return;
  api.emit("calculated", { operation: OPCODE[r.op], n1: r.a.n, d1: r.a.d, n2: r.b.n, d2: r.b.d, numerator: r.result.n, denominator: r.result.d }, "result");
}
const fresh = s => {
  s._ansN = "";
  s._ansD = "";
  s._status = "";
  s._tries = 0;
  s._solved = false;
};
function newPractice(s) {
  Object.assign(s, newProblem(Math.random, s.negative === true));
  s.stage = 0;
  s._anim = null;
  fresh(s);
}
function animate(s, api) {
  const anim = { stage: s.stage, start: performance.now() };
  s._anim = anim;
  const tick = () => {
    api.redraw();
    if (performance.now() - anim.start < ANIM_MS) requestAnimationFrame(tick);
    else if (s._anim === anim) s._anim = null;
  };
  requestAnimationFrame(tick);
}

const MESSAGES = {
  "": ["Viết kết quả là phân số tối giản rồi bấm “Kiểm tra”", COLORS.muted],
  correct: ["Đúng rồi! Giỏi quá!", COLORS.green],
  unsimplified: ["Đúng giá trị rồi, em rút gọn tiếp nhé", COLORS.orange],
  wrong: ["Chưa đúng, em thử lại nhé", COLORS.red],
  invalid: ["Em hãy viết tử số, và mẫu số khác 0", COLORS.red],
  revealed: ["Em đã xem lời giải. Bấm “Bài khác” để làm bài mới", COLORS.purple],
};
/** In practice, the last step was opened before the learner answered. */
const revealed = s => {
  const r = solve(s);
  return practice(s) && !s._solved && shownStage(s, r.steps) === r.steps.length - 1;
};

function answerBox(box, api) {
  box.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px";
  const field = (text, key) => {
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;font-size:13px";
    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.style.cssText = "min-height:52px;font-size:24px;font-weight:600;text-align:center;width:100%;box-sizing:border-box";
    input.addEventListener("input", () => {
      api.state[key] = input.value;
    });
    input.addEventListener("keydown", e => e.key === "Enter" && submit());
    wrap.append(text, input);
    box.append(wrap);
    return input;
  };
  const n = field("Tử số", "_ansN");
  const d = field("Mẫu số", "_ansD");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary";
  button.textContent = "Kiểm tra";
  button.style.cssText = "grid-column:1/3;min-height:52px;font-size:20px";
  box.append(button);
  function submit() {
    const s = api.state;
    const r = solve(s);
    if (s._solved || !r.result || revealed(s)) return;
    s._status = check(s._ansN, s._ansD, r.result);
    if (s._status === "correct") {
      s._solved = true;
      s.stage = ALL;
      api.emit("correct-answer", { operation: OPCODE[r.op], numerator: r.result.n, denominator: r.result.d, wrongTries: s._tries }, "goal");
    } else if (s._status !== "invalid") {
      s._tries += 1;
      api.emit("wrong-answer", { numerator: Number(s._ansN) || 0, denominator: Number(s._ansD) || 1 }, "action");
    }
    api.sync();
  }
  button.addEventListener("click", submit);
  return () => {
    const s = api.state;
    if (n.value !== (s._ansN ?? "")) n.value = s._ansN ?? "";
    if (d.value !== (s._ansD ?? "")) d.value = s._ansD ?? "";
    n.disabled = d.disabled = button.disabled = !!s._solved || revealed(s);
  };
}

const fractionSliders = (i, title) => [
  { type: "heading", label: title, visible: s => !practice(s) },
  { type: "stepper", key: `w${i}`, label: "Phần nguyên", min: 0, max: MAX_WHOLE, visible: s => !practice(s) && s.mixed, onCommit: report },
  { type: "slider", key: `n${i}`, label: "Tử số", min: 0, max: MAX, step: 1, digits: 0, visible: s => !practice(s), onCommit: report },
  { type: "slider", key: `d${i}`, label: "Mẫu số", min: 1, max: MAX, step: 1, digits: 0, visible: s => !practice(s), onCommit: report },
];

mount({
  slug: "cong-tru-phan-so",
  version: "1.0.0",
  title: "Cộng, trừ phân số",
  hint: "Muốn cộng hay trừ hai phân số khác mẫu số, ta quy đồng mẫu số rồi cộng (trừ) hai tử số. Bấm “Bước tiếp” để xem từng bước.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "explore", label: "Xem cách làm" },
        { value: "practice", label: "Luyện tập" },
      ],
      onChange: s => {
        if (practice(s)) newPractice(s);
        else fresh(s);
      },
    },
    {
      type: "select",
      key: "op",
      label: "Phép tính",
      visible: s => !practice(s),
      options: [
        { value: "+", label: "Cộng (+)" },
        { value: "-", label: "Trừ (−)" },
      ],
      onCommit: report,
    },
    ...fractionSliders(1, "Phân số thứ nhất"),
    ...fractionSliders(2, "Phân số thứ hai"),
    { type: "checkbox", key: "mixed", label: "Dùng hỗn số", visible: s => !practice(s), onCommit: report },
    { type: "checkbox", key: "negative", label: "Lớp 6: cho phép kết quả âm", onCommit: (s, api) => (practice(s) ? newPractice(s) : report(s, api)) },
    { type: "custom", render: answerBox, visible: practice },
    {
      type: "button",
      label: "Bài khác",
      visible: practice,
      event: "new-problem",
      action: newPractice,
    },
    { type: "heading", label: "Các bước" },
    {
      type: "button",
      label: "Bước tiếp ▶",
      primary: true,
      disabled: s => shownStage(s) >= solve(s).steps.length - 1,
      action: (s, api) => {
        const r = solve(s);
        s.stage = Math.min(shownStage(s, r.steps) + 1, r.steps.length - 1);
        animate(s, api);
        api.emit("next-step", { stage: s.stage, steps: r.steps.length - 1 }, "action");
        if (s.stage === r.steps.length - 1 && practice(s)) report(s, api); // the learner chose to see the answer
      },
    },
    {
      type: "button",
      label: "Xem lại từ đầu",
      disabled: s => shownStage(s) === 0,
      event: "restart-steps",
      action: s => {
        s.stage = 0;
        s._anim = null;
      },
    },
  ],
  readouts: [
    {
      label: "Kết quả",
      value: s => {
        const r = solve(s);
        if (!r.result) return "–";
        if (practice(s) && !s._solved && shownStage(s, r.steps) < r.steps.length - 1) return "?";
        const t = p => p.map(q => (isFrac(q) ? `${q.n}/${q.d}` : q)).join(" ");
        return t(fracParts(r.result)) + (r.mixed && r.result.d !== 1 && Math.abs(r.result.n) > r.result.d ? ` = ${t(mixedParts(r.result))}` : "");
      },
    },
    { label: "Mẫu số chung", value: s => String(solve(s).D ?? "–") },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 520 || h < 440;
    const r = solve(s);
    const last = r.steps.length - 1;
    const stage = shownStage(s, r.steps);
    const kinds = r.steps.slice(0, stage + 1).map(x => x.kind);
    const anim = s._anim && s._anim.stage === stage ? s._anim : null;
    const t = anim ? Math.min(1, (performance.now() - anim.start) / ANIM_MS) : 1;
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const justNow = kind => r.steps[stage].kind === kind;
    const split = kinds.includes("common");
    const computed = kinds.includes("compute");
    const simplified = kinds.includes("simplify");
    const reveal = stage === last && r.result;

    // header: the problem, with the answer once every step is shown
    const big = small ? 18 : 28;
    const head = [...operandParts(r.A, r.mixed), r.op === "+" ? " + " : " − ", ...operandParts(r.B, r.mixed), " = "];
    head.push(...(reveal ? (r.mixed ? mixedParts(r.result) : fracParts(r.result)) : ["?"]));
    rich(ctx, head, w / 2, small ? 26 : 42, big, { bold: true, color: reveal ? COLORS.blue : COLORS.ink, maxW: w - 16 });
    let y = small ? 54 : 84;
    if (practice(s)) {
      const [text, color] = MESSAGES[revealed(s) ? "revealed" : s._status || ""];
      label(ctx, text, w / 2, y - (small ? 4 : 6), { align: "center", size: small ? 12 : 16, bold: true, color });
      y += small ? 12 : 16;
    }

    // written steps at the bottom: as many of the latest ones as fit
    const fs = small ? 11 : 15;
    const lineH = fs * 2.6;
    const titleH = fs * 1.6;
    const stepsH = small ? Math.max(60, h * 0.3) : Math.min(h * 0.46, 340);
    const blocks = [];
    let used = 0;
    for (let i = stage; i >= 1; i--) {
      const need = titleH + r.steps[i].lines.length * lineH;
      if (used + need > stepsH && blocks.length) break;
      blocks.unshift(i);
      used += need;
    }
    let sy = h - used - (small ? 4 : 10);
    if (!blocks.length) {
      label(ctx, "Bấm “Bước tiếp” để làm từng bước", w / 2, h - stepsH / 2, { align: "center", size: fs + 1, color: COLORS.muted });
      sy = h - stepsH;
    }
    const x0 = small ? 8 : 24;
    const stepsTop = sy;
    for (const i of blocks) {
      const step = r.steps[i];
      ctx.globalAlpha = i === stage ? 0.25 + 0.75 * ease : 1;
      const color = step.kind === "blocked" ? COLORS.red : i === stage ? COLORS.purple : COLORS.muted;
      const title = step.kind === "blocked" ? step.title : `Bước ${i}: ${step.title}`;
      ctx.font = `600 ${fs}px ${FONT}`;
      const tw = ctx.measureText(title).width;
      label(ctx, title, x0, sy + titleH / 2, { size: tw > w - 2 * x0 ? Math.max(8, (fs * (w - 2 * x0)) / tw) : fs, bold: true, color });
      sy += titleH;
      for (const line of step.lines) {
        rich(ctx, line, x0 + (small ? 6 : 16), sy + lineH / 2, fs + 1, { align: "left", maxW: w - 2 * x0 - 16 });
        sy += lineH;
      }
      ctx.globalAlpha = 1;
    }

    // paper strips: A, B and the result share one length for "1"
    const value = f => Math.abs(f.n / f.d);
    const res = r.result ?? { n: 0, d: 1 };
    const units = Math.max(1, Math.ceil(Math.max(value(r.a), value(r.b), computed ? value(r.raw) : 0) - 1e-9));
    const labelW = small ? 46 : 78;
    const top = y + (small ? 2 : 8);
    const bottom = stepsTop - (small ? 8 : 16);
    const rowH = (bottom - top) / 3;
    if (rowH < 18) return;
    const bh = Math.min(small ? 30 : 52, rowH * 0.62);
    const gap = units > 1 ? Math.min(10, (w - labelW) * 0.02) : 0;
    const U = Math.min((w - labelW - (small ? 10 : 30) - gap * (units - 1)) / units, small ? 260 : 420);
    const bx = labelW + (small ? 2 : 8);
    const cnt = f => Math.max(1, Math.ceil(value(f) - 1e-9));
    const rows = [
      { f: r.a, now: split ? r.a2 : r.a, color: COLORS.blue },
      { f: r.b, now: split ? r.b2 : r.b, color: COLORS.orange },
    ];
    rows.forEach((row, i) => {
      const cy = top + rowH * (i + 0.5);
      rich(ctx, fracParts(row.now), labelW / 2, cy, small ? 13 : 19, { color: row.color, bold: true, maxW: labelW - 4 });
      const parts = row.now.d;
      const grow = split && justNow("common");
      strips(ctx, { x: bx, y: cy - bh / 2, U, gap, bh, count: cnt(row.f), parts, old: row.f.d, t: grow ? ease : 1, fill: k => (k < row.now.n ? row.color : null) });
      if (grow && row.f.d !== parts && t < 1) {
        const k = parts / row.f.d;
        label(ctx, `chia mỗi phần thành ${k}`, bx + 4, cy - bh / 2 - (small ? 7 : 10), { size: small ? 10 : 13, color: COLORS.purple, bold: true });
      }
    });

    // result row
    const cy = top + rowH * 2.5;
    if (!computed || !r.result) {
      label(ctx, "?", labelW / 2, cy, { align: "center", size: small ? 18 : 26, bold: true, color: COLORS.muted });
      return;
    }
    const D = r.D;
    const a = r.a2.n;
    const b = r.b2.n;
    const neg = r.raw.n < 0;
    const shownFrac = simplified ? res : r.raw;
    rich(ctx, fracParts(shownFrac), labelW / 2, cy, small ? 13 : 19, { color: neg ? COLORS.red : COLORS.green, bold: true, maxW: labelW - 4 });
    const k0 = justNow("compute") ? ease : 1; // pieces appear one after another
    let count;
    let fill;
    if (r.op === "+") {
      count = Math.max(1, Math.ceil((a + b) / D - 1e-9));
      fill = k => (k >= (a + b) * k0 ? null : k < a ? COLORS.blue : COLORS.orange);
    } else if (!neg) {
      count = Math.max(1, Math.ceil(a / D - 1e-9));
      fill = k => (k >= a ? null : k >= a - b * k0 ? "cut" : COLORS.green);
    } else {
      count = Math.max(1, Math.ceil(-r.raw.n / D - 1e-9));
      fill = k => (k < -r.raw.n * k0 ? COLORS.red : null);
    }
    const merge = simplified && res.d !== 0 ? res.d : D;
    strips(ctx, { x: bx, y: cy - bh / 2, U, gap, bh, count, parts: D, merge, fill });
    const note = neg ? "kết quả âm: số trừ lớn hơn số bị trừ" : r.op === "-" ? "phần gạch chéo là phần bớt đi" : "";
    if (note && rowH > bh + 26) label(ctx, note, bx, cy + bh / 2 + (small ? 8 : 11), { size: small ? 10 : 12, color: neg ? COLORS.red : COLORS.muted });
    if (simplified && res.d !== D && rowH > bh + 26 && !note)
      label(ctx, `nét đậm: ${res.d} phần bằng nhau mỗi băng`, bx, cy + bh / 2 + (small ? 8 : 11), { size: small ? 10 : 12, color: COLORS.muted });
  },
});
