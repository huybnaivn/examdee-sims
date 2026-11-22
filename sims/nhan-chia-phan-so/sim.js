import { mount, COLORS, label } from "../../kit/v1/kit.js";
import { MAX_N, MAX_D, initialState, operands, simplify, reciprocal, calculate, toMixed, area, cellKind, fitting, same, choices, newQuestion } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const A = COLORS.blue; // first fraction
const B = COLORS.orange; // second fraction
const R = COLORS.green; // result

const practice = s => s.mode === "practice";
const div = s => s.op === "div";
const hidden = s => practice(s) && !s._solved;
const key = f => `${f.n}/${f.d}`;

// ---------- text with stacked fractions ----------
// A part is { t: "text" }, { n, d } or { w, n, d } (mixed number); each may carry a color.
const T = (t, color) => ({ t, color });
const F = (n, d, color) => ({ n, d, color });
/** A value: a whole number when the denominator is 1. */
const V = (f, color) => (f.d === 1 ? T(String(f.n), color) : F(f.n, f.d, color));

function line(ctx, parts, cx, y, size, maxW, { bold = true, color = COLORS.ink } = {}) {
  const font = sz => `${bold ? "600 " : ""}${sz}px ${FONT}`;
  const measure = sz => {
    ctx.font = font(sz);
    return parts.map(p => {
      if (p.t != null) return ctx.measureText(p.t).width + sz * 0.45;
      const stack = Math.max(ctx.measureText(String(p.n)).width, ctx.measureText(String(p.d)).width) + sz * 0.35;
      return stack + (p.w != null ? ctx.measureText(String(p.w)).width + sz * 0.12 : 0) + sz * 0.45;
    });
  };
  let widths = measure(size);
  let total = widths.reduce((a, b) => a + b, 0);
  if (total > maxW) {
    size = Math.max(8, (size * maxW) / total);
    widths = measure(size);
    total = widths.reduce((a, b) => a + b, 0);
  }
  let x = cx - total / 2;
  parts.forEach((p, i) => {
    const c = p.color ?? color;
    const mid = x + widths[i] / 2;
    if (p.t != null) {
      label(ctx, p.t, mid, y, { size, align: "center", bold, color: c });
    } else {
      ctx.font = font(size);
      const wholeW = p.w != null ? ctx.measureText(String(p.w)).width + size * 0.12 : 0;
      const stackW = widths[i] - wholeW - size * 0.45;
      const sx = x + size * 0.225 + wholeW + stackW / 2;
      if (p.w != null) label(ctx, String(p.w), x + size * 0.225 + wholeW / 2 - size * 0.06, y, { size, align: "center", bold, color: c });
      label(ctx, String(p.n), sx, y - size * 0.62, { size, align: "center", bold, color: c });
      label(ctx, String(p.d), sx, y + size * 0.66, { size, align: "center", bold, color: c });
      ctx.strokeStyle = c;
      ctx.lineWidth = Math.max(1.5, size * 0.09);
      ctx.beginPath();
      ctx.moveTo(sx - stackW / 2, y);
      ctx.lineTo(sx + stackW / 2, y);
      ctx.stroke();
    }
    x += widths[i];
  });
}

/** "= raw = lowest terms = mixed number", leaving out steps that change nothing. */
function tail(s, r) {
  const out = [T("="), F(r.raw.n, r.raw.d, R)];
  if (r.d !== r.raw.d) out.push(T("="), V(r, R));
  else if (r.d === 1) out.splice(1, 1, V(r, R));
  if (s.mixed && r.d > 1 && r.n > r.d) {
    const m = toMixed(r.n, r.d);
    out.push(T("="), { w: m.whole, n: m.n, d: m.d, color: R });
  }
  return out;
}

// ---------- events ----------
const opCode = s => (div(s) ? 2 : 1);

function report(s, api) {
  const r = calculate(s);
  if (!r) return; // dividing by 0: there is no result to report
  api.emit("calculated", { operation: opCode(s), ...operands(s), numerator: r.n, denominator: r.d }, "result");
}

function fresh(s) {
  s._tried = [];
  s._solved = false;
  if (practice(s) && !calculate(s)) Object.assign(s, newQuestion(Math.random, operands(s)));
}

const change = (s, api) => {
  fresh(s);
  report(s, api);
};

