import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  initialState, step, restart, halfLife, unit, rate, elapsed, finished, decayConstant, expected, activity,
  sample, remaining, halfLivesPassed, ISOTOPES, SPAN,
} from "./model.js";

const digitsFor = T => (T >= 100 ? 0 : T >= 10 ? 1 : 2);
const time = (s, t) => `${fmt(t, digitsFor(halfLife(s)))} ${unit(s)}`;
const name = s => ISOTOPES[s.isotope]?.symbol ?? "X";
const perUnit = s => (unit(s).includes(" ") ? `(${unit(s)})⁻¹` : `${unit(s)}⁻¹`);

function drawSample(ctx, s, box, small) {
  const { life } = sample(s);
  const x = elapsed(s) / halfLife(s);
  const n = life.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * box.w) / box.h)));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(box.w / cols, box.h / rows);
  const r = Math.max(1, cell * 0.38);
  const x0 = box.x + (box.w - cols * cell) / 2 + cell / 2;
  const y0 = box.y + (box.h - rows * cell) / 2 + cell / 2;
  for (const alive of [false, true]) {
    ctx.fillStyle = alive ? COLORS.blue : "#cfd6e4";
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (life[i] > x !== alive) continue;
      const cx = x0 + (i % cols) * cell;
      const cy = y0 + Math.floor(i / cols) * cell;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  const left = remaining(s);
  const size = small ? 11 : 13;
  const cx = box.x + box.w / 2;
  label(ctx, `Mẫu ${name(s)}: N₀ = ${fmt(n, 0)} hạt nhân`, cx, box.y - (small ? 10 : 16), { align: "center", size: small ? 12 : 15, bold: true });
  const y = box.y + box.h + (small ? 10 : 18);
  const a = `chưa phân rã: ${fmt(left, 0)}`;
  const b = `đã phân rã: ${fmt(n - left, 0)}`;
  ctx.font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const wa = ctx.measureText(a).width;
  const total = wa + ctx.measureText(b).width + 52;
  let px = cx - total / 2;
  for (const [text, color, w] of [[a, COLORS.blue, wa], [b, "#cfd6e4", 0]]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px + 5, y, 5, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, text, px + 14, y, { size, color: COLORS.muted });
    px += w + 38;
  }
}

