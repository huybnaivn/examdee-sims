import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { MAX_A, MAX_B, MAX_BIG, MAX_BIG_B, initialState, divide, divisible, longDivision, shareOf, longOf, questionOf, check, newQuestion, newLong } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const GROUP_COLORS = [COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange, "#0e9aa7"];

/** Centred text that shrinks to fit maxW. */
function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: "center", size: w > maxW ? Math.max(9, (size * maxW) / w) : size });
}

const is = mode => s => s.mode === mode;
const freshQuestion = s => {
  s.ansQ = 0;
  s.ansR = 0;
  s._solved = false;
  s._tries = 0;
  s._note = "";
};

function emitShare(s, api) {
  const { a, b } = shareOf(s);
  const d = divide(a, b);
  if (d) api.emit("divided", { dividend: a, divisor: b, quotient: d.quotient, remainder: d.remainder }, "result");
}

// Long division: changing the numbers starts again from step 0; reaching the last step reports the result.
const restartLong = s => {
  s.step = 0;
};
function stepChanged(s, api) {
  const { a, b } = longOf(s);
  const d = longDivision(a, b);
  s.step = Math.min(s.step, d.steps.length);
  if (s.step === d.steps.length) api.emit("divided", { dividend: a, divisor: b, quotient: d.quotient, remainder: d.remainder }, "result");
}

function checkAnswer(s, api) {
  if (s._solved) return;
  const { a, b } = questionOf(s);
  const verdict = check(a, b, s.ansQ, s.ansR);
  if (verdict === "correct") {
    s._solved = true;
    s._note = "";
    api.emit("divided", { dividend: a, divisor: b, quotient: s.ansQ, remainder: s.ansR }, "result");
    api.emit("correct-answer", { dividend: a, divisor: b, quotient: s.ansQ, remainder: s.ansR, wrongTries: s._tries }, "goal");
  } else {
    s._tries += 1;
    const got = b * s.ansQ + s.ansR;
    s._note = verdict === "remainder-too-big" ? `Số dư ${s.ansR} chưa bé hơn số chia ${b}: còn chia tiếp được` : `Thử lại: ${b} × ${s.ansQ} + ${s.ansR} = ${got}, chưa bằng ${a}`;
    api.emit("wrong-answer", { dividend: a, divisor: b, quotient: s.ansQ, remainder: s.ansR }, "action");
  }
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** n counters in a grid inside the box, centred; `perRow` fixes the row length when given. */
function counters(ctx, n, x, y, w, h, color, perRow) {
  if (n <= 0 || w <= 0 || h <= 0) return;
  let cols = perRow ?? Math.max(1, Math.min(n, Math.ceil(Math.sqrt((n * w) / h))));
  let rows = Math.ceil(n / cols);
  // one more column may allow bigger counters
  if (!perRow) while (cols < n && Math.min(w / (cols + 1), h / Math.ceil(n / (cols + 1))) > Math.min(w / cols, h / rows)) rows = Math.ceil(n / ++cols);
  const cell = Math.min(w / cols, h / rows, 46);
  const gx = x + (w - cols * cell) / 2;
  const gy = y + (h - rows * cell) / 2;
  for (let k = 0; k < n; k++) dot(ctx, gx + ((k % cols) + 0.5) * cell, gy + (Math.floor(k / cols) + 0.5) * cell, cell * 0.38, color);
}

/** The sharing picture: b groups with q counters each, and the r counters left over. */
function drawShare(ctx, a, b, x, y, w, h, small) {
  const d = divide(a, b);
  if (!d) {
    counters(ctx, a, x, y, w, h, COLORS.muted);
    return;
  }
  const { quotient: q, remainder: r } = d;
  const restH = small ? 40 : 58;
  const gap = small ? 6 : 12;
  const cols = b <= 5 ? b : Math.ceil(b / 2);
  const rows = Math.ceil(b / cols);
  const pw = (w - gap * (cols - 1)) / cols;
  const ph = (h - restH - gap * rows) / rows;
  const tag = small ? 13 : 18;
  for (let i = 0; i < b; i++) {
    const px = x + (i % cols) * (pw + gap);
    const py = y + Math.floor(i / cols) * (ph + gap);
    const color = GROUP_COLORS[i % GROUP_COLORS.length];
    ctx.fillStyle = color + "1a";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 10);
    ctx.fill();
    ctx.stroke();
    counters(ctx, q, px + 4, py + 4, pw - 8, ph - tag - 6, color);
    fit(ctx, String(q), px + pw / 2, py + ph - tag / 2 - 2, tag - 2, pw - 4, { bold: true, color });
  }
  // what is left over
  const ry = y + h - restH;
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = r ? COLORS.red : COLORS.green;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, ry, w, restH, 10);
  ctx.stroke();
  ctx.restore();
  const text = r ? `Còn dư ${r}` : "Không dư: chia hết";
  ctx.font = `600 ${small ? 13 : 16}px ${FONT}`;
  const tw = ctx.measureText(text).width + 20;
  label(ctx, text, x + 10, ry + restH / 2, { size: small ? 13 : 16, bold: true, color: r ? COLORS.red : COLORS.green });
  counters(ctx, r, x + tw, ry + 4, w - tw - 8, restH - 8, COLORS.red, r);
}