function answerPad(box, api) {
  box.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:8px";
  const buttons = Array.from({ length: 6 }, () => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.cssText = "min-height:72px;font-size:21px;font-weight:600;padding:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15";
    const top = document.createElement("span");
    const bottom = document.createElement("span");
    bottom.style.cssText = "border-top:2px solid currentColor;padding:0 6px";
    b.append(top, bottom);
    b.addEventListener("click", () => {
      const s = api.state;
      const f = b._value;
      const right = calculate(s);
      if (!f || !right || s._solved || s._tried.includes(key(f))) return;
      if (same(f, right)) {
        s._solved = true;
        api.emit("correct-answer", { operation: opCode(s), numerator: f.n, denominator: f.d, wrongTries: s._tried.length }, "goal");
      } else {
        s._tried.push(key(f));
        api.emit("wrong-answer", { operation: opCode(s), numerator: f.n, denominator: f.d }, "action");
      }
      api.sync();
    });
    box.append(b);
    return b;
  });
  return () => {
    const s = api.state;
    const list = choices(s);
    const right = calculate(s);
    buttons.forEach((b, i) => {
      const f = list[i];
      b._value = f;
      b.hidden = !f;
      if (!f) return;
      const [top, bottom] = b.children;
      top.textContent = String(f.n);
      bottom.textContent = String(f.d);
      bottom.hidden = f.d === 1;
      const wrong = s._tried.includes(key(f));
      const ok = s._solved && same(f, right);
      b.disabled = wrong || (s._solved && !ok);
      b.style.background = ok ? COLORS.green : wrong ? "#fde2e2" : "";
      b.style.color = ok ? "#fff" : wrong ? COLORS.red : "";
      b.setAttribute("aria-label", `${f.n}${f.d === 1 ? "" : ` phần ${f.d}`}${ok ? ", đúng" : wrong ? ", chưa đúng" : ""}`);
    });
  };
}

// ---------- pictures ----------

/** Area model: a rectangle n1/d1 wide and n2/d2 high on unit squares cut into d1 columns and d2 rows. */
function drawArea(ctx, o, box, small) {
  const { n1, d1, n2, d2 } = o;
  const m = area(n1, d1, n2, d2);
  const mark = small ? 26 : 40; // room for the two fraction labels
  const markTop = small ? 36 : 52;
  const u = Math.min((box.w - mark) / m.unitsX, (box.h - markTop - 4) / m.unitsY);
  const cw = u / d1;
  const ch = u / d2;
  const x0 = box.x + mark + (box.w - mark - u * m.unitsX) / 2;
  const y0 = box.y + markTop + (box.h - markTop - 4 - u * m.unitsY) / 2;
  const fill = { a: A + "40", b: B + "40", both: R };
  for (let i = 0; i < m.unitsX * d1; i++)
    for (let j = 0; j < m.unitsY * d2; j++) {
      const kind = cellKind(i, j, n1, d1, n2, d2);
      ctx.fillStyle = kind === "none" ? "#fff" : fill[kind];
      ctx.fillRect(x0 + i * cw, y0 + j * ch, cw, ch);
    }
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= m.unitsX * d1; i++) {
    ctx.moveTo(x0 + i * cw, y0);
    ctx.lineTo(x0 + i * cw, y0 + u * m.unitsY);
  }
  for (let j = 0; j <= m.unitsY * d2; j++) {
    ctx.moveTo(x0, y0 + j * ch);
    ctx.lineTo(x0 + u * m.unitsX, y0 + j * ch);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = small ? 2 : 3;
  for (let i = 0; i < m.unitsX; i++) for (let j = 0; j < m.unitsY; j++) ctx.strokeRect(x0 + i * u, y0 + j * u, u, u);
  // the two sides of the rectangle
  const size = small ? 11 : 15;
  const off = small ? 5 : 8;
  ctx.lineWidth = small ? 3 : 4;
  ctx.lineCap = "round";
  if (n1) {
    ctx.strokeStyle = A;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - off);
    ctx.lineTo(x0 + n1 * cw, y0 - off);
    ctx.stroke();
    line(ctx, [F(n1, d1, A)], x0 + (n1 * cw) / 2, y0 - off - size * 1.3, size * 0.85, 200);
  }
  if (n2) {
    ctx.strokeStyle = B;
    ctx.beginPath();
    ctx.moveTo(x0 - off, y0);
    ctx.lineTo(x0 - off, y0 + n2 * ch);
    ctx.stroke();
    line(ctx, [F(n2, d2, B)], x0 - off - size * 0.95, y0 + (n2 * ch) / 2, size * 0.85, 200);
  }
  if (m.unitsX * m.unitsY > 1 && !small) label(ctx, "Mỗi ô vuông viền đậm là 1 đơn vị", x0 + (u * m.unitsX) / 2, y0 + u * m.unitsY + 12, { size: 12, align: "center", color: COLORS.muted });
}

