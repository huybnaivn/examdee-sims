import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import {
  BOX, RADIUS, LIMITS, initialState, restart, step, ensure, sanitize, activationEnergy, effectiveFraction, concentration, predictedProduct,
} from "./model.js";

const A_COLOR = COLORS.red;
const B_COLOR = COLORS.blue;
const AB_COLOR = COLORS.purple;
const font = (size, bold) => `${bold ? "600 " : ""}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const pct = x => `${fmt(x * 100, 1)} %`;
const measuredFraction = s => (s.collisions ? pct(s.effective / s.collisions) : "–");
const rateText = s => (s.initialRate ? `${fmt(s.initialRate, 3)} mol/(L·s)` : "đang đo…");
const outcome = s => ({
  time: s.time,
  temperature: s.temperature,
  concA: s.concA,
  concB: s.concB,
  catalyst: s.catalyst ? 1 : 0,
  initialRate: s.initialRate,
});

function layout(view) {
  const wide = view.w >= 560;
  const pad = wide ? 20 : 8;
  const header = wide ? 44 : 20;
  const boxH = Math.min((view.h - header - 6) * 0.52, (view.w - 2 * pad) * (BOX.h / BOX.w));
  const boxW = (boxH * BOX.w) / BOX.h;
  const info = wide && view.w - boxW - 3 * pad >= 190;
  const box = { x: info ? pad : (view.w - boxW) / 2, y: header, w: boxW, h: boxH, k: boxW / BOX.w };
  const graph = {
    x0: wide ? 64 : 34,
    x1: view.w - (wide ? 34 : 12),
    y0: header + boxH + (wide ? 40 : 18),
    y1: view.h - (wide ? 44 : 32),
  };
  return { wide, pad, box, graph, info: info ? { x: box.x + boxW + pad, w: view.w - boxW - 3 * pad } : null };
}

function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticle(ctx, k, x, y, r) {
  if (k === 2) {
    disc(ctx, x - r * 0.75, y, r, A_COLOR);
    disc(ctx, x + r * 0.75, y, r, B_COLOR);
  } else disc(ctx, x, y, r, k === 0 ? A_COLOR : B_COLOR);
}

function drawBox(ctx, s, g) {
  const { box } = g;
  ctx.fillStyle = s.catalyst ? "#fffbea" : "#fff";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const r = Math.max(2.5, RADIUS[0] * box.k);
  for (const q of ensure(s)) drawParticle(ctx, q.k, box.x + q.x * box.k, box.y + q.y * box.k, r);
  if (!s.endTime) {
    for (const f of s._flash) {
      const age = (s.time - f.t) / 0.5;
      ctx.strokeStyle = `rgba(240, 140, 46, ${Math.max(0, 1 - age)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(box.x + f.x * box.k, box.y + f.y * box.k, r * (2 + 3 * age), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  const size = g.wide ? 13 : 11;
  const pill = (text, cx, cy, color) => {
    ctx.font = font(size, true);
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - size * 0.85, w, size * 1.7, 6);
    ctx.fill();
    label(ctx, text, cx, cy + 0.5, { size, bold: true, align: "center", color });
  };
  if (s.endTime) {
    const gone = s.nA === 0 && s.nB === 0 ? "A và B" : s.nA === 0 ? "A" : "B";
    pill(`Phản ứng dừng sau ${fmt(s.endTime, 1)} s: đã hết ${gone}`, box.x + box.w / 2, box.y + size + 4, COLORS.green);
  } else if (s.catalyst) pill("Có chất xúc tác", box.x + box.w / 2, box.y + size + 4, COLORS.orange);
}

const niceStep = span => [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(v => span / v <= 6) ?? 10000;

function drawGraph(ctx, s, g) {
  const { x0, x1, y0, y1 } = g.graph;
  if (y1 - y0 < 40) return;
  const size = g.wide ? 12 : 10;
  const cMax = Math.ceil(Math.max(s.concA, s.concB) * 5 - 1e-9) / 5;
  const tMax = s.endTime ? Math.max(1, s.endTime * 1.06) : Math.max(10, s.time * 1.2);
  const X = t => x0 + ((x1 - x0) * t) / tMax;
  const Y = c => y1 - ((y1 - y0) * c) / cMax;

  ctx.fillStyle = "#fff";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const c = (cMax * i) / 2;
    ctx.beginPath();
    ctx.moveTo(x0, Y(c));
    ctx.lineTo(x1, Y(c));
    ctx.stroke();
    label(ctx, fmt(c, 1), x0 - 5, Y(c), { size, align: "right", color: COLORS.muted });
  }
  const dt = niceStep(tMax);
  for (let t = 0; t <= tMax; t += dt) {
    ctx.beginPath();
    ctx.moveTo(X(t), y0);
    ctx.lineTo(X(t), y1);
    ctx.stroke();
    if (g.wide || X(t) < x1 - 34) label(ctx, fmt(t, 0), X(t), y1 + size * 0.9, { size, align: "center", color: COLORS.muted });
  }
  label(ctx, g.wide ? "Nồng độ (mol/L)" : "mol/L", x0, y0 - size * 0.8, { size, color: COLORS.muted });
  if (g.wide) {
    label(ctx, "Thời gian t (s)", x1, y1 + size * 2.3, { size, align: "right", color: COLORS.muted });
    label(ctx, "Nét đứt: dự đoán theo thuyết va chạm (trung bình của nhiều lần chạy)", x0, y1 + size * 2.3, { size, color: COLORS.muted });
  } else label(ctx, "t (s)", x1, y1 + size * 0.9, { size, align: "right", color: COLORS.muted });

  // expected curves from the rate law, dashed
  const a0 = s.nA + s.nAB;
  const b0 = s.nB + s.nAB;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  for (const [color, amount] of [[A_COLOR, x => a0 - x], [B_COLOR, x => b0 - x], [AB_COLOR, x => x]]) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const tt = (tMax * i) / 60;
      const y = Y(concentration(amount(predictedProduct(s, tt))));
      if (i) ctx.lineTo(X(tt), y);
      else ctx.moveTo(X(tt), y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  // marks: half of the limiting reactant used up, and the end
  const mark = (t, text, color) => {
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(t), y0);
    ctx.lineTo(X(t), y1);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, text, X(t) + 4, y0 + size * 0.8, { size, color, bold: true });
  };
  if (s.halfTime) mark(s.halfTime, "50 %", COLORS.orange);
  if (s.endTime) mark(s.endTime, "", COLORS.green);

  // amounts change in whole particles, so the curves are staircases
  const hist = s._hist ?? [];
  [[1, A_COLOR], [2, B_COLOR], [3, AB_COLOR]].forEach(([col, color]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    hist.forEach((h, i) => {
      const y = Y(concentration(h[col]));
      if (i === 0) ctx.moveTo(X(h[0]), y);
      else {
        ctx.lineTo(X(h[0]), Y(concentration(hist[i - 1][col])));
        ctx.lineTo(X(h[0]), y);
      }
    });
    if (hist.length) ctx.lineTo(X(s.time), Y(concentration(hist.at(-1)[col])));
    ctx.stroke();
  });
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function drawLegend(ctx, s, g) {
  const size = g.wide ? 14 : 11;
  const r = g.wide ? 6 : 4;
  const y = g.wide ? 22 : 10;
  let x = g.wide ? g.box.x : 8;
  for (const [k, name, n, color] of [[0, "A", s.nA, A_COLOR], [1, "B", s.nB, B_COLOR], [2, "AB", s.nAB, AB_COLOR]]) {
    drawParticle(ctx, k, x + r * (k === 2 ? 1.75 : 1), y, r);
    x += r * (k === 2 ? 3.5 : 2) + 5;
    const text = g.wide ? `[${name}] = ${fmt(concentration(n), 3)} mol/L` : `[${name}] = ${fmt(concentration(n), 2)}`;
    label(ctx, text, x, y + 0.5, { size, color, bold: true });
    ctx.font = font(size, true);
    x += ctx.measureText(text).width + (g.wide ? 26 : 12);
  }
  if (!g.wide) label(ctx, "mol/L", x - 4, y + 0.5, { size, color: COLORS.muted });
}

const change = s => restart(s);

mount({
  slug: "toc-do-phan-ung",
  version: "1.0.0",
  title: "Tốc độ phản ứng",
  hint: "Các hạt A và B chỉ phản ứng khi va chạm đủ mạnh. Thay đổi nhiệt độ, nồng độ, chất xúc tác rồi so sánh đồ thị.",
  initialState,
  sanitize,
  autoplay: true,
  timeScale: s => s.speed,
  step(s, dt, api) {
    const half = s.halfTime;
    const end = s.endTime;
    step(s, dt);
    // one result per milestone, not per frame
    if (!half && s.halfTime) api.emit("half-complete", outcome(s), "result");
    if (!end && s.endTime) api.emit("finished", outcome(s), "result");
  },
  controls: [
    { type: "slider", key: "temperature", label: "Nhiệt độ", min: LIMITS.temperature[0], max: LIMITS.temperature[1], step: 10, unit: "K", digits: 0, onChange: change },
    { type: "slider", key: "concA", label: "Nồng độ ban đầu của A", min: LIMITS.conc[0], max: LIMITS.conc[1], step: 0.1, unit: "mol/L", digits: 1, onChange: change },
    { type: "slider", key: "concB", label: "Nồng độ ban đầu của B", min: LIMITS.conc[0], max: LIMITS.conc[1], step: 0.1, unit: "mol/L", digits: 1, onChange: change },
    { type: "checkbox", key: "catalyst", label: "Thêm chất xúc tác (giảm Eₐ)", onChange: change },
    {
      type: "select",
      key: "speed",
      label: "Tốc độ mô phỏng",
      options: [
        { value: 1, label: "Bình thường" },
        { value: 4, label: "Nhanh gấp 4" },
        { value: 16, label: "Nhanh gấp 16" },
      ],
    },
    {
      type: "button",
      label: "Chạy lại với các hạt khác",
      action(s, api) {
        s.seed = (s.seed % 9999) + 1;
        restart(s);
        api.play();
        api.emit("rerun", { seed: s.seed });
      },
    },
  ],
  readouts: [
    { label: "Thời gian", value: s => `${fmt(s.time, 1)} s` },
    { label: "Va chạm hiệu quả / tổng", value: s => `${s.effective} / ${s.collisions}` },
    { label: "Tỉ lệ va chạm hiệu quả", value: measuredFraction },
    { label: "Dự đoán e^(−Eₐ/RT)", value: s => pct(effectiveFraction(s)) },
    { label: "Tốc độ đầu đo được", value: rateText },
    { label: "Đạt 50 % lúc", value: s => (s.halfTime ? `${fmt(s.halfTime, 1)} s` : "–") },
  ],
  draw(ctx, s, view) {
    const g = layout(view);
    ensure(s);
    drawLegend(ctx, s, g);
    drawBox(ctx, s, g);
    drawGraph(ctx, s, g);
    if (g.info) {
      const { x } = g.info;
      const size = g.info.w >= 230 ? 14 : 13;
      const lines = [
        ["A + B → AB", { bold: true, size: 19 }],
        [`Nhiệt độ T = ${fmt(s.temperature, 0)} K`, {}],
        [`Năng lượng hoạt hóa Eₐ = ${fmt(activationEnergy(s), 1)} kJ/mol`, { color: s.catalyst ? COLORS.orange : COLORS.ink }],
        [`Va chạm A–B: ${s.collisions}`, {}],
        [`Va chạm hiệu quả: ${s.effective} (${measuredFraction(s)})`, { color: COLORS.orange, bold: true }],
        [`Dự đoán e^(−Eₐ/RT): ${pct(effectiveFraction(s))}`, { color: COLORS.muted }],
        [`Tốc độ đầu: ${rateText(s)}`, { bold: true }],
      ];
      let y = g.box.y + 14;
      for (const [text, opts] of lines) {
        label(ctx, text, x, y, { size, ...opts });
        y += opts.size ? 34 : 27;
      }
      y = Math.max(y + 6, g.box.y + g.box.h - 40);
      for (const text of ["Mô hình minh họa: số hạt ít và Eₐ nhỏ", "hơn thực tế rất nhiều; nhiệt độ được", "giữ không đổi trong suốt phản ứng."]) {
        label(ctx, text, x, y, { size: 12, color: COLORS.muted });
        y += 16;
      }
    } else {
      label(ctx, "Nét đứt: dự đoán trung bình · Mô hình minh họa, Eₐ nhỏ hơn thực tế", view.w / 2, view.h - 8, { size: 10, align: "center", color: COLORS.muted });
    }
  },
});
