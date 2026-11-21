import { mount, COLORS, label, arrow } from "../../kit/v1/kit.js";
import { QUANTITIES, KEYS, MAX_NUM, MAX_DEC, initialState, unitOptions, qIndex, read, factor, convert, inputValue, format, placeDigits, rule, check, newQuestion, toNumber } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ANIM_MS = 1100;
const practice = s => s.mode === "practice";

function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: opts.align ?? "center", size: w > maxW ? Math.max(8, (size * maxW) / w) : size });
}

/** Everything the view and the events need about the current conversion. */
function current(s) {
  const r = read(s);
  const value = inputValue(r.num, r.dec);
  const result = convert(r.qi, r.from, r.to, value);
  return { ...r, value, result, valueText: format(value), resultText: format(result) };
}

function animate(s, api) {
  const anim = { start: performance.now() };
  s._anim = anim;
  const tick = () => {
    api.redraw();
    if (performance.now() - anim.start < ANIM_MS) requestAnimationFrame(tick);
    else if (s._anim === anim) s._anim = null;
  };
  requestAnimationFrame(tick);
}

function report(s, api) {
  const c = current(s);
  api.emit("converted", { quantity: c.qi, from: c.from, to: c.to, value: toNumber(c.value), result: toNumber(c.result) }, "result");
  animate(s, api);
}

const fresh = s => {
  s._answer = "";
  s._status = "";
  s._tries = 0;
  s._solved = false;
};
function nextQuestion(s, api) {
  const c = current(s);
  const q = newQuestion(Math.random, c.qi, { from: c.from, to: c.to, num: c.num, dec: c.dec });
  const [kf, kt] = KEYS[c.qi];
  Object.assign(s, { [kf]: q.from, [kt]: q.to, num: q.num, dec: q.dec });
  fresh(s);
  if (api) animate(s, api);
}

const MESSAGES = {
  "": ["Viết kết quả rồi bấm “Kiểm tra”", COLORS.muted],
  correct: ["Đúng rồi! Giỏi quá!", COLORS.green],
  wrong: ["Chưa đúng, em xem lại bảng đơn vị nhé", COLORS.red],
  invalid: ["Em hãy viết một số, dùng dấu phẩy cho phần thập phân", COLORS.red],
};

function answerBox(box, api) {
  box.style.cssText = "display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end";
  const wrap = document.createElement("label");
  wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;font-size:13px";
  const unit = document.createElement("span");
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.style.cssText = "min-height:52px;font-size:24px;font-weight:600;text-align:center;width:100%;box-sizing:border-box";
  input.addEventListener("input", () => {
    api.state._answer = input.value;
  });
  input.addEventListener("keydown", e => e.key === "Enter" && submit());
  wrap.append(unit, input);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary";
  button.textContent = "Kiểm tra";
  button.style.cssText = "min-height:52px;font-size:18px;padding:0 16px";
  box.append(wrap, button);
  function submit() {
    const s = api.state;
    if (s._solved) return;
    const c = current(s);
    s._status = check(s._answer, c.result);
    const data = { quantity: c.qi, from: c.from, to: c.to, value: toNumber(c.value), result: toNumber(c.result) };
    if (s._status === "correct") {
      s._solved = true;
      api.emit("correct-answer", { ...data, wrongTries: s._tries }, "goal");
      animate(s, api);
    } else if (s._status === "wrong") {
      s._tries += 1;
      api.emit("wrong-answer", { ...data, answer: Number(String(s._answer).replace(/\s/g, "").replace(",", ".")) || 0 }, "action");
    }
    api.sync();
  }
  button.addEventListener("click", submit);
  return () => {
    const s = api.state;
    const c = current(s);
    unit.textContent = `${c.valueText} ${c.fromUnit} = … ${c.toUnit}`;
    if (input.value !== (s._answer ?? "")) input.value = s._answer ?? "";
    input.disabled = button.disabled = !!s._solved;
  };
}

/** "Từ km sang m: …" or the factor in words. */
function explain(c, hide) {
  const big = Math.min(c.from, c.to);
  const small = Math.max(c.from, c.to);
  const f = factor(c.qi, big, small);
  const n = format(f);
  const unitName = col => (c.from === col ? c.fromUnit : c.to === col ? c.toUnit : c.q.units[col]);
  const one = `1 ${unitName(big)} = ${n} ${unitName(small)}`;
  if (c.from === c.to) return "Cùng một đơn vị: số đo giữ nguyên";
  if (hide) return `Gợi ý: ${one}`;
  const op = c.to > c.from ? "×" : ":";
  const say = `${one} nên ${c.valueText} ${c.fromUnit} = ${c.valueText} ${op} ${n} = ${c.resultText.replace("≈ ", "")} ${c.toUnit}`;
  return c.resultText.startsWith("≈") ? say.replace(" = " + c.resultText.replace("≈ ", ""), " ≈ " + c.resultText.replace("≈ ", "")) : say;
}

