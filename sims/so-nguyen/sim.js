import { mount, COLORS, arrow, label } from "../../kit/v1/kit.js";
import { MIN, MAX, initialState, counters, current, isCorrect, newQuestion, expression, plain } from "./model.js";

const LO = -20; // the number line covers every possible result
const HI = 20;
const signed = n => (n > 0 ? `+${n}` : plain(n));
const tone = n => (n < 0 ? COLORS.red : COLORS.blue);
const open = s => !s.practice || s.status === "right"; // is the result on show?

const report = (s, api) => {
  const c = current(s);
  api.emit("calculation", { a: c.a, b: c.b, operation: c.sign, result: c.result }, "result");
};

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawCounters(ctx, s, c, box, small) {
  const k = counters(c.a, c.b, c.sign);
  const show = open(s);
  const size = small ? 11 : 14;
  const r = Math.min(small ? 7 : 13, box.w / 20 / 2.5);
  const gap = r * 2.5;
  const x0 = box.x + (box.w - gap * (Math.max(k.positive, k.negative, 1) - 1)) / 2;
  const rows = [
    [k.positive, COLORS.blue, "+", box.y + (small ? 22 : 34) + r],
    [k.negative, COLORS.red, "−", box.y + (small ? 22 : 34) + r * 3.6],
  ];
  label(ctx, "Thẻ số: một thẻ (+) và một thẻ (−) triệt tiêu nhau", box.x + box.w / 2, box.y + 8, { size, align: "center", color: COLORS.muted });
  for (const [count, color, mark, y] of rows) {
    for (let i = 0; i < count; i++) {
      const x = x0 + i * gap;
      const gone = show && i < k.pairs;
      ctx.globalAlpha = gone ? 0.3 : 1;
      dot(ctx, x, y, r, color);
      label(ctx, mark, x, y, { color: "#fff", size: r * 1.5, align: "center", bold: true });
      ctx.globalAlpha = 1;
    }
  }
  if (!show) return;
  // each cancelled pair is struck through
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < k.pairs; i++) {
    const x = x0 + i * gap;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, rows[1][3] + r * 0.9);
    ctx.lineTo(x + r * 0.8, rows[0][3] - r * 0.9);
    ctx.stroke();
  }
  const left = k.leftPositive || k.leftNegative;
  const text = left ? `Còn lại ${left} thẻ (${k.leftPositive ? "+" : "−"}), kết quả là ${plain(c.result)}` : "Không còn thẻ nào, kết quả là 0";
  label(ctx, text, box.x + box.w / 2, rows[1][3] + r + (small ? 12 : 20), { size, align: "center", bold: true, color: COLORS.green });
}