/** Đặt tính: the first `shown` steps of a : b. */
function drawLong(ctx, a, b, shown, x, y, w, h, small) {
  const { steps } = longDivision(a, b);
  const A = String(a);
  const qShown = steps
    .slice(0, shown)
    .map(s => s.q)
    .join("");
  const rightLen = Math.max(String(b).length, steps.length) + 1;
  const rowsN = 1 + 2 * steps.length;
  const rowH = Math.min(small ? 26 : 44, h / rowsN);
  const cw = Math.min(rowH * 0.72, w / (A.length + rightLen + 1.5));
  const size = Math.min(rowH * 0.82, cw * 1.35);
  const left = x + (w - cw * (A.length + rightLen + 1)) / 2;
  const cx = col => left + (col + 0.5) * cw;
  const ry = row => y + (row + 0.5) * rowH;
  // right-aligned number ending at column `col`
  const put = (text, col, row, color) => [...text].forEach((ch, j) => label(ctx, ch, cx(col - (text.length - 1 - j)), ry(row), { align: "center", size, bold: true, color }));

  put(A, A.length - 1, 0, COLORS.ink);
  // the bar, the divisor above the line and the quotient under it
  const barX = left + (A.length + 0.5) * cw;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(barX, y + 2);
  ctx.lineTo(barX, y + 2 * rowH);
  ctx.moveTo(barX, y + rowH);
  ctx.lineTo(barX + rightLen * cw, y + rowH);
  ctx.stroke();
  [...String(b)].forEach((ch, j) => label(ctx, ch, barX + (j + 0.75) * cw, ry(0), { align: "center", size, bold: true, color: COLORS.purple }));
  [...qShown].forEach((ch, j) => label(ctx, ch, barX + (j + 0.75) * cw, ry(1), { align: "center", size, bold: true, color: j === shown - 1 ? COLORS.blue : COLORS.green }));

  steps.slice(0, shown).forEach((s, k) => {
    const now = k === shown - 1;
    const len = Math.max(String(s.partial).length, String(s.product).length);
    put(String(s.product), s.col, 1 + 2 * k, now ? COLORS.blue : COLORS.muted);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx(s.col - len + 1) - cw / 2, y + (2 + 2 * k) * rowH);
    ctx.lineTo(cx(s.col) + cw / 2, y + (2 + 2 * k) * rowH);
    ctx.stroke();
    const last = k === steps.length - 1;
    put(String(s.remainder), s.col, 2 + 2 * k, last ? COLORS.red : COLORS.ink);
    // the next digit is brought down beside the remainder once the next step is shown
    if (k + 1 < shown) put(String(steps[k + 1].digit), s.col + 1, 2 + 2 * k, COLORS.orange);
  });
}