function shift(c) {
  const k = c.q.step === 100 ? 2 : 1;
  const places = Math.abs(c.to - c.from) * k;
  const dir = c.to > c.from ? "phải" : "trái";
  return `Dời dấu phẩy sang ${dir} ${places} chữ số${k === 2 ? " (mỗi đơn vị đo diện tích ứng với 2 chữ số)" : ""}`;
}

const unitSelects = QUANTITIES.flatMap((q, qi) =>
  KEYS[qi].map((key, j) => ({
    type: "select",
    key,
    label: j ? "Sang đơn vị" : "Đổi từ đơn vị",
    options: unitOptions(qi).map(o => ({ value: o.value, label: o.label })),
    visible: s => !practice(s) && qIndex(s) === qi,
    onCommit: report,
  }))
);

mount({
  slug: "doi-don-vi-do",
  version: "1.0.0",
  title: "Đổi đơn vị đo",
  hint: "Chọn đại lượng, số đo và hai đơn vị. Bảng đơn vị cho thấy dấu phẩy dời đi bao nhiêu chữ số khi đổi.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "explore", label: "Xem cách đổi" },
        { value: "practice", label: "Luyện tập" },
      ],
      onChange: (s, api) => (practice(s) ? nextQuestion(s, api) : fresh(s)),
    },
    {
      type: "select",
      key: "qty",
      label: "Đại lượng",
      options: QUANTITIES.map(q => ({ value: q.key, label: q.name })),
      onCommit: (s, api) => (practice(s) ? nextQuestion(s, api) : report(s, api)),
    },
    { type: "slider", key: "num", label: "Số đo", min: 1, max: MAX_NUM, step: 1, format: (v, s) => format(inputValue(v, s.dec)), visible: s => !practice(s), onCommit: report },
    { type: "stepper", key: "dec", label: "Chữ số sau dấu phẩy", min: 0, max: MAX_DEC, visible: s => !practice(s), onCommit: report },
    ...unitSelects,
    {
      type: "button",
      label: "⇄ Đổi ngược lại",
      visible: s => !practice(s),
      action: (s, api) => {
        const [kf, kt] = KEYS[qIndex(s)];
        [s[kf], s[kt]] = [s[kt], s[kf]];
        report(s, api);
      },
    },
    { type: "custom", render: answerBox, visible: practice },
    { type: "button", label: "Câu khác", primary: true, visible: practice, event: "new-question", action: (s, api) => nextQuestion(s, api) },
  ],
  readouts: [
    { label: "Kết quả", value: s => (c => (practice(s) && !s._solved ? `${c.valueText} ${c.fromUnit} = ? ${c.toUnit}` : `${c.valueText} ${c.fromUnit} = ${c.resultText} ${c.toUnit}`))(current(s)) },
    { label: "Quy tắc", value: s => rule(qIndex(s)) },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 560 || h < 440;
    const c = current(s);
    const hide = practice(s) && !s._solved;
    const anim = s._anim ? Math.min(1, (performance.now() - s._anim.start) / ANIM_MS) : 1;
    const ease = anim < 0.5 ? 2 * anim * anim : 1 - (-2 * anim + 2) ** 2 / 2;
    const pad = small ? 8 : 24;

    // text: the conversion, the rule, the reason
    let y = small ? 20 : 34;
    const eq = `${c.valueText} ${c.fromUnit} = ${hide ? "?" : c.resultText} ${c.toUnit}`;
    fit(ctx, eq, w / 2, y, small ? 22 : 34, w - 2 * pad, { bold: true, color: hide ? COLORS.ink : COLORS.blue });
    y += small ? 22 : 34;
    if (practice(s)) {
      const [text, color] = MESSAGES[s._status || ""];
      fit(ctx, text, w / 2, y, small ? 12 : 16, w - 2 * pad, { bold: true, color });
      y += small ? 17 : 24;
    }
    fit(ctx, rule(c.qi), w / 2, y, small ? 11 : 15, w - 2 * pad, { color: COLORS.muted });
    y += small ? 16 : 24;
    fit(ctx, explain(c, hide), w / 2, y, small ? 12 : 16, w - 2 * pad, { bold: true, color: COLORS.purple });
    const base10 = !c.q.factors;
    if (base10 && !hide && c.from !== c.to) {
      y += small ? 16 : 24;
      fit(ctx, shift(c), w / 2, y, small ? 11 : 14, w - 2 * pad, { color: COLORS.muted });
    }

    // the table
    const n = c.q.units.length;
    const t = base10 ? placeDigits(c.qi, c.from, c.to, c.num, c.dec) : null;
    const colOfSlot = slot => Math.floor(slot / t.k);
    const c0 = t ? Math.min(0, colOfSlot(t.lo)) : 0;
    const c1 = t ? Math.max(n - 1, colOfSlot(t.hi)) : n - 1;
    const cols = c1 - c0 + 1;
    const colW = Math.min(small ? 70 : 112, (w - 2 * pad) / cols);
    const tx = (w - cols * colW) / 2;
    const X = col => tx + (col - c0) * colW;
    const ruleH = small ? 20 : 30;
    const headH = small ? 28 : 40;
    const rowH = small ? 40 : 64;
    const free = h - y - (small ? 12 : 24);
    const top = y + Math.max(small ? 10 : 18, (free - ruleH - headH - rowH) / 3);
    const head = top + ruleH;
    const row = head + headH;

    // rule arrows between neighbouring columns: × going right (smaller unit), : going left
    const fsz = small ? 10 : 13;
    for (let i = 0; i < n - 1; i++) {
      const f = c.q.factors ? c.q.factors[i] : c.q.step;
      if (colW < 34) break;
      const xm = X(i + 1);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(xm - colW * 0.38, head - 3);
      ctx.quadraticCurveTo(xm, head - ruleH * 0.8, xm + colW * 0.38, head - 3);
      ctx.stroke();
      label(ctx, `×${f}`, xm, head - ruleH * 0.72, { align: "center", size: fsz, color: COLORS.muted, bold: true });
    }

    // header: unit names, the two chosen units coloured
    for (let col = c0; col <= c1; col++) {
      const real = col >= 0 && col < n;
      const x = X(col);
      const mark = real && col === c.to ? COLORS.green : real && col === c.from ? COLORS.blue : null;
      ctx.fillStyle = mark ? mark + "22" : real ? "#fff" : COLORS.bg;
      ctx.fillRect(x, head, colW, headH + rowH);
      ctx.strokeStyle = real ? COLORS.grid : "#c9d2e3";
      ctx.lineWidth = 1;
      ctx.setLineDash(real ? [] : [4, 4]);
      ctx.strokeRect(x, head, colW, headH);
      ctx.strokeRect(x, row, colW, rowH);
      ctx.setLineDash([]);
      let name = real ? c.q.units[col] : "";
      if (real && c.q.key === "area" && col === 1) name = colW > 60 ? "hm² (ha)" : "ha";
      fit(ctx, name, x + colW / 2, head + headH / 2, small ? 12 : 16, colW - 4, { bold: true, color: mark ?? COLORS.ink });
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X(0), head, n * colW, headH + rowH);

    if (t) {
      // digits: the input's digits stay; added zeros appear; the comma slides to the end of the `to` column
      const slotW = colW / t.k;
      const SX = slot => X(0) + (slot + 0.5) * slotW;
      const edge = slot => X(0) + (slot + 1) * slotW;
      const ds = Math.min(small ? 22 : 34, slotW * 0.75);
      const moved = hide ? 0 : ease;
      for (const d of t.slots) {
        if (d.added && (hide || moved < 0.75)) continue;
        const color = d.silent && !hide ? "#b8c2d6" : d.added ? COLORS.green : COLORS.ink;
        label(ctx, d.digit, SX(d.slot), row + rowH / 2, { align: "center", size: ds, bold: !d.silent || hide, color });
      }
      if (t.k === 2) {
        ctx.strokeStyle = COLORS.grid;
        ctx.setLineDash([3, 3]);
        for (let col = c0; col <= c1; col++) {
          ctx.beginPath();
          ctx.moveTo(X(col) + colW / 2, row + 6);
          ctx.lineTo(X(col) + colW / 2, row + rowH - 6);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      const cx = edge(t.inputComma) + (edge(t.comma) - edge(t.inputComma)) * moved;
      const written = !/^[^,]*$/.test(hide ? c.valueText : c.resultText) || moved < 1;
      ctx.globalAlpha = written ? 1 : 0.35;
      label(ctx, ",", cx, row + rowH * 0.62, { align: "center", size: ds * 1.3, bold: true, color: COLORS.red });
      ctx.globalAlpha = 1;
      if (Math.abs(t.comma - t.inputComma) > 0 && !hide && moved < 1) arrow(ctx, edge(t.inputComma), row + rowH + 10, cx, row + rowH + 10, COLORS.red, 2);
    } else {
      // time: the value hops column by column, multiplied or divided at each hop
      const step = c.to >= c.from ? 1 : -1;
      const path = [];
      for (let col = c.from; ; col += step) {
        path.push(col);
        if (col === c.to) break;
      }
      const shown = hide ? 1 : Math.max(1, Math.ceil(ease * path.length - 1e-9));
      path.forEach((col, i) => {
        const x = X(col) + colW / 2;
        if (i > 0 && (hide || i < shown)) {
          const f = c.q.factors[Math.min(col, path[i - 1])];
          label(ctx, `${step > 0 ? "×" : ":"} ${f}`, x - (step * colW) / 2, row + rowH * 0.18, { align: "center", size: fsz, bold: true, color: COLORS.purple });
        }
        if (hide ? i > 0 && i < path.length - 1 : i >= shown) return;
        const text = hide && i > 0 ? "?" : format(convert(c.qi, c.from, col, c.value), 2);
        fit(ctx, text, x, row + rowH * 0.58, small ? 16 : 24, colW - 6, { bold: true, color: i === 0 ? COLORS.blue : i === path.length - 1 ? COLORS.green : COLORS.ink });
      });
      if (!hide && c.from !== c.to && shown > 1)
        arrow(ctx, X(c.from) + colW / 2, row + rowH + 10, X(path[shown - 1]) + colW / 2, row + rowH + 10, COLORS.purple, 2);
    }
  },
});