/** Division as measuring: how many copies of the divisor lie along the dividend. */
function drawBars(ctx, o, box, small, secret) {
  const { n1, d1, n2, d2 } = o;
  const f = fitting(n1, d1, n2, d2);
  const a = n1 / d1;
  const b = n2 / d2;
  const copies = f.whole + (f.rest ? 1 : 0);
  const span = Math.max(1, Math.ceil(Math.max(a, copies * b) - 1e-9));
  const left = box.x + (small ? 8 : 24);
  const px = (box.w - (small ? 16 : 48)) / span;
  const barH = Math.min(small ? 30 : 54, box.h / 4.6);
  const gap = Math.max(barH * 0.55, small ? 22 : 30);
  const y1 = box.y + (box.h - (2 * barH + gap + barH * 1.1)) / 2 + barH * 0.5;
  const y2 = y1 + barH + gap;
  const size = small ? 11 : 14;
  const bar = (x, y, w, color, parts) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    if (w / parts >= 4) {
      ctx.beginPath();
      for (let i = 1; i < parts; i++) {
        ctx.moveTo(x + (w * i) / parts, y);
        ctx.lineTo(x + (w * i) / parts, y + barH);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, barH);
  };
  // dividend
  label(ctx, "Số bị chia", left, y1 - size * 0.8, { size, color: A, bold: true });
  if (n1) bar(left, y1, a * px, A, n1);
  // copies of the divisor
  label(ctx, "Số chia, đặt nối tiếp nhau", left, y2 - size * 0.8, { size, color: B, bold: true });
  for (let k = 0; k < f.whole; k++) {
    bar(left + k * b * px, y2, b * px, k % 2 ? "#f6b26b" : B, n2);
    if (b * px >= 16) label(ctx, String(k + 1), left + (k + 0.5) * b * px, y2 + barH / 2, { size: Math.min(size + 4, barH * 0.6), align: "center", bold: true, color: "#fff" });
  }
  if (f.rest) {
    // one more copy does not fit whole: only rest/partsB of it lies on the dividend
    const x = left + f.whole * b * px;
    const part = (f.rest / f.partsB) * b * px;
    ctx.fillStyle = COLORS.purple + "88";
    ctx.fillRect(x, y2, part, barH);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y2, b * px, barH);
    ctx.setLineDash([]);
    const r = simplify(f.rest, f.partsB);
    if (part >= 14 && !secret) line(ctx, [F(r.n, r.d, "#fff")], x + part / 2, y2 + barH / 2, Math.min(size, barH * 0.3), part);
  }
  // where the dividend ends
  ctx.strokeStyle = A;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left + a * px, y1 + barH);
  ctx.lineTo(left + a * px, y2 + barH + 6);
  ctx.stroke();
  ctx.setLineDash([]);
  // number line
  const y3 = y2 + barH + barH * 0.45;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, y3);
  ctx.lineTo(left + span * px, y3);
  for (let i = 0; i <= span; i++) {
    ctx.moveTo(left + i * px, y3 - 4);
    ctx.lineTo(left + i * px, y3 + 4);
  }
  ctx.stroke();
  for (let i = 0; i <= span; i++) label(ctx, String(i), left + i * px, y3 + size, { size, align: "center", color: COLORS.muted });
}