function drawGraph(ctx, s, g, small) {
  const T = halfLife(s);
  const n0 = s.n0;
  const t = elapsed(s);
  const X = v => g.x + (v / (SPAN * T)) * g.w;
  const Y = v => g.y + g.h - (v / n0) * g.h;
  const size = small ? 10 : 12;

  // half-life marks: t = kT down from the curve, N0/2^k across to it
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#c3ccdc";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let k = 1; k <= SPAN; k++) {
    ctx.moveTo(X(k * T), Y(0));
    ctx.lineTo(X(k * T), k <= 3 ? Y(n0 / 2 ** k) : Y(0) - 6);
    if (k <= 3) {
      ctx.moveTo(g.x, Y(n0 / 2 ** k));
      ctx.lineTo(X(k * T), Y(n0 / 2 ** k));
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // axes
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y - 8);
  ctx.lineTo(g.x, Y(0));
  ctx.lineTo(g.x + g.w + 6, Y(0));
  ctx.stroke();
  label(ctx, "N", g.x - 6, g.y - 14, { size: size + 1, bold: true, align: "right" });
  label(ctx, `t (${unit(s)})`, g.x + g.w + 6, Y(0) + (small ? 24 : 44), { size, bold: true, align: "right" });
  [["N₀", 1], ["N₀/2", 2], ["N₀/4", 4], ["N₀/8", 8]].forEach(([text, d]) =>
    label(ctx, small ? text : `${text} = ${fmt(n0 / d, 0)}`, g.x - 6, Y(n0 / d), { size, align: "right", color: COLORS.muted })
  );
  label(ctx, "0", g.x - 6, Y(0), { size, align: "right", color: COLORS.muted });
  for (let k = 1; k <= SPAN; k++) {
    label(ctx, k === 1 ? "T" : `${k}T`, X(k * T), Y(0) + 11, { size, align: "center", bold: true });
    if (!small) label(ctx, fmt(k * T, digitsFor(T)), X(k * T), Y(0) + 27, { size: 11, align: "center", color: COLORS.muted });
  }

  // theory
  if (s.showTheory) {
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const v = (i / 120) * SPAN * T;
      ctx.lineTo(X(v), Y(expected(n0, v, T)));
    }
    ctx.stroke();
  }

  // counted, from t = 0 to now (recomputed from the sample, so nothing has to be stored)
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const steps = Math.max(1, Math.ceil(X(t) - g.x));
  for (let i = 0; i <= steps; i++) {
    const v = (i / steps) * t;
    ctx.lineTo(X(v), Y(remaining(s, v)));
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.blue;
  for (let k = 1; k <= halfLivesPassed(s); k++) {
    const n = remaining(s, k * T);
    ctx.beginPath();
    ctx.arc(X(k * T), Y(n), 4, 0, Math.PI * 2);
    ctx.fill();
    if (k <= 3) label(ctx, fmt(n, 0), X(k * T) + 7, Y(n) - 9, { size, bold: true, color: COLORS.blue });
  }
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(X(t), Y(remaining(s)), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // legend, top right (the curves are low there)
  const lx = g.x + g.w;
  const row = small ? 14 : 18;
  const items = [["đếm được", COLORS.blue]];
  if (s.showTheory) items.push(["lí thuyết N = N₀·2^(−t/T)", COLORS.orange]);
  items.forEach(([text, color], i) => {
    const y = g.y + 2 + i * row;
    ctx.font = `${size + 1}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const w = ctx.measureText(text).width;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx - w - 28, y);
    ctx.lineTo(lx - w - 8, y);
    ctx.stroke();
    label(ctx, text, lx, y, { size: size + 1, align: "right" });
  });
  const note = ISOTOPES[s.isotope]
    ? `Thời gian được nén: 1 s trên màn hình = ${time(s, rate(s))}`
    : "Thời gian thực: 1 s trên màn hình = 1 s";
  label(ctx, note, lx, g.y + 2 + items.length * row + 2, { size, align: "right", color: COLORS.muted });
}

const fresh = s => void restart(s);

mount({
  slug: "phong-xa",
  version: "1.0.0",
  title: "Phóng xạ và chu kì bán rã",
  hint: "Bấm Chạy để theo dõi mẫu phân rã. Mỗi hạt nhân phân rã ngẫu nhiên, nhưng cứ sau một chu kì bán rã T thì còn lại khoảng một nửa.",
  initialState,
  step(s, dt, api) {
    const before = finished(s) ? 0 : halfLivesPassed(s);
    step(s, dt);
    const T = halfLife(s);
    // One result per half-life mark crossed, not per frame.
    for (let k = before + 1; k <= halfLivesPassed(s); k++) {
      api.emit("half-life-reached", { halfLives: k, time: k * T, remaining: remaining(s, k * T), expected: expected(s.n0, k * T, T) }, "result");
    }
    if (finished(s)) api.pause();
  },
  controls: [
    {
      type: "select",
      key: "isotope",
      label: "Chất phóng xạ",
      onChange: fresh,
      options: [
        ...Object.entries(ISOTOPES).map(([value, i]) => ({ value, label: `${i.label}, T = ${fmt(i.T)} ${i.unit}` })),
        { value: "custom", label: "Tự chọn chu kì bán rã" },
      ],
    },
    { type: "slider", key: "customT", label: "Chu kì bán rã T", min: 1, max: 10, step: 0.5, unit: "s", digits: 1, onChange: fresh, visible: s => s.isotope === "custom" },
    { type: "slider", key: "n0", label: "Số hạt nhân ban đầu N₀", min: 50, max: 1000, step: 50, digits: 0, onChange: fresh },
    { type: "checkbox", key: "showTheory", label: "Hiện đường lí thuyết N = N₀·2^(−t/T)" },
    {
      type: "button",
      label: "Mẫu mới (t = 0)",
      event: "new-sample",
      action(s, api) {
        restart(s);
        api.play();
      },
    },
  ],
  readouts: [
    { label: "Thời gian t", value: s => `${time(s, elapsed(s))} = ${fmt(elapsed(s) / halfLife(s))} T` },
    { label: "Số hạt còn lại N", value: s => fmt(remaining(s), 0) },
    { label: "Lí thuyết N₀·2^(−t/T)", value: s => fmt(expected(s.n0, elapsed(s), halfLife(s)), 1) },
    { label: "Hằng số phóng xạ λ", value: s => `${fmt(decayConstant(halfLife(s)), 4).replace(/^0$/, "≈ 0")} ${perUnit(s)}` },
    { label: "H = λN", value: s => `${fmt(activity(remaining(s), halfLife(s)), 2)} ${unit(s) === "s" ? "Bq" : `phân rã/${unit(s)}`}` },
  ],
  draw(ctx, s, view) {
    const wide = view.w >= 620;
    const small = view.w < 560 || view.h < 420;
    if (wide) {
      const gw = Math.min(view.w * 0.34, view.h - 130);
      drawSample(ctx, s, { x: 24, y: (view.h - gw) / 2, w: gw, h: gw }, small);
      const left = 24 + gw + (small ? 56 : 112);
      drawGraph(ctx, s, { x: left, y: 54, w: view.w - left - 28, h: view.h - 54 - (small ? 36 : 62) }, small);
    } else {
      const gh = Math.max(40, view.h * 0.28);
      drawSample(ctx, s, { x: 10, y: 22, w: view.w - 20, h: gh }, small);
      const top = 22 + gh + 44;
      drawGraph(ctx, s, { x: 44, y: top, w: view.w - 44 - 14, h: view.h - top - (small ? 34 : 40) }, small);
    }
  },
});
