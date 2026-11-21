import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, EXPERIMENTS, EVENTS, EVENT_KEY, MAX_CARDS, MAX_TRIALS, event, theory, run, clear, hits, totalTrials, fixMix, sanitize } from "./model.js";

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const CARD_COLORS = [COLORS.red, COLORS.blue, COLORS.yellow];
const OTHER = "#b9c4d8"; // bars of results outside A

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** "6/36 = 1/6 ≈ 0,167", "0", "1". */
function fraction(num, den) {
  if (num === 0) return "0";
  if (num === den) return "1";
  const g = gcd(num, den);
  const reduced = g > 1 ? ` = ${num / g}/${den / g}` : "";
  const v = num / den;
  const exact = Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-9;
  return `${num}/${den}${reduced} ${exact ? "=" : "≈"} ${fmt(v, 3)}`;
}

const freqText = s => {
  const n = totalTrials(s);
  return n ? fraction(hits(s), n).replace(/ = \d+\/\d+/, "") : "–"; // f = m/N, not reduced
};

function report(s, api, batch) {
  const n = run(s, batch);
  if (!n) return;
  const N = totalTrials(s);
  api.emit("trials-run", { batch: n, trials: N, hits: hits(s), frequency: hits(s) / N, probability: theory(s).p }, "result");
}

const batchButton = (k, primary) => ({
  type: "button",
  label: `Thực hiện ${fmt(k, 0)} lần`,
  primary,
  disabled: s => totalTrials(s) >= MAX_TRIALS,
  action: (s, api) => report(s, api, k),
});

const eventSelect = exp => ({
  type: "select",
  key: EVENT_KEY[exp],
  label: "Biến cố A",
  visible: s => s.experiment === exp,
  onChange: clear,
  options: EVENTS[exp].map(e => ({ value: e.id, label: e.label })),
});

const cardSlider = (key, name) => ({
  type: "slider",
  key,
  label: `Số thẻ ${name}`,
  min: 0,
  max: MAX_CARDS,
  step: 1,
  digits: 0,
  visible: s => s.experiment === "cards",
  onChange(s) {
    fixMix(s, key);
    if (s.experiment === "cards") clear(s);
  },
});

// ---------- drawing ----------

function niceStep(x) {
  for (const k of [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1]) if (k >= x) return k;
  return 1;
}

