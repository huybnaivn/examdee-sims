import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { MIN, MAX, initialState, side, product, sentence, addends, divisions, rotate, isCorrect, choices, newQuestion } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ROW_COLORS = ["#2f6fed", "#e5484d", "#1f9d6b", "#f08c2e", "#7a5af8"];

/** Centred text that shrinks to fit maxW. */
function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: "center", size: w > maxW ? Math.max(9, (size * maxW) / w) : size });
}

const setArray = (s, api) => api.emit("array-set", { rows: side(s.rows), columns: side(s.columns), product: product(s.rows, s.columns) }, "result");
const freshQuestion = s => {
  s._tried = [];
  s._solved = false;
};

function answerPad(box, api) {
  box.classList.add("answers");
  box.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:8px";
  const buttons = Array.from({ length: 12 }, () => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.cssText = "min-height:56px;font-size:22px;font-weight:600;padding:0";
    b.addEventListener("click", () => {
      const s = api.state;
      const value = Number(b.textContent);
      if (s._solved || s._tried.includes(value)) return;
      if (isCorrect(side(s.rows), side(s.columns), value)) {
        s._solved = true;
        api.emit("correct-answer", { rows: side(s.rows), columns: side(s.columns), product: value, wrongTries: s._tried.length }, "goal");
      } else {
        s._tried.push(value);
        api.emit("wrong-answer", { answer: value, rows: side(s.rows), columns: side(s.columns) }, "action");
      }
      api.sync();
    });
    box.append(b);
    return b;
  });
  return () => {
    const s = api.state;
    const right = product(s.rows, s.columns);
    choices(s.rows, s.columns).forEach((v, i) => {
      const b = buttons[i];
      b.textContent = String(v);
      const wrong = s._tried.includes(v);
      const done = s._solved && v === right;
      b.disabled = wrong || (s._solved && !done);
      b.style.background = done ? COLORS.green : wrong ? "#fde2e2" : "";
      b.style.color = done ? "#fff" : wrong ? COLORS.red : "";
      b.setAttribute("aria-label", `${v}${done ? ", đúng" : wrong ? ", chưa đúng" : ""}`);
    });
  };
}

const practice = s => s.mode === "practice";

mount({
  slug: "bang-nhan",
  version: "1.0.0",
  title: "Phép nhân bằng mảng",
  hint: "Mỗi hàng có số chấm bằng nhau. Số chấm một hàng được lấy bao nhiêu lần thì nhân với bấy nhiêu.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "explore", label: "Xếp mảng chấm" },
        { value: "practice", label: "Luyện tập" },
      ],
      onChange: freshQuestion,
    },
    { type: "stepper", key: "rows", label: "Số hàng", min: MIN, max: MAX, visible: s => !practice(s), onCommit: setArray },
    { type: "stepper", key: "columns", label: "Số chấm mỗi hàng", min: MIN, max: MAX, visible: s => !practice(s), onCommit: setArray },
    {
      type: "button",
      label: "↻ Xoay mảng",
      visible: s => !practice(s),
      action: (s, api) => {
        Object.assign(s, rotate(s));
        setArray(s, api);
      },
    },
    { type: "custom", render: answerPad, visible: practice },
    {
      type: "button",
      label: "Câu khác",
      primary: true,
      visible: practice,
      action: (s, api) => {
        Object.assign(s, newQuestion(Math.random, { rows: side(s.rows), columns: side(s.columns) }));
        freshQuestion(s);
        setArray(s, api);
      },
    },
  ],
  readouts: [
    { label: "Phép nhân", value: s => (practice(s) && !s._solved ? "?" : (({ a, b, p }) => `${a} × ${b} = ${p}`)(sentence(s.rows, s.columns))) },
    { label: "Đổi chỗ hai thừa số", value: s => (practice(s) && !s._solved ? "?" : (({ a, b, p }) => `${b} × ${a} = ${p}`)(sentence(s.rows, s.columns))) },
    ...[0, 1].map(i => ({
      label: i ? "Chia theo cột" : "Chia theo hàng",
      value: s => (practice(s) && !s._solved ? "?" : (({ dividend, divisor, quotient }) => `${dividend} : ${divisor} = ${quotient}`)(divisions(s.rows, s.columns)[i])),
    })),
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 520 || h < 420;
    const r = side(s.rows);
    const c = side(s.columns);
    const { a, b, p } = sentence(r, c);
    const hide = practice(s) && !s._solved;

    // the sentence on top
    const big = small ? 26 : 38;
    const y1 = small ? 22 : 34;
    fit(ctx, `${a} × ${b} = ${hide ? "?" : p}`, w / 2, y1, big, w - 20, { bold: true, color: hide ? COLORS.ink : COLORS.blue });
    const y2 = y1 + big * 0.95;
    let note;
    if (practice(s)) {
      const last = s._tried.length > 0;
      note = s._solved ? "Đúng rồi! Giỏi quá!" : last ? "Chưa đúng, em đếm lại nhé" : "Bấm vào đáp án đúng ở bên dưới";
      fit(ctx, note, w / 2, y2, small ? 15 : 20, w - 20, { bold: true, color: s._solved ? COLORS.green : last ? COLORS.red : COLORS.muted });
    } else {
      fit(ctx, `${addends(r, c).join(" + ")} = ${p}`, w / 2, y2, small ? 15 : 20, w - 20, { color: COLORS.ink });
    }

    // division and commutativity under the array (explore only, and only when there is room)
    const foot = !practice(s) || s._solved ? (small ? 26 : 40) : 0;
    if (foot) {
      const [d1, d2] = divisions(r, c);
      const text = `${d1.dividend} : ${d1.divisor} = ${d1.quotient}     ${d2.dividend} : ${d2.divisor} = ${d2.quotient}     ${a} × ${b} = ${b} × ${a}`;
      fit(ctx, text, w / 2, h - foot / 2 - 2, small ? 14 : 18, w - 16, { bold: true, color: COLORS.purple });
    }

    // the array: one band per row, with how many counters so far at its end
    const top = y2 + (small ? 20 : 30);
    const sideLabel = small ? 44 : 64;
    const areaW = w - 2 * sideLabel;
    const areaH = h - top - foot - (small ? 18 : 26);
    const cell = Math.max(6, Math.min(areaW / c, areaH / r, small ? 34 : 84));
    const gx = (w - c * cell) / 2;
    const gy = top + (small ? 16 : 22) + (areaH - r * cell) / 2;
    label(ctx, `${c} chấm mỗi hàng`, w / 2, gy - (small ? 10 : 14), { align: "center", size: small ? 12 : 15, color: COLORS.muted, bold: true });
    for (let i = 0; i < r; i++) {
      const y = gy + i * cell;
      const color = ROW_COLORS[i % ROW_COLORS.length];
      ctx.fillStyle = color + "1a";
      ctx.beginPath();
      ctx.roundRect(gx - 3, y + 2, c * cell + 6, cell - 4, cell / 2);
      ctx.fill();
      for (let j = 0; j < c; j++) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(gx + (j + 0.5) * cell, y + cell / 2, cell * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!hide && cell >= 14) label(ctx, String(c * (i + 1)), gx + c * cell + 10, y + cell / 2, { size: Math.min(16, cell * 0.6), color, bold: true });
    }
    // rows count on the left
    ctx.save();
    ctx.translate(gx - (small ? 14 : 20), gy + (r * cell) / 2);
    ctx.rotate(-Math.PI / 2);
    label(ctx, `${r} hàng`, 0, 0, { align: "center", size: small ? 12 : 15, color: COLORS.muted, bold: true });
    ctx.restore();
  },
});
