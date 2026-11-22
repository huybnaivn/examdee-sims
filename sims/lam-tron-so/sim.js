import { mount, COLORS, clamp, fmt, label } from "../../kit/v1/kit.js";
import { SCALE, MAX, PLACES, placeOf, initialState, valueOf, partsOf, roundTo, marks, digitAt, nextDigit, format, estimateOf, operandsOf, questionOf, isCorrect, newQuestion } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Centred text that shrinks to fit maxW. */
function fit(ctx, text, x, y, size, maxW, opts = {}) {
  ctx.font = `${opts.bold ? "600 " : ""}${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  label(ctx, text, x, y, { ...opts, align: "center", size: w > maxW ? Math.max(9, (size * maxW) / w) : size });
}

const is = mode => s => s.mode === mode;
const whole = n => format(n * SCALE); // a whole number, written with digit groups

/** Where the zoomed number line is (shared by draw and the pointer). */
function geom(view) {
  const small = view.w < 520 || view.h < 420;
  const padX = small ? 36 : Math.min(110, view.w * 0.12);
  return { small, x0: padX, x1: view.w - padX, y: Math.round(view.h * (small ? 0.64 : 0.6)), chipY: small ? 30 : 44 };
}

const emitRounded = (s, api) => {
  const m = valueOf(s);
  api.emit("rounded", { value: m / SCALE, place: s.place / SCALE, rounded: roundTo(m, placeOf(s.place).unit) / SCALE }, "result");
};
const emitEstimated = (s, api) => {
  const { a, b } = operandsOf(s);
  const e = estimateOf(s);
  api.emit("estimated", { a, b, exact: e.exact, estimate: e.approx, error: e.error }, "result");
};

/** Practice: the learner chooses the left (0) or right (1) mark. One try per question. */
function choose(s, api, side) {
  if (s._picked != null) return;
  const { m, unit } = questionOf(s);
  const k = marks(m, unit);
  const answer = side ? k.hi : k.lo;
  s._picked = answer;
  const data = { value: m / SCALE, place: unit / SCALE, rounded: roundTo(m, unit) / SCALE };
  api.emit("rounded", data, "result");
  if (isCorrect(m, unit, answer)) api.emit("correct-answer", data, "goal");
  else api.emit("wrong-answer", { value: m / SCALE, place: unit / SCALE, answer: answer / SCALE }, "action");
}

/** Why the number rounds the way it does, in the words of the rule. */
function ruleText(m, unit) {
  const p = placeOf(unit);
  const k = marks(m, unit);
  if (k.onMark) return `${format(m)} đã là số tròn đến ${p.name}: giữ nguyên`;
  const d = nextDigit(m, unit);
  const rule = d >= 5 ? "≥ 5: cộng thêm 1" : "< 5: giữ nguyên";
  if (m < 0) return `Số đối ${format(-m)}: chữ số sau ${p.name} là ${d} ${rule}; đặt lại dấu −`;
  return `Chữ số ${p.name} là ${digitAt(m, unit)}, chữ số ngay bên phải là ${d} ${rule}`;
}
function nearText(m, unit) {
  const p = placeOf(unit);
  const k = marks(m, unit);
  const r = format(roundTo(m, unit), p.decimals);
  if (k.onMark) return "Số nằm đúng trên một mốc";
  if (k.toLo === k.toHi) return m < 0 ? `Cách đều hai mốc: quy ước với số âm, làm tròn thành ${r}` : `Cách đều hai mốc: quy ước làm tròn lên, thành ${r}`;
  return `Gần ${r} hơn (cách ${format(Math.min(k.toLo, k.toHi))}) nên làm tròn thành ${r}`;
}

/**
 * The number line zoomed to the two marks around m. `reveal` shows the point and the distances;
 * `picked` is the mark chosen in practice (null = not yet).
 */
function drawLine(ctx, g, m, unit, lo, { reveal, picked, practice }) {
  const { small, x0, x1, y } = g;
  const p = placeOf(unit);
  const hi = lo + unit;
  const X = v => x0 + ((v - lo) / unit) * (x1 - x0);
  const right = roundTo(m, unit);

  // the wider line this one is a zoom of: ten steps of the place, with our step marked
  const yo = y - (small ? 96 : 150);
  const start = Math.floor(lo / (unit * 10)) * unit * 10;
  const O = v => x0 + ((v - start) / (unit * 10)) * (x1 - x0);
  ctx.fillStyle = "rgba(47, 111, 237, 0.08)";
  ctx.beginPath();
  ctx.moveTo(O(lo), yo);
  ctx.lineTo(O(hi), yo);
  ctx.lineTo(x1, y - (small ? 44 : 70));
  ctx.lineTo(x0, y - (small ? 44 : 70));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, yo);
  ctx.lineTo(x1, yo);
  for (let i = 0; i <= 10; i++) {
    ctx.moveTo(O(start + i * unit), yo - 4);
    ctx.lineTo(O(start + i * unit), yo + 4);
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(O(lo), yo);
  ctx.lineTo(O(hi), yo);
  ctx.stroke();
  const os = small ? 10 : 13;
  label(ctx, format(start, p.decimals), x0, yo - os - 2, { align: "center", size: os, color: COLORS.muted });
  label(ctx, format(start + unit * 10, p.decimals), x1, yo - os - 2, { align: "center", size: os, color: COLORS.muted });
  fit(ctx, `Phóng to đoạn từ ${format(lo, p.decimals)} đến ${format(hi, p.decimals)}`, (x0 + x1) / 2, yo - os - 2, os, x1 - x0 - 90, { color: COLORS.blue });

  // the zoomed line
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x0 - 14, y);
  ctx.lineTo(x1 + 14, y);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const t = i % 10 === 0 ? 12 : 6;
    ctx.moveTo(X(lo + (i * unit) / 10), y - t);
    ctx.lineTo(X(lo + (i * unit) / 10), y + t);
  }
  ctx.stroke();
  // the halfway mark
  const xm = (x0 + x1) / 2;
  ctx.save();
  ctx.strokeStyle = COLORS.purple;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(xm, y - (small ? 22 : 34));
  ctx.lineTo(xm, y + (small ? 16 : 22));
  ctx.stroke();
  ctx.restore();
  label(ctx, `${format(lo + unit / 2)} (chính giữa)`, xm, y + (small ? 25 : 36), { align: "center", size: small ? 11 : 14, color: COLORS.purple });

  // the two marks, as big chips
  const size = small ? 16 : 24;
  [lo, hi].forEach((v, side) => {
    const text = format(v, p.decimals);
    ctx.font = `600 ${size}px ${FONT}`;
    const tw = Math.max(ctx.measureText(text).width + 16, small ? 48 : 70);
    const cx = clamp(side ? x1 : x0, tw / 2 + 2, ctx.canvas.clientWidth - tw / 2 - 2);
    const cy = y + g.chipY + size * 0.4;
    const good = v === right;
    const shown = practice ? picked != null : reveal;
    const fill = shown && good ? COLORS.green : practice && picked === v ? COLORS.red : "#fff";
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill === "#fff" ? (practice && picked == null ? COLORS.blue : COLORS.muted) : fill;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, cy - size * 0.85, tw, size * 1.7, 10);
    ctx.fill();
    ctx.stroke();
    label(ctx, text, cx, cy + 1, { align: "center", size, bold: true, color: fill === "#fff" ? COLORS.ink : "#fff" });
  });

  if (!reveal) return;
  const k = marks(m, unit);
  const xp = X(m);
  // distances to both marks
  const dy = y - (small ? 18 : 26);
  const ds = small ? 11 : 15;
  [
    [x0, xp, m - lo],
    [xp, x1, hi - m],
  ].forEach(([a, b, d], i) => {
    if (d <= 0) return;
    const near = i ? k.toHi <= k.toLo : k.toLo <= k.toHi;
    ctx.strokeStyle = near ? COLORS.green : COLORS.muted;
    ctx.lineWidth = near ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(a + 2, dy);
    ctx.lineTo(b - 2, dy);
    ctx.stroke();
    const text = `cách ${format(d)}`;
    ctx.font = `600 ${ds}px ${FONT}`;
    const half = ctx.measureText(text).width / 2;
    // keep the two captions on their own side of the point's bubble
    const cx = i ? Math.max((a + b) / 2, Math.min(xp + half + 34, x1)) : Math.min((a + b) / 2, Math.max(xp - half - 34, x0));
    label(ctx, text, cx, dy - ds * 0.9, { align: "center", size: ds, bold: near, color: near ? COLORS.green : COLORS.muted });
  });
  // the number itself
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.arc(xp, y, small ? 7 : 9, 0, Math.PI * 2);
  ctx.fill();
  const ps = small ? 14 : 20;
  const text = format(m);
  ctx.font = `600 ${ps}px ${FONT}`;
  const tw = ctx.measureText(text).width + 14;
  const by = y - (small ? 52 : 78);
  const bx = clamp(xp, tw / 2 + 2, ctx.canvas.clientWidth - tw / 2 - 2);
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xp, y - 8);
  ctx.lineTo(xp, by + ps * 0.8);
  ctx.stroke();
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.roundRect(bx - tw / 2, by - ps * 0.8, tw, ps * 1.6, 8);
  ctx.fill();
  label(ctx, text, bx, by + 1, { align: "center", size: ps, bold: true, color: "#fff" });
}

function drawEstimate(ctx, s, view) {
  const { w, h } = view;
  const small = w < 520 || h < 420;
  const { a, b } = operandsOf(s);
  const e = estimateOf(s);
  const sign = s.eop === "mul" ? "×" : "+";
  const big = small ? 20 : 32;
  const mid = small ? 13 : 18;
  let y = small ? 20 : 36;
  fit(ctx, `${whole(a)} ${sign} ${whole(b)} ≈ ${whole(e.ra)} ${sign} ${whole(e.rb)} = ${whole(e.approx)}`, w / 2, y, big, w - 16, { bold: true, color: COLORS.blue });
  y += big * 1.15;
  const how = u => PLACES.find(p => p.unit === u * SCALE).name;
  fit(ctx, `${whole(a)} ≈ ${whole(e.ra)} (${how(e.ua)})   ·   ${whole(b)} ≈ ${whole(e.rb)} (${how(e.ub)})`, w / 2, y, mid, w - 16, { color: COLORS.muted });

  // two bars: the exact result and the estimate, on the same scale
  const top = y + mid * 1.6;
  const barH = Math.min(small ? 34 : 60, (h - top - (small ? 78 : 120)) / 2.4);
  const x0 = small ? 10 : 40;
  const full = w - 2 * x0;
  const maxV = Math.max(e.exact, e.approx, 1);
  [
    ["Kết quả đúng", e.exact, COLORS.green],
    ["Ước lượng", e.approx, COLORS.blue],
  ].forEach(([name, v, color], i) => {
    const by = top + i * (barH * 1.4);
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(x0, by, full, barH);
    ctx.fillStyle = color;
    ctx.fillRect(x0, by, (full * v) / maxV, barH);
    ctx.font = `600 ${mid}px ${FONT}`;
    const text = `${name}: ${whole(v)}`;
    const inside = (full * v) / maxV > ctx.measureText(text).width + 16;
    label(ctx, text, x0 + 8 + (inside ? 0 : (full * v) / maxV), by + barH / 2 + 1, { size: mid, bold: true, color: inside ? "#fff" : COLORS.ink });
  });
  y = top + barH * 2.8 + mid * 0.9;
  const off = Math.abs(e.error);
  const verdict = off === 0 ? "Ước lượng trùng với kết quả đúng" : `Ước lượng ${e.error > 0 ? "lớn hơn" : "nhỏ hơn"} kết quả đúng ${whole(off)} (khoảng ${fmt(e.percent, 1)} %)`;
  fit(ctx, verdict, w / 2, y, mid, w - 16, { bold: true, color: COLORS.purple });
  y += mid * 1.5;
  // each rounding is off by at most half a unit of its place
  const each = e.ua === e.ub ? `Mỗi số lệch không quá ${fmt(e.ua / 2, 1)}` : `Hai số lệch không quá ${fmt(e.ua / 2, 1)} và ${fmt(e.ub / 2, 1)}`;
  const why = e.approx === 0 ? "Một số đã bị làm tròn thành 0: hãy chọn hàng nhỏ hơn" : `${each} nên ${s.eop === "mul" ? "tích" : "tổng"} lệch không quá ${whole(Math.floor(e.bound))}`;
  fit(ctx, why, w / 2, y, small ? 11 : 15, w - 12, { color: e.approx === 0 ? COLORS.red : COLORS.muted });
}

mount({
  slug: "lam-tron-so",
  version: "1.0.0",
  title: "Làm tròn số và ước lượng",
  hint: "Số nằm giữa hai mốc của hàng làm tròn. Gần mốc nào hơn thì làm tròn thành mốc đó; ở chính giữa thì làm tròn lên.",
  initialState,
  controls: [
    {
      type: "select",
      key: "mode",
      label: "Em muốn",
      options: [
        { value: "round", label: "Làm tròn một số" },
        { value: "estimate", label: "Ước lượng tổng, tích" },
        { value: "practice", label: "Luyện tập" },
      ],
      onChange: s => {
        s._picked = null;
      },
    },
    { type: "select", key: "place", label: "Làm tròn đến", visible: is("round"), options: [...PLACES].reverse().map(p => ({ value: p.unit, label: p.name })), onCommit: emitRounded },
    { type: "slider", key: "int", label: "Phần nguyên", min: 0, max: 9999, step: 1, digits: 0, format: v => String(v), visible: is("round"), onCommit: emitRounded },
    { type: "slider", key: "frac", label: "Phần thập phân", min: 0, max: 999, step: 1, digits: 0, format: v => `0,${String(v).padStart(3, "0")}`, visible: is("round"), onCommit: emitRounded },
    { type: "checkbox", key: "neg", label: "Số âm (có dấu −)", visible: is("round"), onCommit: emitRounded },

    {
      type: "select",
      key: "eop",
      label: "Phép tính",
      visible: is("estimate"),
      options: [
        { value: "add", label: "Tổng a + b" },
        { value: "mul", label: "Tích a × b" },
      ],
      onCommit: emitEstimated,
    },
    { type: "slider", key: "ea", label: "Số a", min: 1, max: 9999, step: 1, digits: 0, format: v => String(v), visible: is("estimate"), onCommit: emitEstimated },
    { type: "slider", key: "eb", label: "Số b", min: 1, max: 9999, step: 1, digits: 0, format: v => String(v), visible: is("estimate"), onCommit: emitEstimated },
    {
      type: "select",
      key: "ePlace",
      label: "Làm tròn mỗi số đến",
      visible: is("estimate"),
      options: [
        { value: 100, label: "hàng trăm" },
        { value: 10, label: "hàng chục" },
        { value: 1000, label: "hàng nghìn" },
        { value: 0, label: "hàng cao nhất của mỗi số" },
      ],
      onCommit: emitEstimated,
    },

    { type: "button", label: "◀ Chọn mốc bên trái", visible: is("practice"), disabled: s => s._picked != null, action: (s, api) => choose(s, api, 0) },
    { type: "button", label: "Chọn mốc bên phải ▶", visible: is("practice"), disabled: s => s._picked != null, action: (s, api) => choose(s, api, 1) },
    {
      type: "button",
      label: "Câu khác",
      primary: true,
      visible: is("practice"),
      event: "new-question",
      action: s => {
        Object.assign(s, newQuestion(Math.random, s));
        s._picked = null;
      },
    },
  ],
  readouts: [
    {
      label: "Kết quả",
      value: s => {
        if (s.mode === "estimate") return (e => `≈ ${whole(e.approx)} (đúng: ${whole(e.exact)})`)(estimateOf(s));
        if (s.mode === "practice") return (({ m, unit }) => (s._picked == null ? `${format(m)} ≈ ?` : `${format(m)} ≈ ${format(roundTo(m, unit), placeOf(unit).decimals)}`))(questionOf(s));
        const m = valueOf(s);
        return `${format(m)} ≈ ${format(roundTo(m, s.place), placeOf(s.place).decimals)}`;
      },
    },
  ],
  pointer: {
    down(p, s, api, view) {
      const g = geom(view);
      if (s.mode === "practice") {
        // tap a mark: the left or the right half of the band around the chips
        if (p.y < g.y - 30 || p.y > g.y + g.chipY + 40) return false;
        const side = Math.abs(p.x - g.x0) < 70 ? 0 : Math.abs(p.x - g.x1) < 70 ? 1 : -1;
        if (side >= 0) choose(s, api, side);
        api.sync();
        return false;
      }
      if (s.mode !== "round" || Math.abs(p.y - g.y) > 44 || p.x < g.x0 - 30 || p.x > g.x1 + 30) return false;
      s._drag = { lo: marks(valueOf(s), placeOf(s.place).unit).lo };
      this.move(p, s, api, view);
    },
    move(p, s, api, view) {
      if (!s._drag) return;
      const g = geom(view);
      const unit = placeOf(s.place).unit;
      const stepSize = Math.max(1, unit / 100);
      const t = clamp((p.x - g.x0) / (g.x1 - g.x0), 0, 1);
      const m = clamp(s._drag.lo + Math.round((t * unit) / stepSize) * stepSize, -MAX, MAX);
      Object.assign(s, partsOf(m));
    },
    up(p, s, api) {
      if (!s._drag) return;
      s._drag = null;
      api.emit("number-dragged", { value: valueOf(s) / SCALE }, "action");
      emitRounded(s, api);
    },
  },
  draw(ctx, s, view) {
    if (s.mode === "estimate") return drawEstimate(ctx, s, view);
    const { w, h } = view;
    const g = geom(view);
    const { small } = g;
    const big = small ? 24 : 38;
    const mid = small ? 12.5 : 18;
    const y1 = small ? 19 : 34;
    const y2 = y1 + big * 0.92;
    const y3 = y2 + mid * 1.45;
    const yb = h - (small ? 12 : 26);

    if (s.mode === "practice") {
      const { m, unit } = questionOf(s);
      const p = placeOf(unit);
      const k = marks(m, unit);
      const done = s._picked != null;
      const ok = done && isCorrect(m, unit, s._picked);
      fit(ctx, done ? `${format(m)} ≈ ${format(roundTo(m, unit), p.decimals)}` : `${format(m)} ≈ ?`, w / 2, y1, big, w - 16, { bold: true, color: done ? (ok ? COLORS.green : COLORS.red) : COLORS.ink });
      fit(ctx, `Làm tròn ${format(m)} đến ${p.name}`, w / 2, y2, mid, w - 16, { bold: true });
      fit(ctx, done ? ruleText(m, unit) : "Số này gần mốc nào hơn? Bấm vào mốc em chọn.", w / 2, y3, small ? 11 : 15, w - 12, { color: COLORS.muted });
      drawLine(ctx, g, m, unit, k.lo, { reveal: done, picked: s._picked, practice: true });
      if (done) fit(ctx, `${ok ? "Đúng rồi!" : "Chưa đúng."} ${nearText(m, unit)}`, w / 2, yb, mid, w - 12, { bold: true, color: ok ? COLORS.green : COLORS.red });
      return;
    }

    const m = valueOf(s);
    const p = placeOf(s.place);
    const k = marks(m, p.unit);
    const lo = s._drag ? s._drag.lo : k.lo;
    fit(ctx, `${format(m)} ≈ ${format(roundTo(m, p.unit), p.decimals)}`, w / 2, y1, big, w - 16, { bold: true, color: COLORS.blue });
    fit(ctx, `Làm tròn đến ${p.name}`, w / 2, y2, mid, w - 16, { bold: true });
    fit(ctx, ruleText(m, p.unit), w / 2, y3, small ? 11 : 15, w - 12, { color: COLORS.muted });
    drawLine(ctx, g, m, p.unit, lo, { reveal: true });
    fit(ctx, nearText(m, p.unit), w / 2, yb, mid, w - 12, { bold: true, color: COLORS.purple });
  },
});
