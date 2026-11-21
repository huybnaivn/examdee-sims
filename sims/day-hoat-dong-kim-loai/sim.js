import { mount, COLORS, label, clamp } from "../../kit/v1/kit.js";
import { initialState, step, METALS, SOLUTIONS, SERIES, metal, solution, reaction, sub } from "./model.js";

const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;
const LIQUID = { clear: [205, 225, 245, 0.35], blue: [50, 120, 220, 0.5], green: [140, 195, 130, 0.45] };
const METAL_COLOR = { Cu: "#c0703a", Ag: "#e4e6ea", Au: "#d8b13a", default: "#a9b0bb" };
const DEPOSIT = { Cu: "#b5652d", Ag: "#c9ccd2", Fe: "#3d3d42" };
const PPT = { blue: "#3f7fd6", brown: "#4a3426", white: "#eef3e6" };

const rnd = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const rgba = ([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function fit(ctx, text, maxW, size, bold) {
  let sz = size;
  const set = () => (ctx.font = `${bold ? "600 " : ""}${sz}px ${FONT}`);
  set();
  while (sz > 8 && ctx.measureText(text).width > maxW) {
    sz--;
    set();
  }
  return sz;
}

function geom(view) {
  const small = view.w < 560 || view.h < 430;
  const pad = small ? 8 : 20;
  const box = Math.min((view.w - 2 * pad) / SERIES.length, 52);
  const sy = small ? 8 : 34; // top of the series strip
  const sh = small ? 22 : 30;
  const textH = small ? 78 : 126;
  const top = sy + sh + (small ? 30 : 64);
  const bottom = view.h - textH;
  const bw = Math.min(view.w * 0.5, 280, (bottom - top) * 1.3);
  const bx = (view.w - bw) / 2;
  return { small, pad, box, sy, sh, textH, sx: (view.w - box * SERIES.length) / 2, top, bottom, bw, bx, liquid: top + (bottom - top) * 0.25, hang: top - (small ? 12 : 40) }; // hang: highest point of the metal, under the legend
}

function drawSeries(ctx, s, g) {
  const m = metal(s.metal).symbol;
  const ion = solution(s.solution).ion;
  if (!g.small) label(ctx, "Dãy hoạt động hóa học của kim loại: mức độ hoạt động giảm dần từ trái sang phải", g.sx, g.sy - 16, { size: 13, color: COLORS.muted });
  SERIES.forEach((sym, i) => {
    const x = g.sx + i * g.box;
    const fill = sym === m ? COLORS.blue : sym === ion ? COLORS.orange : sym === "H" ? "#fff6d6" : "#fff";
    ctx.fillStyle = fill;
    ctx.fillRect(x + 1, g.sy, g.box - 2, g.sh);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, g.sy, g.box - 2, g.sh);
    label(ctx, sym === "H" ? "(H)" : sym, x + g.box / 2, g.sy + g.sh / 2, { size: g.small ? 11 : 14, align: "center", bold: true, color: sym === m || sym === ion ? "#fff" : COLORS.ink });
  });
  const ly = g.sy + g.sh + (g.small ? 9 : 14);
  const size = g.small ? 10 : 12;
  label(ctx, "■ kim loại thả vào", g.sx, ly, { size, color: COLORS.blue });
  if (ion) label(ctx, `■ ${ion === "H" ? "H của axit" : "kim loại trong muối"}`, g.sx + g.box * SERIES.length, ly, { size, color: COLORS.orange, align: "right" });
}

function drawScene(ctx, s, g) {
  const m = metal(s.metal);
  const sol = solution(s.solution);
  const r = s.dropped ? reaction(s.metal, s.solution) : null;
  const p = s.dropped ? clamp(s.progress, 0, 1) : 0; // progress has no control, so a forged value is clamped here
  const k = clamp((p - 0.25) / 0.75, 0, 1) * (r?.slow ? 0.25 : 1);
  const { bx, bw, top, bottom, liquid } = g;

  // solution
  const from = LIQUID[sol.color];
  ctx.fillStyle = rgba(r ? mix(from, LIQUID[r.to], k) : from);
  ctx.fillRect(bx, liquid, bw, bottom - liquid);

  // precipitate settling on the bottom
  if (r?.ppt && k > 0) {
    const n = Math.round(40 * k);
    for (let i = 0; i < n; i++) {
      const x = bx + 6 + rnd(i, 4) * (bw - 12);
      const y = bottom - 4 - rnd(i, 5) * (bottom - liquid) * (1 - p) * 0.8 - rnd(i, 6) * 8;
      ctx.fillStyle = PPT[r.ppt];
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  const lump = m.symbol === "K" || m.symbol === "Na";
  const drop = s.dropped ? Math.min(1, p / 0.25) : 0;
  const ease = 1 - (1 - drop) ** 2;
  const colour = METAL_COLOR[m.symbol] ?? METAL_COLOR.default;
  let gasX;
  let gasTop;
  let gasBottom;
  if (lump) {
    // a small piece that darts about on the surface and shrinks as it reacts
    const size = (g.small ? 16 : 24) * (1 - 0.8 * k);
    const x = bx + bw / 2 + Math.sin(p * 23) * bw * 0.25 * Math.min(1, k * 3);
    const y = g.hang + (liquid - size * 0.3 - g.hang) * ease;
    if (m.symbol === "K" && k > 0 && k < 1) {
      const glow = ctx.createRadialGradient(x, y - size, 1, x, y - size, size * 1.6);
      glow.addColorStop(0, "rgba(170, 110, 230, 0.75)");
      glow.addColorStop(1, "rgba(170, 110, 230, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y - size, size * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (size > 1) {
      ctx.fillStyle = colour;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - size / 2, y - size * 0.35, size, size * 0.7, 4);
      ctx.fill();
      ctx.stroke();
    }
    gasX = x;
    gasTop = liquid;
    gasBottom = liquid + 14;
  } else {
    // a strip on a thread: held just above the liquid, then lowered until it is under the surface
    const sw = Math.max(10, bw * 0.1);
    const sh = clamp(liquid - 8 - g.hang, 30, (bottom - top) * 0.6);
    const y0 = liquid - 8 - sh + ease * (bottom - (bottom - top) * 0.1 - (liquid - 8));
    const x0 = bx + bw / 2 - sw / 2;
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0 + sw / 2, g.hang - 6);
    ctx.lineTo(x0 + sw / 2, y0);
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.strokeStyle = COLORS.ink;
    ctx.fillRect(x0, y0, sw, sh);
    ctx.strokeRect(x0, y0, sw, sh);
    // metal coating on the part under the surface
    const wet = Math.max(liquid, y0);
    if (r?.deposit && k > 0) {
      ctx.fillStyle = DEPOSIT[r.deposit];
      ctx.globalAlpha = 0.55 * k;
      ctx.fillRect(x0 - 1, wet, sw + 2, y0 + sh - wet);
      ctx.globalAlpha = 1;
      const n = Math.round(60 * k);
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(x0 - 2 + rnd(i, 1) * (sw + 4), wet + rnd(i, 2) * (y0 + sh - wet), 1.5 + rnd(i, 3) * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    gasX = x0 + sw / 2;
    gasTop = wet;
    gasBottom = y0 + sh;
  }

  // hydrogen bubbles rising to the surface
  if (r?.gas && k > 0) {
    const n = r.slow ? 4 : 14;
    for (let i = 0; i < n; i++) {
      let u = rnd(i, 7) + p * 4 * (0.6 + rnd(i, 8));
      u -= Math.floor(u);
      const y0 = gasTop + rnd(i, 9) * Math.max(0, gasBottom - gasTop);
      const y = y0 - u * (y0 - liquid);
      const x = gasX + (rnd(i, 10) - 0.5) * (lump ? 40 : bw * 0.2);
      ctx.beginPath();
      ctx.arc(x, y, 1.8 + rnd(i, 11) * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.strokeStyle = "#8aa0c0";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // beaker
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx, top);
  ctx.lineTo(bx, bottom);
  ctx.lineTo(bx + bw, bottom);
  ctx.lineTo(bx + bw, top);
  ctx.stroke();
  label(ctx, sol.label, bx + bw + 8, (liquid + bottom) / 2, { size: g.small ? 11 : 14, bold: true, color: COLORS.muted });
  label(ctx, m.symbol, bx - 8, (liquid + bottom) / 2, { size: g.small ? 11 : 14, bold: true, align: "right", color: COLORS.blue });
}

function reason(s) {
  const m = metal(s.metal).symbol;
  const sol = solution(s.solution);
  const r = reaction(s.metal, s.solution);
  if (r?.note) return r.note;
  if (!sol.ion) return `${m} không phản ứng với nước ở nhiệt độ thường.`;
  if (sol.ion === m) return `${m} không đẩy được chính nó ra khỏi muối.`;
  const what = sol.ion === "H" ? "H ra khỏi dung dịch axit" : `${sol.ion} ra khỏi dung dịch muối`;
  return r ? `${m} đứng trước ${sol.ion === "H" ? "H" : sol.ion} trong dãy nên đẩy được ${what}.` : `${m} đứng sau ${sol.ion === "H" ? "H" : sol.ion} trong dãy nên không đẩy được ${what}.`;
}

function drawText(ctx, s, g, view) {
  const r = reaction(s.metal, s.solution);
  const w = view.w - 2 * g.pad;
  const size = g.small ? 12 : 15;
  const lh = g.small ? 15 : 22;
  const out = [];
  if (!s.dropped) {
    if (s.practice) {
      const p = { none: "chưa chọn", yes: "có phản ứng", no: "không phản ứng" }[s.prediction] ?? "chưa chọn";
      out.push([`Dự đoán của em: ${p}`, true, COLORS.ink]);
      out.push([s.prediction === "none" ? "Chọn dự đoán ở bảng bên, rồi bấm “Thả kim loại”." : "Bấm “Thả kim loại” để kiểm tra.", false, COLORS.muted]);
    } else {
      out.push(["Bấm “Thả kim loại” để quan sát.", true, COLORS.ink]);
    }
  } else {
    const verdict = r ? "Có phản ứng" : "Không có phản ứng";
    const judged = s.verdict === 1 ? " · dự đoán đúng ✓" : s.verdict === 0 ? " · dự đoán chưa đúng" : "";
    out.push([verdict + judged, true, r ? COLORS.green : COLORS.red]);
    for (const eq of r?.eq ?? []) out.push([sub(eq), true, COLORS.ink]);
    out.push([reason(s), false, COLORS.muted]);
  }
  if (metal(s.metal).symbol === "Al") out.push(["Không mô phỏng lớp oxide bảo vệ và sự thụ động hóa của Al.", false, COLORS.muted]);
  const y0 = g.bottom + (g.small ? 14 : 22);
  const max = Math.floor((view.h - y0 - lh / 2) / lh) + 1; // lines whose centre fits above the bottom edge
  out.slice(0, max).forEach(([t, bold, color], i) => {
    const sz = fit(ctx, t, w, i === 0 ? size + 1 : size, bold);
    label(ctx, t, view.w / 2, y0 + i * lh, { size: sz, bold, color, align: "center" });
  });
}

const resetDrop = (s, api) => {
  s.dropped = false;
  s.progress = 0;
  s.verdict = -1;
  s.prediction = "none";
  api.pause();
};

mount({
  slug: "day-hoat-dong-kim-loai",
  version: "1.0.0",
  title: "Dãy hoạt động hóa học của kim loại",
  hint: "Chọn kim loại và dung dịch rồi thả kim loại vào. Bật chế độ luyện tập để dự đoán trước khi thả.",
  initialState,
  step(s, dt, api) {
    if (step(s, dt)) api.pause();
  },
  controls: [
    { type: "select", key: "metal", label: "Kim loại", options: METALS.map((m, i) => ({ value: i, label: `${m.symbol} (${m.name})` })), onChange: resetDrop },
    { type: "select", key: "solution", label: "Dung dịch", options: SOLUTIONS.map((x, i) => ({ value: i, label: x.label })), onChange: resetDrop },
    { type: "checkbox", key: "practice", label: "Luyện tập: dự đoán trước khi thả", onChange: resetDrop },
    {
      type: "select",
      key: "prediction",
      label: "Dự đoán của em",
      visible: s => s.practice,
      options: [
        { value: "none", label: "— chọn —" },
        { value: "yes", label: "Có phản ứng" },
        { value: "no", label: "Không phản ứng" },
      ],
    },
    {
      type: "button",
      label: "Thả kim loại",
      primary: true,
      disabled: s => s.practice && s.prediction === "none",
      action(s, api) {
        if (s.practice && s.prediction === "none") return;
        const reacted = reaction(s.metal, s.solution) ? 1 : 0;
        s.dropped = true;
        s.progress = 0;
        s.verdict = s.practice ? Number((s.prediction === "yes") === !!reacted) : -1;
        api.play();
        api.emit("metal-test", { metal: s.metal, solution: s.solution, reacted }, "result");
        if (s.verdict === 1) api.emit("correct-prediction", { metal: s.metal, solution: s.solution, reacted }, "goal");
        if (s.practice) s.prediction = "none"; // one prediction earns at most one goal
      },
    },
  ],
  readouts: [
    { label: "Kim loại", value: s => `${metal(s.metal).symbol} (${metal(s.metal).name})` },
    { label: "Dung dịch", value: s => solution(s.solution).label },
    { label: "Kết quả", value: s => (!s.dropped ? "–" : reaction(s.metal, s.solution) ? "có phản ứng" : "không phản ứng") },
  ],
  draw(ctx, s, view) {
    const g = geom(view);
    drawSeries(ctx, s, g);
    drawScene(ctx, s, g);
    drawText(ctx, s, g, view);
  },
});
