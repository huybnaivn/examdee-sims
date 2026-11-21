import { mount, COLORS, label, fmt } from "../../kit/v1/kit.js";
import { initialState, stages, at, step, restart, totalTime, C_ICE, C_WATER, C_STEAM, LAMBDA, L_VAP } from "./model.js";

const RUN_SECONDS = 24; // real seconds for the whole experiment at normal playback
const STAGE_COLORS = [COLORS.blue, COLORS.purple, COLORS.green, COLORS.orange, COLORS.red];
const NAMES = ["Nước đá nóng lên", "Nóng chảy ở 0 °C", "Nước nóng lên", "Sôi ở 100 °C", "Hơi nước nóng lên"];
const SHORT = ["Đá nóng lên", "Nóng chảy", "Nước nóng lên", "Sôi", "Hơi nóng lên"];
const FORMULAS = [
  `Q = m·c đá·Δt, c đá = ${C_ICE} J/kg·K`,
  `Q = λ·m, λ = ${fmt(LAMBDA / 1e5, 1)}·10⁵ J/kg`,
  `Q = m·c nước·Δt, c nước = ${C_WATER} J/kg·K`,
  `Q = L·m, L = ${fmt(L_VAP / 1e6, 1)}·10⁶ J/kg`,
  `Q = m·c hơi·Δt, c hơi = ${C_STEAM} J/kg·K`,
];
const STATES = ["Nước đá (thể rắn)", "Nước đá và nước", "Nước (thể lỏng)", "Nước và hơi nước", "Hơi nước (thể khí)", "Hơi nước (thể khí)"];
const COLS = 8; // particle lattice columns
const N = 40; // particles drawn

const kJ = q => `${fmt(q / 1000, q < 1e5 ? 1 : 0)} kJ`;
const sec = t => `${fmt(t, t < 100 ? 1 : 0)} s`;

const onSettings = s => restart(s);

/** A "nice" tick step for an axis spanning `range` with about `n` ticks. */
function niceStep(range, n) {
  const raw = range / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(k => k * p).find(v => v >= raw);
}

// Everything is placed from the view size.
function geom(view) {
  const { w, h } = view;
  const wide = w >= 620 && h >= 420;
  const pad = wide ? 18 : 8;
  if (wide) {
    const bw = Math.min(250, w * 0.28);
    const graph = { x: bw + 2 * pad + 54, y: 34, w: 0, h: Math.min(h * 0.56, 420) };
    graph.w = w - graph.x - pad - 8;
    const boxH = Math.min(graph.h - 70, bw * 1.1);
    const box = { x: pad + 6, y: graph.y + 20, w: bw, h: boxH };
    const table = { x: pad + 6, y: graph.y + graph.h + 48, w: w - 2 * pad - 12, rowH: Math.min(26, (h - graph.y - graph.h - 66) / 7) };
    return { wide, graph, box, table, size: 13 };
  }
  const graph = { x: 40, y: 18, w: w - 40 - pad - 6, h: Math.max(80, h * 0.48 - 34) };
  const top = graph.y + graph.h + 36;
  const bw = Math.min(w * 0.36, (h - top - 36) * 1.05, 180);
  const box = { x: pad + 2, y: top, w: bw, h: Math.max(40, h - top - 36) };
  const tx = box.x + bw + 12;
  const table = { x: tx, y: top - 6, w: w - tx - pad, rowH: Math.min(22, (h - top - 14) / 7) };
  return { wide, graph, box, table, size: 11 };
}