/** What is said aloud at step k (1-based), in the words of the textbook. */
function sayStep(steps, k, b) {
  const s = steps[k - 1];
  const down = k > 1 ? `Hạ ${s.digit}, được ${s.partial}. ` : "";
  return [`${down}${s.partial} chia ${b} được ${s.q}, viết ${s.q}.`, `${s.q} nhân ${b} bằng ${s.product}; ${s.partial} trừ ${s.product} bằng ${s.remainder}.`];
}

const sentence = (a, b, d) => `${a} : ${b} = ${d.quotient}${d.remainder ? ` (dư ${d.remainder})` : ""}`;

mount({
  slug: "phep-chia-co-du",
  version: "1.0.0",
  title: "Phép chia hết và phép chia có dư",
  hint: "Chia đều các chấm vào các nhóm. Phần không đủ chia thêm cho mỗi nhóm là số dư. Số dư luôn bé hơn số chia.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "share", label: "Chia đều vào các nhóm" },
        { value: "long", label: "Đặt tính rồi tính" },
        { value: "practice", label: "Luyện tập" },
      ],
      onChange: s => {
        freshQuestion(s);
        restartLong(s);
      },
    },
    { type: "slider", key: "a", label: "Số bị chia (số chấm)", min: 0, max: MAX_A, step: 1, digits: 0, visible: is("share"), onCommit: emitShare },
    { type: "stepper", key: "b", label: "Số chia (số nhóm)", min: 0, max: MAX_B, visible: is("share"), onCommit: emitShare },

    { type: "slider", key: "bigA", label: "Số bị chia", min: 0, max: MAX_BIG, step: 1, digits: 0, visible: is("long"), onChange: restartLong },
    { type: "stepper", key: "bigA", label: "Chỉnh từng đơn vị", min: 0, max: MAX_BIG, visible: is("long"), onChange: restartLong },
    { type: "slider", key: "bigB", label: "Số chia", min: 2, max: MAX_BIG_B, step: 1, digits: 0, visible: is("long"), onChange: restartLong },
    { type: "stepper", key: "step", label: "Bước chia", min: 0, max: 4, visible: is("long"), onChange: stepChanged },
    {
      type: "button",
      label: "Phép chia khác",
      visible: is("long"),
      event: "new-division",
      action: s => {
        Object.assign(s, newLong(Math.random));
        restartLong(s);
      },
    },

    { type: "slider", key: "ansQ", label: "Thương", min: 0, max: 12, step: 1, digits: 0, visible: is("practice"), disabled: s => s._solved },
    { type: "slider", key: "ansR", label: "Số dư", min: 0, max: 9, step: 1, digits: 0, visible: is("practice"), disabled: s => s._solved },
    { type: "button", label: "Kiểm tra", primary: true, visible: is("practice"), disabled: s => s._solved, action: checkAnswer },
    {
      type: "button",
      label: "Câu khác",
      visible: is("practice"),
      event: "new-question",
      action: s => {
        Object.assign(s, newQuestion(Math.random, { qa: s.qa, qb: s.qb }));
        freshQuestion(s);
      },
    },
  ],
  readouts: [
    {
      label: "Phép chia",
      value: s => {
        if (s.mode === "practice") return (({ a, b }) => (s._solved ? sentence(a, b, divide(a, b)) : `${a} : ${b} = ?`))(questionOf(s));
        const { a, b } = s.mode === "long" ? longOf(s) : shareOf(s);
        const d = divide(a, b);
        if (!d) return "Không chia được cho 0";
        return s.mode === "long" && s.step < longDivision(a, b).steps.length ? `${a} : ${b} = ?` : sentence(a, b, d);
      },
    },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 520 || h < 420;
    const big = small ? 24 : 36;
    const mid = small ? 14 : 19;
    const pad = small ? 8 : 24;
    const y1 = small ? 20 : 32;
    const y2 = y1 + big * 0.95;
    const y3 = y2 + mid * 1.3;
    const top = y3 + mid;

    if (s.mode === "share") {
      const { a, b } = shareOf(s);
      const d = divide(a, b);
      if (!d) {
        fit(ctx, `${a} : 0 = ?`, w / 2, y1, big, w - 20, { bold: true, color: COLORS.red });
        fit(ctx, "Không có phép chia cho số 0", w / 2, y2, mid, w - 20, { bold: true, color: COLORS.red });
        fit(ctx, "Không thể chia các chấm vào 0 nhóm. Hãy tăng số chia.", w / 2, y3, small ? 12 : 15, w - 16, { color: COLORS.muted });
      } else {
        fit(ctx, sentence(a, b, d), w / 2, y1, big, w - 20, { bold: true, color: COLORS.blue });
        const bound = d.remainder ? `số dư ${d.remainder} < số chia ${b}` : "số dư bằng 0";
        fit(ctx, `${a} = ${b} × ${d.quotient} + ${d.remainder}   (${bound})`, w / 2, y2, mid, w - 16, { bold: true, color: COLORS.purple });
        const kind = divisible(a, b) ? `Phép chia hết: ${a} chia hết cho ${b}` : `Phép chia có dư: ${a} không chia hết cho ${b}`;
        fit(ctx, kind, w / 2, y3, small ? 12 : 15, w - 16, { color: divisible(a, b) ? COLORS.green : COLORS.red, bold: true });
      }
      drawShare(ctx, a, b, pad, top, w - 2 * pad, h - top - (small ? 6 : 16), small);
    } else if (s.mode === "long") {
      const { a, b } = longOf(s);
      const d = longDivision(a, b);
      const n = d.steps.length;
      const k = Math.min(Math.max(0, s.step), n);
      const done = k === n;
      fit(ctx, done ? sentence(a, b, d) : `${a} : ${b} = ?`, w / 2, y1, big, w - 20, { bold: true, color: done ? COLORS.blue : COLORS.ink });
      const lines = k === 0 ? ["Bấm + ở «Bước chia» để chia lần lượt từ trái sang phải.", `Bắt đầu: lấy ${d.steps[0].partial} chia cho ${b}.`] : sayStep(d.steps, k, b);
      const foot = small ? 54 : 84;
      const fy = h - foot;
      fit(ctx, `Bước ${k}/${n}`, w / 2, y2, small ? 12 : 15, w - 16, { color: COLORS.muted, bold: true });
      drawLong(ctx, a, b, k, pad, y2 + mid, w - 2 * pad, fy - y2 - mid - 4, small);
      fit(ctx, lines[0], w / 2, fy + foot * 0.17, mid, w - 12, { bold: true });
      fit(ctx, lines[1], w / 2, fy + foot * 0.47, mid, w - 12, { bold: true });
      if (done) fit(ctx, `Thử lại: ${b} × ${d.quotient} + ${d.remainder} = ${a};  số dư ${d.remainder} < ${b}`, w / 2, fy + foot * 0.8, small ? 12 : 16, w - 12, { color: COLORS.purple, bold: true });
    } else {
      const { a, b } = questionOf(s);
      if (s._solved) {
        const d = divide(a, b);
        fit(ctx, sentence(a, b, d), w / 2, y1, big, w - 20, { bold: true, color: COLORS.green });
        fit(ctx, "Đúng rồi! Giỏi quá!", w / 2, y2, mid, w - 16, { bold: true, color: COLORS.green });
        fit(ctx, `${a} = ${b} × ${d.quotient} + ${d.remainder}`, w / 2, y3, small ? 12 : 15, w - 16, { color: COLORS.purple, bold: true });
        drawShare(ctx, Math.min(a, 99), b, pad, top, w - 2 * pad, h - top - (small ? 6 : 16), small);
      } else {
        fit(ctx, `${a} : ${b} = ${s.ansQ} (dư ${s.ansR}) ?`, w / 2, y1, big, w - 20, { bold: true });
        fit(ctx, s._note || "Chọn thương và số dư rồi bấm «Kiểm tra»", w / 2, y2, mid, w - 16, { bold: true, color: s._note ? COLORS.red : COLORS.muted });
        fit(ctx, `Có ${a} chấm, chia đều vào ${b} nhóm`, w / 2, y3, small ? 12 : 15, w - 16, { color: COLORS.muted });
        counters(ctx, a, pad, top + 4, w - 2 * pad, h - top - (small ? 10 : 24), COLORS.blue, 10);
      }
    }
  },
});