mount({
  slug: "nhan-chia-phan-so",
  version: "1.0.0",
  title: "Nhân, chia phân số",
  hint: "Nhân: tử nhân tử, mẫu nhân mẫu. Chia: nhân với phân số đảo ngược.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "explore", label: "Khám phá" },
        { value: "practice", label: "Luyện tập" },
      ],
      onChange: fresh,
    },
    {
      type: "select",
      key: "op",
      label: "Phép tính",
      options: [
        { value: "mul", label: "Nhân (×)" },
        { value: "div", label: "Chia (:)" },
      ],
      onCommit: change,
    },
    { type: "stepper", key: "n1", label: "Tử số thứ nhất", min: 0, max: MAX_N, visible: s => !practice(s), onCommit: report },
    { type: "stepper", key: "d1", label: "Mẫu số thứ nhất", min: 1, max: MAX_D, visible: s => !practice(s), onCommit: report },
    { type: "stepper", key: "n2", label: "Tử số thứ hai", min: 0, max: MAX_N, visible: s => !practice(s), onCommit: report },
    { type: "stepper", key: "d2", label: "Mẫu số thứ hai", min: 1, max: MAX_D, visible: s => !practice(s), onCommit: report },
    { type: "custom", render: answerPad, visible: practice },
    {
      type: "button",
      label: "Câu khác",
      primary: true,
      visible: practice,
      action: (s, api) => {
        Object.assign(s, newQuestion(Math.random, operands(s)));
        change(s, api);
      },
    },
    { type: "checkbox", key: "mixed", label: "Viết kết quả lớn hơn 1 thành hỗn số" },
  ],
  readouts: [
    {
      label: "Kết quả (tối giản)",
      value: s => {
        const r = calculate(s);
        return hidden(s) ? "?" : !r ? "không chia được cho 0" : r.d === 1 ? String(r.n) : `${r.n}/${r.d}`;
      },
    },
    {
      label: "Phân số đảo ngược của số chia",
      value: s => {
        const { n2, d2 } = operands(s);
        return !div(s) ? "–" : n2 ? `${d2}/${n2}` : "không có";
      },
    },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 520 || h < 420;
    const pad = small ? 8 : 18;
    const o = operands(s);
    const { n1, d1, n2, d2 } = o;
    const r = calculate(s);
    const f1 = F(n1, d1, A);
    const f2 = F(n2, d2, B);
    const size = small ? 16 : 26;
    const rowH = size * 2.7;
    const maxW = w - 2 * pad;

    // the calculation, written out
    let lines;
    if (hidden(s)) lines = [[f1, T(div(s) ? ":" : "×"), f2, T("="), T("?", COLORS.purple)]];
    else if (!div(s)) lines = [[f1, T("×"), f2, T("="), F(`${n1} × ${n2}`, `${d1} × ${d2}`), ...tail(s, r)]];
    else if (!r) lines = [[f1, T(":"), f2, T("không tính được", COLORS.red)]];
    else {
      const inv = reciprocal(n2, d2);
      const first = [f1, T(":"), f2, T("="), f1, T("×"), F(inv.n, inv.d, B)];
      const second = [T("="), F(`${n1} × ${d2}`, `${d1} × ${n2}`), ...tail(s, r)];
      lines = small || w < 760 ? [first, second] : [[...first, ...second]];
    }
    lines.forEach((parts, i) => line(ctx, parts, w / 2, pad / 2 + rowH * (i + 0.5), size, maxW));
    const top = pad / 2 + rowH * lines.length;

    // one or two lines of explanation at the bottom
    const cap = small ? 13 : 17;
    const capH = cap * 2.5;
    const notes = [];
    if (div(s) && !r) {
      notes.push([T("Số chia bằng 0. Không có phép chia cho 0.", COLORS.red)]);
      if (!small) notes.push([T("Em hãy tăng tử số thứ hai lên.", COLORS.muted)]);
    } else if (hidden(s)) {
      notes.push([T(s._tried.length ? "Chưa đúng, em xem lại hình nhé." : "Bấm vào kết quả đúng (phân số tối giản) ở bên dưới.", s._tried.length ? COLORS.red : COLORS.muted)]);
    } else if (!div(s)) {
      const m = area(n1, d1, n2, d2);
      notes.push([T(`Phần tô đậm có ${n1} × ${n2} = ${m.overlap} ô. Mỗi đơn vị có ${d1} × ${d2} = ${m.cellsPerUnit} ô.`)]);
      if (!small) notes.push([T("Tích là", COLORS.muted), F(m.overlap, m.cellsPerUnit, R), T(r.n > r.d ? "của một đơn vị: lớn hơn 1." : "của một đơn vị.", COLORS.muted)]);
    } else {
      const f = fitting(n1, d1, n2, d2);
      const rest = simplify(f.rest, f.partsB);
      notes.push(
        n1 === 0
          ? [T("Số bị chia bằng 0 nên thương bằng 0.")]
          : f.rest === 0
            ? [f2, T(`lấy ${f.whole} lần thì vừa bằng`), f1, T(".")]
            : f.whole === 0
              ? [f1, T("chỉ bằng"), F(rest.n, rest.d, COLORS.purple), T("của"), f2, T(".")]
              : [f1, T("chứa"), f2, T(`được ${f.whole} lần và`), F(rest.n, rest.d, COLORS.purple), T("lần nữa.")]
      );
      if (!small) notes.push([T("Chia cho một phân số là nhân với phân số đảo ngược của nó.", COLORS.muted)]);
    }
    if (practice(s) && s._solved) notes.splice(small ? 0 : 1, 1, [T("Đúng rồi! Giỏi quá!", COLORS.green)]);
    notes.forEach((parts, i) => line(ctx, parts, w / 2, h - capH * (notes.length - i - 0.5) - 2, cap, maxW, { bold: i === 0 }));

    const box = { x: pad, y: top, w: w - 2 * pad, h: h - top - capH * notes.length - 4 };
    if (box.h < 40) return;
    if (!div(s)) drawArea(ctx, o, box, small);
    else if (r) drawBars(ctx, o, box, small, hidden(s));
  },
});