function drawGraph(ctx, s, g) {
  const { x, y, w, h } = g.graph;
  const list = stages(s);
  const end = list.at(-1).end;
  const tMin = Math.min(-10, s.tStart - 10);
  const tMax = s.tEnd + 10;
  const X = t => x + (t / end) * w;
  const Y = T => y + h - ((T - tMin) / (tMax - tMin)) * h;
  const size = g.size;

  // grid and ticks
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  const dT = niceStep(tMax - tMin, g.wide ? 8 : 5);
  for (let T = Math.ceil(tMin / dT) * dT; T <= tMax; T += dT) {
    ctx.beginPath();
    ctx.moveTo(x, Y(T));
    ctx.lineTo(x + w, Y(T));
    ctx.stroke();
    label(ctx, fmt(T, 0), x - 5, Y(T), { size: size - 1, align: "right", color: COLORS.muted });
  }
  const dt = niceStep(end, g.wide ? 8 : 4);
  for (let t = 0; t <= end * 1.0001; t += dt) {
    ctx.beginPath();
    ctx.moveTo(X(t), y);
    ctx.lineTo(X(t), y + h);
    ctx.stroke();
    label(ctx, fmt(t, 0), X(t), y + h + 10, { size: size - 1, align: "center", color: COLORS.muted });
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w + 6, y + h);
  ctx.stroke();
  label(ctx, g.wide ? "Nhiệt độ (°C)" : "°C", x - (g.wide ? 40 : 30), y - (g.wide ? 18 : 10), { size, color: COLORS.muted });
  label(ctx, g.wide ? "Thời gian đun (s)" : "s", x + w, y + h + (g.wide ? 26 : 10), { size, align: "right", color: COLORS.muted });

  // whole curve dashed (what will happen), heated part solid
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  list.forEach((st, k) => {
    if (k === 0) ctx.moveTo(X(st.start), Y(st.from));
    ctx.lineTo(X(st.end), Y(st.to));
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  list.forEach((st, k) => {
    if (s.time <= st.start && k > 0) return;
    const tEnd = Math.min(s.time, st.end);
    ctx.strokeStyle = STAGE_COLORS[k];
    ctx.beginPath();
    ctx.moveTo(X(st.start), Y(st.from));
    ctx.lineTo(X(tEnd), Y(at(s, tEnd).temperature));
    ctx.stroke();
  });
  // plateau labels
  for (const k of [1, 3]) {
    const st = list[k];
    const text = g.wide ? NAMES[k] : SHORT[k];
    // melting: under the plateau, right of the ice line; boiling: above it, centred
    if (k === 1) label(ctx, text, X(st.start) + 4, Y(st.to) + 12, { size, bold: true, color: STAGE_COLORS[k] });
    else label(ctx, text, X((st.start + st.end) / 2), Y(st.to) - 12, { size, align: "center", bold: true, color: STAGE_COLORS[k] });
  }
  // current point
  const c = at(s);
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(X(s.time), Y(c.temperature), 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSample(ctx, s, g) {
  const { x, y, w, h } = g.box;
  const c = at(s);
  const clock = s._clock ?? 0;
  const heaterH = Math.max(14, Math.min(26, h * 0.14));
  const bh = h - heaterH - 6; // container height
  const r = Math.max(2.5, Math.min(5.5, w / 34));
  const d = Math.min((w - 16) / COLS, (bh - 16) / 7); // lattice spacing
  const kT = Math.sqrt((c.temperature + 273) / 273); // particle speed grows as √T

  // container (closed, so the steam stays in the sample)
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, bh, 8);
  ctx.fill();
  ctx.stroke();

  const nS = Math.round(c.solid * N);
  const nL = Math.round(c.liquid * N);
  const x0 = x + (w - COLS * d) / 2 + d / 2;
  const slot = i => [x0 + (i % COLS) * d, y + bh - 8 - d / 2 - Math.floor(i / COLS) * d];
  const hash = i => {
    const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const tri = u => {
    const f = u - Math.floor(u);
    return f < 0.5 ? 2 * f : 2 - 2 * f;
  };
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = hash(i) * 6.283;
    if (i < nS) {
      const amp = 0.6 + 0.08 * (c.temperature + 50) / 10; // vibration about a fixed site
      const [px, py] = slot(i);
      pts.push([px + amp * Math.sin(clock * 37 + a), py + amp * Math.cos(clock * 41 + 2 * a), 0]);
    } else if (i < nS + nL) {
      const [px, py] = slot(i);
      const amp = 0.3 * d;
      pts.push([px + amp * Math.sin(clock * 3.1 * kT + a), py + amp * 0.6 * Math.cos(clock * 2.7 * kT + 3 * a), 1]);
    } else {
      const vx = (0.25 + hash(i + 50)) * 0.55 * kT;
      const vy = (0.25 + hash(i + 90)) * 0.55 * kT;
      pts.push([x + r + 2 + (w - 2 * r - 4) * tri(hash(i + 7) + vx * clock), y + r + 2 + (bh - 2 * r - 4) * tri(hash(i + 13) + vy * clock), 2]);
    }
  }
  // bonds of the crystal lattice
  ctx.strokeStyle = "#9db8ec";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < nS; i++) {
    if (i % COLS < COLS - 1 && i + 1 < nS) {
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    }
    if (i + COLS < nS) {
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + COLS][0], pts[i + COLS][1]);
    }
  }
  ctx.stroke();
  for (const [px, py, kind] of pts) {
    ctx.fillStyle = ["#5b8def", COLORS.blue, "#7fb0ff"][kind];
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // heater
  const hy = y + bh + 4;
  const on = c.stage < 5 && s.time > 0;
  ctx.fillStyle = "#d9dee8";
  ctx.fillRect(x + 6, hy, w - 12, heaterH);
  ctx.strokeStyle = on ? COLORS.red : COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const turns = Math.max(4, Math.floor((w - 24) / 12));
  for (let k = 0; k <= turns * 2; k++) {
    const px = x + 12 + ((w - 24) * k) / (turns * 2);
    const py = hy + heaterH / 2 + (k % 2 ? -1 : 1) * heaterH * 0.28;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  label(ctx, `P = ${fmt(s.power, 0)} W`, x + w / 2, hy + heaterH + (g.wide ? 12 : 9), { size: g.size, align: "center", color: COLORS.muted });
  label(ctx, STATES[c.stage], x + w / 2, y - (g.wide ? 12 : 9), { size: g.size, align: "center", bold: true });
}

function drawTable(ctx, s, g) {
  const { x, y, w, rowH } = g.table;
  if (rowH < 13) return;
  const list = stages(s);
  const c = at(s);
  const size = Math.min(g.size, rowH - 3);
  const cols = g.wide ? [0, 0.25, 0.66, 0.84] : [0, 0.56, 0.8];
  const head = g.wide ? ["Giai đoạn", "Công thức", "Nhiệt lượng thu vào", "Thời gian"] : ["Giai đoạn", "Q", "t"];
  head.forEach((text, k) => label(ctx, text, x + cols[k] * w + 2, y + rowH / 2, { size, color: COLORS.muted, bold: true }));
  list.forEach((st, k) => {
    const cy = y + rowH * (k + 1.5);
    const state = k < c.stage ? "done" : k === c.stage && s.time > 0 ? "now" : "next";
    if (state === "now") {
      ctx.fillStyle = "#eef3ff";
      ctx.fillRect(x, cy - rowH / 2, w, rowH);
    }
    const color = state === "next" ? COLORS.muted : COLORS.ink;
    ctx.fillStyle = STAGE_COLORS[k];
    ctx.fillRect(x + 2, cy - 4, 8, 8);
    const cells = g.wide
      ? [`${k + 1}. ${NAMES[k]}`, FORMULAS[k], kJ(st.Q), sec(st.duration)]
      : [`${k + 1}. ${SHORT[k]}`, kJ(st.Q), sec(st.duration)];
    cells.forEach((text, j) => label(ctx, text, x + cols[j] * w + (j ? 2 : 14), cy, { size, color, bold: state === "now" }));
  });
  const cy = y + rowH * 6.5;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, cy - rowH / 2);
  ctx.lineTo(x + w, cy - rowH / 2);
  ctx.stroke();
  const total = list.at(-1);
  const sumCells = g.wide ? ["Tổng", "Q = Q₁ + … + Q₅", kJ(total.heatAfter), sec(total.end)] : ["Tổng", kJ(total.heatAfter), sec(total.end)];
  sumCells.forEach((text, j) => label(ctx, text, x + cols[j] * w + (j ? 2 : 14), cy, { size, bold: true }));
}

mount({
  slug: "chuyen-the",
  version: "1.0.0",
  title: "Sự chuyển thể: đun nóng nước đá",
  hint: "Chọn khối lượng, nhiệt độ ban đầu của nước đá và công suất bếp, rồi bấm Chạy để theo dõi đường biểu diễn nhiệt độ theo thời gian.",
  initialState,
  step(s, dt, api) {
    s._clock = (s._clock ?? 0) + dt;
    const list = stages(s);
    if (s.time >= list.at(-1).end) restart(s); // pressing Chạy after the end runs it again
    for (const k of step(s, (dt * list.at(-1).end) / RUN_SECONDS)) {
      api.emit("stage-end", { stage: k + 1, time: list[k].end, heat: list[k].Q, totalHeat: list[k].heatAfter, temperature: list[k].to }, "result");
      if (k === 3) api.emit("all-steam", { time: list[k].end, heat: list[k].heatAfter, mass: s.mass }, "goal");
    }
    if (s.stagesDone >= 5) api.pause();
  },
  controls: [
    { type: "slider", key: "mass", label: "Khối lượng nước đá m", min: 0.1, max: 2, step: 0.1, unit: "kg", digits: 1, onChange: onSettings },
    { type: "slider", key: "tStart", label: "Nhiệt độ ban đầu của đá", min: -40, max: -1, step: 1, unit: "°C", digits: 0, onChange: onSettings },
    { type: "slider", key: "power", label: "Công suất bếp P", min: 500, max: 5000, step: 100, unit: "W", digits: 0, onChange: onSettings },
    { type: "slider", key: "tEnd", label: "Đun hơi nước đến", min: 105, max: 150, step: 5, unit: "°C", digits: 0, onChange: onSettings },
  ],
  readouts: [
    { label: "Giai đoạn", value: s => { const c = at(s); return c.stage === 5 ? "Đã xong" : `${c.stage + 1}. ${NAMES[c.stage]}`; } },
    { label: "Nhiệt độ", value: s => `${fmt(at(s).temperature, 1)} °C` },
    { label: "Thời gian đun", value: s => sec(s.time) },
    { label: "Nhiệt lượng đã thu", value: s => kJ(at(s).heat) },
    { label: "Tổng nhiệt lượng cần", value: s => kJ(totalTime(s) * s.power) },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    drawGraph(ctx, s, g);
    drawSample(ctx, s, g);
    drawTable(ctx, s, g);
    const note = g.wide
      ? "Bỏ qua nhiệt hao phí ra môi trường. Mô hình hạt chỉ minh họa, không theo tỉ lệ; thời gian được tua nhanh."
      : "Bỏ qua hao phí nhiệt; mô hình hạt chỉ minh họa.";
    label(ctx, note, view.w - 8, view.h - 9, { size: g.wide ? 12 : 10, align: "right", color: COLORS.muted });
  },
});