function pips(ctx, cx, cy, size, face) {
  const r = size * 0.09;
  const d = size * 0.26;
  const at = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  }[face];
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  for (const [i, j] of at) {
    ctx.beginPath();
    ctx.arc(cx + i * d, cy + j * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The last result, drawn right-aligned at (x, cy). */
function lastResult(ctx, s, x, cy, size) {
  if (s.last1 < 0) return;
  if (s.experiment === "dice" && s.last2 >= 0) {
    pips(ctx, x - size / 2, cy, size, s.last2 + 1);
    pips(ctx, x - size * 1.75, cy, size, s.last1 + 1);
  } else if (s.experiment === "die") {
    pips(ctx, x - size / 2, cy, size, s.last1 + 1);
  } else if (s.experiment === "coin") {
    ctx.fillStyle = COLORS.yellow;
    ctx.strokeStyle = "#b8901a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - size / 2, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(ctx, EXPERIMENTS.coin.bins[s.last1], x - size / 2, cy + 1, { size: size * 0.5, bold: true, align: "center" });
  } else {
    ctx.fillStyle = CARD_COLORS[s.last1];
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - size * 0.75, cy - size / 2, size * 0.75, size, 4);
    ctx.fill();
    ctx.stroke();
  }
}

function axisBox(ctx, b, title, size) {
  label(ctx, title, b.x, b.y - size * 0.9, { size, bold: true, color: COLORS.ink });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.stroke();
}

function distribution(ctx, s, b, small) {
  const bins = EXPERIMENTS[s.experiment].bins;
  const space = EXPERIMENTS[s.experiment].space(s);
  const { test } = event(s);
  const N = totalTrials(s);
  const freq = s.counts.map(c => (N ? c / N : 0));
  const prob = bins.map((_, k) => space.filter(o => o === k).length / space.length);
  const top = Math.max(...freq, ...prob, 0.05) * 1.12;
  const step = niceStep(top / 4);
  const fs = small ? 10 : 12;
  axisBox(ctx, b, small ? "Tần suất (cột), xác suất (chấm)" : "Tần suất tương đối của từng kết quả (cột) và xác suất lí thuyết (chấm)", small ? 11 : 13);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let v = step; v <= top; v += step) {
    const y = b.y + b.h - (v / top) * b.h;
    ctx.beginPath();
    ctx.moveTo(b.x + 1, y);
    ctx.lineTo(b.x + b.w, y);
    ctx.stroke();
    label(ctx, fmt(v, 2), b.x - 5, y, { size: fs, align: "right", color: COLORS.muted });
  }
  label(ctx, "0", b.x - 5, b.y + b.h, { size: fs, align: "right", color: COLORS.muted });
  const bw = b.w / bins.length;
  bins.forEach((name, k) => {
    const cx = b.x + bw * (k + 0.5);
    const h = (freq[k] / top) * b.h;
    ctx.fillStyle = test(k) ? COLORS.blue : OTHER;
    ctx.fillRect(cx - bw * 0.34, b.y + b.h - h, bw * 0.68, h);
    if (s.experiment === "cards") {
      ctx.fillStyle = CARD_COLORS[k];
      ctx.fillRect(cx - bw * 0.34, b.y + b.h + 2, bw * 0.68, 3);
    }
    label(ctx, name, cx, b.y + b.h + (small ? 11 : 14), { size: fs + 1, align: "center", color: test(k) ? COLORS.blue : COLORS.muted, bold: test(k) });
    if (prob[k] > 0) {
      ctx.fillStyle = COLORS.orange;
      ctx.beginPath();
      ctx.arc(cx, b.y + b.h - (prob[k] / top) * b.h, small ? 3.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function convergence(ctx, s, b, small, p) {
  const N = totalTrials(s);
  const decades = Math.max(1, Math.ceil(Math.log10(Math.max(N, 10)) - 1e-9));
  const X = n => b.x + (Math.log10(n) / decades) * b.w;
  const Y = f => b.y + b.h - f * b.h;
  const fs = small ? 10 : 12;
  axisBox(ctx, b, small ? "Tần suất của A theo số lần thử" : "Tần suất của biến cố A theo số lần thử N (trục N chia theo lũy thừa của 10)", small ? 11 : 13);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (const f of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.moveTo(b.x + 1, Y(f));
    ctx.lineTo(b.x + b.w, Y(f));
    ctx.stroke();
  }
  for (const f of small ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]) label(ctx, fmt(f, 2), b.x - 5, Y(f), { size: fs, align: "right", color: COLORS.muted });
  for (let d = 0; d <= decades; d++) label(ctx, fmt(10 ** d, 0), X(10 ** d), b.y + b.h + (small ? 11 : 14), { size: fs, align: "center", color: COLORS.muted });

  // P(A)
  ctx.strokeStyle = COLORS.orange;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(b.x, Y(p));
  ctx.lineTo(b.x + b.w, Y(p));
  ctx.stroke();
  ctx.setLineDash([]);

  // f(A) after n trials
  if (s.history.length) {
    ctx.strokeStyle = COLORS.blue;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    s.history.forEach(([n, h], i) => (i ? ctx.lineTo(X(n), Y(h / n)) : ctx.moveTo(X(n), Y(h / n))));
    ctx.stroke();
    const [n, h] = s.history.at(-1);
    ctx.fillStyle = COLORS.blue;
    ctx.beginPath();
    ctx.arc(X(n), Y(h / n), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // P(A) label on the side of its line away from the frequency curve, kept inside the box
  const f = N ? hits(s) / N : p;
  let dy = f >= p ? 11 : -11;
  if (Y(p) + dy < b.y + 6 || Y(p) + dy > b.y + b.h - 6) dy = -dy;
  label(ctx, `P(A) ${fmt(p, 3) === fmt(p, 6) ? "=" : "≈"} ${fmt(p, 3)}`, b.x + 6, Y(p) + dy, { size: fs + 1, bold: true, color: COLORS.orange });
}

mount({
  slug: "xac-suat-co-dien",
  version: "1.0.0",
  title: "Xác suất của biến cố",
  hint: "Chọn phép thử và biến cố A, rồi thực hiện phép thử nhiều lần. So sánh tần suất của A với xác suất P(A) = n(A)/n(Ω). Ban đầu đã có sẵn 100 lần gieo hai con xúc xắc.",
  initialState,
  sanitize,
  controls: [
    {
      type: "select",
      key: "experiment",
      label: "Phép thử",
      onChange: clear,
      options: Object.entries(EXPERIMENTS).map(([value, e]) => ({ value, label: e.label })),
    },
    ...Object.keys(EVENTS).map(eventSelect),
    cardSlider("red", "đỏ"),
    cardSlider("blue", "xanh"),
    cardSlider("yellow", "vàng"),
    batchButton(1, true),
    batchButton(10),
    batchButton(100),
    batchButton(1000),
    { type: "button", label: "Xóa kết quả", action: clear },
  ],
  readouts: [
    { label: "Số phần tử của Ω: n(Ω)", value: s => fmt(theory(s).total, 0) },
    { label: "Số kết quả thuận lợi cho A: n(A)", value: s => fmt(theory(s).favourable, 0) },
    { label: "P(A) = n(A)/n(Ω)", value: s => fraction(theory(s).favourable, theory(s).total) },
    { label: "P(Ā) = 1 − P(A)", value: s => fraction(theory(s).total - theory(s).favourable, theory(s).total) },
    { label: "Số lần thử N", value: s => fmt(totalTrials(s), 0) },
    { label: "Số lần A xảy ra", value: s => fmt(hits(s), 0) },
    { label: "Tần suất của A", value: freqText },
  ],
  draw(ctx, s, view) {
    const { w, h } = view;
    const small = w < 560 || h < 420;
    const pad = small ? 8 : 18;
    const th = theory(s);

    // header: experiment, event, P(A) and the last result
    const hs = small ? 12 : 16;
    const icon = small ? 26 : 40;
    const textW = w - 2 * pad - icon * 2 - 10;
    const fit = (text, size, bold) => {
      ctx.font = `${bold ? "600 " : ""}${size}px ${FONT}`;
      return Math.min(size, (size * textW) / ctx.measureText(text).width);
    };
    const line1 = `${EXPERIMENTS[s.experiment].label}. A: ${event(s).label}`;
    const N = totalTrials(s);
    const line2 = small
      ? `P(A) ${fmt(th.p, 3) === fmt(th.p, 6) ? "=" : "≈"} ${fmt(th.p, 3)}; f(A) = ${N ? fmt(hits(s) / N, 3) : "–"}`
      : `P(A) = ${fraction(th.favourable, th.total)}; tần suất f(A) = ${freqText(s)}`;
    label(ctx, line1, pad, pad + hs * 0.6, { size: fit(line1, hs, true), bold: true });
    label(ctx, line2, pad, pad + hs * 1.95, { size: fit(line2, hs - 2, false), color: COLORS.muted });
    lastResult(ctx, s, w - pad, pad + icon / 2, icon);
    if (!small && s.last1 >= 0) label(ctx, "Lần cuối", w - pad, pad + icon + 10, { size: 11, align: "right", color: COLORS.muted });

    // two charts, side by side on a wide stage, stacked otherwise
    const top = pad + hs * 2.7 + (small ? 18 : 40);
    const left = small ? 34 : 52;
    const bottom = small ? 16 : 26;
    const gap = small ? 34 : 56;
    const side = w > h * 1.45 && w > 700;
    const aw = side ? (w - 2 * left - pad - gap / 2) / 2 : w - left - pad;
    const ah = side ? h - top - bottom - pad : (h - top - bottom * 2 - gap - pad) / 2;
    const A = { x: left, y: top, w: aw, h: Math.max(20, ah) };
    const B = side ? { x: left * 2 + aw + gap / 2, y: top, w: aw, h: A.h } : { x: left, y: top + A.h + bottom + gap, w: aw, h: A.h };
    distribution(ctx, s, A, small);
    convergence(ctx, s, B, small, th.p);
  },
});