mount({
  slug: "so-nguyen",
  version: "1.0.0",
  title: "Cộng trừ số nguyên trên trục số",
  hint: "Bắt đầu từ số thứ nhất, đi sang phải khi cộng số dương, sang trái khi cộng số âm. Trừ một số là cộng với số đối của nó.",
  initialState,
  controls: [
    { type: "slider", key: "a", label: "Số thứ nhất a", min: MIN, max: MAX, step: 1, digits: 0, visible: s => !s.practice, onCommit: report },
    {
      type: "select",
      key: "op",
      label: "Phép tính",
      visible: s => !s.practice,
      onCommit: report,
      options: [
        { value: "add", label: "Cộng: a + b" },
        { value: "sub", label: "Trừ: a − b" },
      ],
    },
    { type: "slider", key: "b", label: "Số thứ hai b", min: MIN, max: MAX, step: 1, digits: 0, visible: s => !s.practice, onCommit: report },
    { type: "checkbox", key: "showCounters", label: "Hiện thẻ số (+) và (−)" },
    { type: "heading", label: "Luyện tập" },
    { type: "checkbox", key: "practice", label: "Chế độ luyện tập" },
    {
      type: "stepper",
      key: "answer",
      label: "Câu trả lời",
      min: LO,
      max: HI,
      visible: s => s.practice,
      disabled: s => s.status === "right",
      onChange: s => {
        s.status = "";
      },
    },
    {
      type: "button",
      label: "Kiểm tra",
      primary: true,
      visible: s => s.practice,
      disabled: s => s.status === "right",
      action(s, api) {
        const c = current(s);
        if (isCorrect(s)) {
          s.status = "right";
          s.solved = Math.max(0, Math.round(s.solved) || 0) + 1;
          api.emit("answered-correctly", { a: c.a, b: c.b, operation: c.sign, result: c.result, solved: s.solved }, "goal");
        } else {
          s.status = "wrong";
          api.emit("wrong-answer", { a: c.a, b: c.b, operation: c.sign, answer: s.answer }, "action");
        }
      },
    },
    { type: "button", label: "Câu hỏi khác", visible: s => s.practice, action: s => newQuestion(s), event: "new-question", eventKind: "action" },
  ],
  readouts: [
    { label: "Phép tính", value: s => `${expression(current(s).a, current(s).b, current(s).sign).split(" = ")[0]} = ${open(s) ? plain(current(s).result) : "?"}` },
    { label: "Số câu trả lời đúng", value: s => `${Math.max(0, Math.round(s.solved) || 0)}`, },
  ],
  draw(ctx, s, view) {
    const c = current(s);
    const show = open(s);
    const small = view.w < 520 || view.h < 400;
    const size = small ? 12 : 14;
    const pad = small ? 16 : 44;
    const unit = (view.w - 2 * pad) / (HI - LO);
    const X = n => pad + (n - LO) * unit;

    // the calculation
    const text = expression(c.a, c.b, c.sign);
    const head = show ? `${text} = ${plain(c.result)}` : `${text.split(" = ")[0]} = ?`;
    label(ctx, head, view.w / 2, small ? 16 : 34, { size: small ? 17 : 26, align: "center", bold: true });
    const note =
      s.practice && s.status === "right"
        ? ["Đúng rồi!", COLORS.green]
        : s.practice && s.status === "wrong"
          ? [`${plain(s.answer)} chưa đúng. Hãy đi lại trên trục số rồi thử lại.`, COLORS.red]
          : s.practice
            ? ["Chọn câu trả lời rồi bấm Kiểm tra.", COLORS.muted]
            : c.sign === -1
              ? [`Trừ ${plain(c.b)} là cộng với số đối của nó: ${plain(-c.b)}`, COLORS.muted]
              : ["", COLORS.muted];
    label(ctx, note[0], view.w / 2, small ? 36 : 66, { size, align: "center", color: note[1], bold: s.practice });

    // number line
    const top = small ? 46 : 84;
    const step = small ? 20 : 30; // height of one arrow level
    const above = 2 * step + 22;
    const tray = s.showCounters ? (small ? 84 : 130) : 0;
    const under = small ? 42 : 56; // tick labels and the result
    const y = top + above + Math.max(0, (view.h - top - above - under - tray) / 2);
    arrow(ctx, X(LO) - pad * 0.6, y, X(HI) + pad * 0.7, y, COLORS.ink, 2);
    const every = unit < 13 ? 5 : unit < 24 ? 2 : 1;
    const marked = show ? [c.a, c.result] : [c.a];
    ctx.strokeStyle = COLORS.ink;
    for (let n = LO; n <= HI; n++) {
      const major = n % every === 0;
      ctx.lineWidth = n === 0 ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(X(n), y - (major ? 6 : 3));
      ctx.lineTo(X(n), y + (major ? 6 : 3));
      ctx.stroke();
      if (major && !marked.some(m => m !== n && Math.abs(m - n) * unit < 22)) {
        label(ctx, plain(n), X(n), y + 17, { size: small ? 10 : 12, align: "center", color: marked.includes(n) ? COLORS.ink : COLORS.muted, bold: marked.includes(n) });
      }
    }
    for (const m of marked) if (m % every !== 0) label(ctx, plain(m), X(m), y + 17, { size: small ? 10 : 12, align: "center", bold: true });

    // arrows: 0 → a, then a → a + (±b)
    const hop = (from, to, level, name) => {
      const ya = y - level * step;
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(X(to), ya);
      ctx.lineTo(X(to), y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (from === to) {
        dot(ctx, X(from), ya, 4, COLORS.muted);
        label(ctx, `${name}: đứng yên`, X(from), ya - 11, { size, align: "center", color: COLORS.muted });
        return;
      }
      arrow(ctx, X(from), ya, X(to), ya, tone(to - from), small ? 3 : 4);
      label(ctx, signed(to - from), (X(from) + X(to)) / 2, ya - 11, { size: size + 1, align: "center", bold: true, color: tone(to - from) });
    };
    hop(0, c.a, 1, "a = 0");
    if (show) hop(c.a, c.result, 2, "cộng 0");
    dot(ctx, X(c.a), y, small ? 4 : 5, COLORS.ink);
    if (show) {
      dot(ctx, X(c.result), y, small ? 5 : 7, COLORS.green);
      label(ctx, `Kết quả: ${plain(c.result)}`, Math.min(Math.max(X(c.result), 50), view.w - 50), y + (small ? 32 : 40), { size, align: "center", bold: true, color: COLORS.green });
    }

    if (s.showCounters) drawCounters(ctx, s, c, { x: pad, y: y + under + (small ? 4 : 16), w: view.w - 2 * pad }, small);
  },
});
